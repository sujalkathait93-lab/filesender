/**
 * SecureShare WebRTC Module (Facade & Orchestration)
 * Assembles SignalingClient, PeerManager, SenderChannel, and ReceiverChannel.
 */

import { SignalingClient } from './SignalingClient';
import { PeerManager } from './PeerManager';
import { SenderChannel } from './SenderChannel';
import { ReceiverChannel } from './ReceiverChannel';
import { generateKey } from '../crypto';
import { compressData } from '../compression';
import { bytesToHex } from '../hexUtils';

export class WebRTCSession {
  constructor({ serverUrl, roomCode, role = 'sender', onStatus, onProgress, onError, onComplete, onConnectionMode }) {
    this.serverUrl = serverUrl || window.location.origin;
    this.roomCode = roomCode;
    this.role = role;

    this.onStatus = onStatus || (() => {});
    this.onProgress = onProgress || (() => {});
    this.onError = onError || (() => {});
    this.onComplete = onComplete || (() => {});
    this.onConnectionMode = onConnectionMode || (() => {});

    this.signaling = new SignalingClient(this.serverUrl, this.roomCode, this.role);
    this.peerManager = null;
    this.senderChannel = null;
    this.receiverChannel = null;
    this.dataChannel = null;

    this.connectionMode = 'detecting';
    this.file = null;
    this.fileMeta = null;
    this.encryptionKey = null;
    this.rawCompressedData = null;
    this.keyMeta = null;

    this.setupSignalingHandlers();
  }

