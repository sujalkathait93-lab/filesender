/**
 * SecureShare WebRTC & Signaling Module
 * WebRTC DataChannel + Flask-SocketIO Signaling + STUN/TURN
 * Handles automatic LAN/WAN connection selection, binary chunking, resume, progress & speed tracking
 */

import { io } from 'socket.io-client';
import { generateKey, deriveKey, compressData, decompressData, encryptChunkData, decryptChunkData } from './crypto';

const CHUNK_SIZE = 64 * 1024; // 64 KB chunks
const BUFFERED_AMOUNT_LOW = 256 * 1024; // 256 KB flow control threshold

export class WebRTCSession {
  constructor({ serverUrl, roomCode, role = 'sender', onStatus, onProgress, onError, onComplete, onConnectionMode }) {
    this.serverUrl = serverUrl || window.location.origin;
    this.roomCode = roomCode;
    this.role = role;

    // Callbacks
    this.onStatus = onStatus || (() => {});
    this.onProgress = onProgress || (() => {});
    this.onError = onError || (() => {});
    this.onComplete = onComplete || (() => {});
    this.onConnectionMode = onConnectionMode || (() => {});

    // State
    this.socket = null;
    this.peerConnection = null;
    this.dataChannel = null;
    this.connectionMode = 'detecting'; // 'lan', 'wan-stun', 'wan-turn', 'cloud-fallback'
    this.isPaused = false;
    this.isCancelled = false;

    // Transfer State
    this.file = null;
    this.fileMeta = null;
    this.encryptionKey = null;
    this.rawCompressedData = null;
    this.receivedChunks = new Map();
    this.totalChunks = 0;
    this.sentChunkIndex = 0;
    this.startTime = 0;
    this.lastSpeedCheckTime = 0;
    this.lastSpeedCheckBytes = 0;
    this.currentSpeed = 0; // Bytes/sec

    // Default ICE configuration
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ];
  }

  /**
   * Initialize signaling WebSocket connection
   */
  async initSignaling() {
    return new Promise((resolve, reject) => {
      this.onStatus('Connecting to signaling server...');
      
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10
      });

      this.socket.on('connect', () => {
        this.onStatus('Connected to signaling server. Joining room...');
        this.socket.emit('join_room', { room: this.roomCode, role: this.role });
      });

      this.socket.on('room_joined', (data) => {
        this.onStatus(`Joined transfer room ${this.roomCode} (${data.peer_count} peer(s))`);
        if (data.peer_count >= 2 && this.role === 'sender') {
          this.startWebRTCSender();
        }
        resolve(data);
      });

      this.socket.on('webrtc_offer', async ({ offer }) => {
        if (this.role === 'receiver') {
          await this.handleWebRTCOffer(offer);
        }
      });

      this.socket.on('webrtc_answer', async ({ answer }) => {
        if (this.role === 'sender' && this.peerConnection) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      this.socket.on('ice_candidate', async ({ candidate }) => {
        if (this.peerConnection && candidate) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('Error adding ICE candidate:', e);
          }
        }
      });

      this.socket.on('transfer_meta', ({ meta }) => {
        if (this.role === 'receiver') {
          this.fileMeta = meta;
          this.totalChunks = meta.totalChunks;
          this.onStatus(`Received file metadata: ${meta.originalName} (${meta.totalChunks} chunks)`);
        }
      });

      this.socket.on('request_resume', ({ last_chunk_index }) => {
        if (this.role === 'sender') {
          this.sentChunkIndex = last_chunk_index + 1;
          this.onStatus(`Resuming transfer from chunk ${this.sentChunkIndex}...`);
          this.sendNextChunks();
        }
      });

      this.socket.on('connect_error', (err) => {
        this.onError(`Signaling error: ${err.message}`);
        reject(err);
      });
    });
  }

  /**
   * Create Peer Connection
   */
  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice_candidate', {
          room: this.roomCode,
          candidate: event.candidate
        });
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      this.onStatus(`ICE State: ${state}`);
      if (state === 'connected' || state === 'completed') {
        this.detectConnectionMode();
      } else if (state === 'failed' || state === 'disconnected') {
        this.onConnectionMode('cloud-fallback');
      }
    };
  }

  /**
   * Detect ICE candidate pair type (LAN Direct / WAN STUN / TURN Relay)
   */
  async detectConnectionMode() {
    try {
      const stats = await this.peerConnection.getStats();
      let mode = 'wan-stun';

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const localReport = stats.get(report.localCandidateId);
          const remoteReport = stats.get(report.remoteCandidateId);

          if (localReport && remoteReport) {
            const localType = localReport.candidateType;
            const remoteType = remoteReport.candidateType;

            if (localType === 'host' && remoteType === 'host') {
              mode = 'lan';
            } else if (localType === 'relay' || remoteType === 'relay') {
              mode = 'wan-turn';
            } else {
              mode = 'wan-stun';
            }
          }
        }
      });

      this.connectionMode = mode;
      this.onConnectionMode(mode);
    } catch (e) {
      this.connectionMode = 'wan-stun';
      this.onConnectionMode('wan-stun');
    }
  }

  /**
   * Sender: Start WebRTC DataChannel connection
   */
  async startWebRTCSender() {
    this.createPeerConnection();

    this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
      ordered: true
    });
    this.dataChannel.binaryType = 'arraybuffer';
    this.setupDataChannelEvents();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.socket.emit('webrtc_offer', {
      room: this.roomCode,
      offer
    });
  }

  /**
   * Receiver: Handle incoming WebRTC SDP Offer
   */
  async handleWebRTCOffer(offer) {
    this.createPeerConnection();

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.dataChannel.binaryType = 'arraybuffer';
      this.setupDataChannelEvents();
    };

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.socket.emit('webrtc_answer', {
      room: this.roomCode,
      answer
    });
  }

  /**
   * Setup DataChannel Events (Chunk receiver / sender)
   */
  setupDataChannelEvents() {
    this.dataChannel.onopen = () => {
      this.onStatus('WebRTC DataChannel connected! Starting transfer...');
      if (this.role === 'sender') {
        this.sendTransferMeta();
        this.sendNextChunks();
      }
    };

    this.dataChannel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        // Control JSON messages
        const msg = JSON.parse(event.data);
        if (msg.type === 'ack') {
          // Chunk acknowledge or request next
        } else if (msg.type === 'pause') {
          this.isPaused = true;
          this.onStatus('Transfer paused by remote peer');
        } else if (msg.type === 'resume') {
          this.isPaused = false;
          this.onStatus('Transfer resumed');
          if (this.role === 'sender') this.sendNextChunks();
        }
      } else {
        // Binary Chunk received
        await this.handleIncomingChunk(new Uint8Array(event.data));
      }
    };

    this.dataChannel.onclose = () => {
      this.onStatus('DataChannel closed');
    };

    this.dataChannel.onerror = (err) => {
      this.onError(`DataChannel error: ${err}`);
    };
  }

  /**
   * Sender: Compress file & send file metadata to receiver
   */
  async prepareFile(file, password) {
    this.file = file;
    this.onStatus('Compressing file with Gzip before WebRTC chunking...');
    
    const arrayBuffer = await file.arrayBuffer();
    const rawBytes = new Uint8Array(arrayBuffer);
    
    // Compress
    this.rawCompressedData = await compressData(rawBytes);

    // Generate Key & IV
    const { key, iv, salt, password: genPassword } = await generateKey();
    const effectivePassword = password || genPassword;
    this.encryptionKey = key;
    this.keyMeta = { iv, salt, password: effectivePassword };

    // Calculate total chunks
    this.totalChunks = Math.ceil(this.rawCompressedData.length / CHUNK_SIZE);
    
    this.fileMeta = {
      originalName: file.name,
      originalSize: file.size,
      compressedSize: this.rawCompressedData.length,
      totalChunks: this.totalChunks,
      iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
      salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''),
      password: effectivePassword
    };

    return this.fileMeta;
  }

  /**
   * Sender: Broadcast transfer metadata over signaling & DataChannel
   */
  sendTransferMeta() {
    if (this.fileMeta) {
      this.socket.emit('transfer_meta', {
        room: this.roomCode,
        meta: this.fileMeta
      });
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({ type: 'meta', meta: this.fileMeta }));
      }
    }
  }

  /**
   * Sender: Send binary chunks through DataChannel with flow control
   */
  async sendNextChunks() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    if (this.isPaused || this.isCancelled) return;

    if (!this.startTime) {
      this.startTime = Date.now();
      this.lastSpeedCheckTime = Date.now();
      this.lastSpeedCheckBytes = 0;
    }

    this.dataChannel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW;

    const onLowBuffer = () => {
      this.dataChannel.onbufferedamountlow = null;
      this.sendNextChunks();
    };

    while (this.sentChunkIndex < this.totalChunks && !this.isPaused && !this.isCancelled) {
      if (this.dataChannel.bufferedAmount > BUFFERED_AMOUNT_LOW) {
        this.dataChannel.onbufferedamountlow = onLowBuffer;
        return;
      }

      const start = this.sentChunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, this.rawCompressedData.length);
      const chunkSlice = this.rawCompressedData.subarray(start, end);

      // Encrypt chunk
      const encryptedChunk = await encryptChunkData(
        chunkSlice.buffer.slice(chunkSlice.byteOffset, chunkSlice.byteOffset + chunkSlice.byteLength),
        this.encryptionKey,
        this.keyMeta.iv,
        this.sentChunkIndex
      );

      // Construct binary payload packet:
      // [4 Bytes: Chunk Index][4 Bytes: Total Chunks][Encrypted Chunk Bytes]
      const packet = new Uint8Array(8 + encryptedChunk.length);
      const view = new DataView(packet.buffer);
      view.setUint32(0, this.sentChunkIndex, false);
      view.setUint32(4, this.totalChunks, false);
      packet.set(encryptedChunk, 8);

      this.dataChannel.send(packet.buffer);

      this.sentChunkIndex++;
      this.updateProgress(this.sentChunkIndex * CHUNK_SIZE);
    }

    if (this.sentChunkIndex >= this.totalChunks) {
      this.onStatus('All WebRTC DataChannel chunks transmitted successfully!');
      this.onComplete({ mode: this.connectionMode, meta: this.fileMeta });
    }
  }

  /**
   * Receiver: Handle incoming binary chunk packet
   */
  async handleIncomingChunk(packet) {
    if (packet.length < 8) return;

    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
    const chunkIndex = view.getUint32(0, false);
    const totalChunks = view.getUint32(4, false);
    const encryptedChunkBytes = packet.subarray(8);

    if (!this.startTime) {
      this.startTime = Date.now();
      this.lastSpeedCheckTime = Date.now();
      this.lastSpeedCheckBytes = 0;
    }

    this.totalChunks = totalChunks;
    this.receivedChunks.set(chunkIndex, encryptedChunkBytes);

    this.updateProgress(this.receivedChunks.size * CHUNK_SIZE);

    if (this.receivedChunks.size === totalChunks) {
      this.onStatus('All WebRTC DataChannel chunks received! Assembling & decrypting file...');
      await this.assembleAndDecryptFile();
    }
  }

  /**
   * Receiver: Assemble all chunks, decrypt & decompress payload
   */
  async assembleAndDecryptFile(passwordOverride) {
    try {
      const password = passwordOverride || this.fileMeta?.password;
      const ivHex = this.fileMeta?.iv;
      const saltHex = this.fileMeta?.salt;

      if (!password || !ivHex || !saltHex) {
        throw new Error('Missing decryption key or metadata parameters');
      }

      const ivMatches = ivHex.match(/.{2}/g);
      const saltMatches = saltHex.match(/.{2}/g);
      const iv = new Uint8Array(ivMatches.map(b => parseInt(b, 16)));
      const salt = new Uint8Array(saltMatches.map(b => parseInt(b, 16)));

      // Derive key
      const key = await deriveKey(password, salt);

      // Decrypt all chunks in order
      const decryptedChunkBuffers = [];
      let totalDecryptedSize = 0;

      for (let i = 0; i < this.totalChunks; i++) {
        const encChunk = this.receivedChunks.get(i);
        if (!encChunk) throw new Error(`Missing chunk index ${i}`);

        const decChunk = await decryptChunkData(
          encChunk.buffer.slice(encChunk.byteOffset, encChunk.byteOffset + encChunk.byteLength),
          key,
          iv,
          i
        );

        decryptedChunkBuffers.push(decChunk);
        totalDecryptedSize += decChunk.length;
      }

      // Combine compressed chunks
      const combinedCompressed = new Uint8Array(totalDecryptedSize);
      let offset = 0;
      for (const buf of decryptedChunkBuffers) {
        combinedCompressed.set(buf, offset);
        offset += buf.length;
      }

      // Decompress gzip stream
      const decompressedData = await decompressData(combinedCompressed);

      this.onComplete({
        fileData: decompressedData,
        originalName: this.fileMeta?.originalName || 'decrypted_file',
        mode: this.connectionMode
      });
    } catch (err) {
      this.onError(`Assembly & Decryption error: ${err.message}`);
    }
  }

  /**
   * Calculate live progress, speed (MB/s), ETA (seconds)
   */
  updateProgress(transferredBytes) {
    const totalBytes = (this.fileMeta?.compressedSize || this.file?.size || (this.totalChunks * CHUNK_SIZE)) || 1;
    const currentBytes = Math.min(transferredBytes, totalBytes);
    const percent = Math.min(100, Math.round((currentBytes / totalBytes) * 100));

    const now = Date.now();
    const timeDelta = (now - this.lastSpeedCheckTime) / 1000;

    if (timeDelta >= 0.5) {
      const bytesDelta = currentBytes - this.lastSpeedCheckBytes;
      this.currentSpeed = Math.round(bytesDelta / timeDelta); // Bytes per second
      this.lastSpeedCheckTime = now;
      this.lastSpeedCheckBytes = currentBytes;
    }

    const remainingBytes = Math.max(0, totalBytes - currentBytes);
    const etaSeconds = this.currentSpeed > 0 ? Math.ceil(remainingBytes / this.currentSpeed) : 0;

    this.onProgress({
      percent,
      transferredBytes: currentBytes,
      totalBytes,
      currentChunk: Math.min(this.sentChunkIndex || this.receivedChunks.size, this.totalChunks),
      totalChunks: this.totalChunks,
      speedBytesPerSec: this.currentSpeed,
      etaSeconds,
      connectionMode: this.connectionMode,
      isPaused: this.isPaused
    });
  }

  /**
   * Pause transfer
   */
  pause() {
    this.isPaused = true;
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ type: 'pause' }));
    }
    this.onStatus('Transfer paused');
  }

  /**
   * Resume transfer
   */
  resume() {
    this.isPaused = false;
    if (this.role === 'receiver') {
      const lastReceivedIndex = this.receivedChunks.size > 0 
        ? Math.max(...Array.from(this.receivedChunks.keys())) 
        : -1;
      this.socket?.emit('request_resume', {
        room: this.roomCode,
        last_chunk_index: lastReceivedIndex
      });
    } else if (this.role === 'sender') {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({ type: 'resume' }));
      }
      this.sendNextChunks();
    }
    this.onStatus('Resuming transfer...');
  }

  /**
   * Close WebRTC and socket session cleanly
   */
  destroy() {
    this.isCancelled = true;
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch (e) {}
    }
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch (e) {}
    }
    if (this.socket) {
      try {
        this.socket.emit('leave_room', { room: this.roomCode });
        this.socket.disconnect();
      } catch (e) {}
    }
  }
}