  setupSignalingHandlers() {
    this.signaling.on('status', (msg) => this.onStatus(msg));
    this.signaling.on('error', (err) => this.onError(err));

    this.signaling.on('room_joined', (data) => {
      if (data.peer_count >= 2 && this.role === 'sender') {
        this.startWebRTCSender();
      }
    });

    this.signaling.on('webrtc_offer', async ({ offer }) => {
      if (this.role === 'receiver') {
        await this.handleWebRTCOffer(offer);
      }
    });

    this.signaling.on('webrtc_answer', async ({ answer }) => {
      if (this.role === 'sender' && this.peerManager?.peerConnection) {
        await this.peerManager.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    this.signaling.on('ice_candidate', async ({ candidate }) => {
      if (this.peerManager?.peerConnection && candidate) {
        try {
          await this.peerManager.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      }
    });

    this.signaling.on('transfer_meta', ({ meta }) => {
      if (this.role === 'receiver') {
        this.fileMeta = meta;
        this.receiverChannel = new ReceiverChannel({
          fileMeta: meta,
          onProgress: (p) => this.onProgress({ ...p, connectionMode: this.connectionMode }),
          onStatus: (s) => this.onStatus(s),
          onComplete: (data) => this.onComplete({ ...data, mode: this.connectionMode }),
          onError: (err) => this.onError(err)
        });
        this.onStatus(`Received file metadata: ${meta.originalName} (${meta.totalChunks} chunks)`);
      }
    });

    this.signaling.on('request_resume', ({ last_chunk_index }) => {
      if (this.role === 'sender' && this.senderChannel) {
        this.senderChannel.sentChunkIndex = last_chunk_index + 1;
        this.onStatus(`Resuming transfer from chunk ${this.senderChannel.sentChunkIndex}...`);
        this.senderChannel.startSending();
      }
    });
  }

  async initSignaling() {
    return await this.signaling.connect();
  }

  createPeerConnection() {
    this.peerManager = new PeerManager({
      onIceCandidate: (candidate) => {
        this.signaling.emit('ice_candidate', { room: this.roomCode, candidate });
      },
      onConnectionStateChange: (state) => {
        this.onStatus(`ICE State: ${state}`);
      },
      onModeDetected: (mode) => {
        this.connectionMode = mode;
        this.onConnectionMode(mode);
      }
    });

    return this.peerManager.createPeerConnection();
  }

  async startWebRTCSender() {
    const pc = this.createPeerConnection();

    this.dataChannel = pc.createDataChannel('fileTransfer', { ordered: true });
    this.dataChannel.binaryType = 'arraybuffer';
    this.setupDataChannelEvents();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.signaling.emit('webrtc_offer', { room: this.roomCode, offer });
  }

  async handleWebRTCOffer(offer) {
    const pc = this.createPeerConnection();

    pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.dataChannel.binaryType = 'arraybuffer';
      this.setupDataChannelEvents();
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.signaling.emit('webrtc_answer', { room: this.roomCode, answer });
  }

  setupDataChannelEvents() {
    this.dataChannel.onopen = () => {
      this.onStatus('WebRTC DataChannel connected.');
      if (this.role === 'sender') {
        if (!this.fileMeta || !this.rawCompressedData) {
          this.onStatus('Peer connected. REST download remains the reliable path.');
          return;
        }
        this.sendTransferMeta();
        this.senderChannel = new SenderChannel({
          dataChannel: this.dataChannel,
          rawCompressedData: this.rawCompressedData,
          encryptionKey: this.encryptionKey,
          keyMeta: this.keyMeta,
          totalChunks: this.fileMeta.totalChunks,
          onProgress: (p) => this.onProgress({ ...p, connectionMode: this.connectionMode }),
          onStatus: (s) => this.onStatus(s),
          onComplete: () => this.onComplete({ mode: this.connectionMode, meta: this.fileMeta })
        });
        this.senderChannel.startSending();
      }
    };

    this.dataChannel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pause') {
          this.senderChannel?.pause();
          this.onStatus('Transfer paused by remote peer');
        } else if (msg.type === 'resume') {
          this.senderChannel?.resume();
          this.onStatus('Transfer resumed');
        }
      } else {
        if (this.receiverChannel) {
          await this.receiverChannel.handleIncomingChunk(new Uint8Array(event.data));
        }
      }
    };

    this.dataChannel.onclose = () => this.onStatus('DataChannel closed');
    this.dataChannel.onerror = (err) => this.onError(`DataChannel error: ${err}`);
  }

  async prepareFile(file, password) {
    this.file = file;
    this.onStatus('Compressing file with Gzip before WebRTC chunking...');

    const arrayBuffer = await file.arrayBuffer();
    const rawBytes = new Uint8Array(arrayBuffer);
    this.rawCompressedData = await compressData(rawBytes);

    const { key, iv, salt, password: genPassword } = await generateKey();
    const effectivePassword = password || genPassword;
    this.encryptionKey = key;
    this.keyMeta = { iv, salt, password: effectivePassword };

    const chunkSize = 64 * 1024;
    const totalChunks = Math.ceil(this.rawCompressedData.length / chunkSize);

    this.fileMeta = {
      originalName: file.name,
      originalSize: file.size,
      compressedSize: this.rawCompressedData.length,
      totalChunks,
      iv: bytesToHex(iv),
      salt: bytesToHex(salt),
      password: effectivePassword
    };

    return this.fileMeta;
  }

  sendTransferMeta() {
    if (this.fileMeta) {
      this.signaling.emit('transfer_meta', { room: this.roomCode, meta: this.fileMeta });
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({ type: 'meta', meta: this.fileMeta }));
      }
    }
  }

  pause() {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ type: 'pause' }));
    }
    this.senderChannel?.pause();
    this.onStatus('Transfer paused');
  }

  resume() {
    if (this.role === 'receiver') {
      this.signaling.emit('request_resume', {
        room: this.roomCode,
        last_chunk_index: (this.receiverChannel?.receivedChunks.size || 0) - 1
      });
    } else if (this.role === 'sender') {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({ type: 'resume' }));
      }
      this.senderChannel?.resume();
    }
    this.onStatus('Resuming transfer...');
  }

  destroy() {
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch (_) {}
    }
    this.peerManager?.close();
    this.signaling.disconnect();
  }
}
