/**
 * SecureShare WebRTC Signaling Client
 * Handles Socket.IO connection and event emission/listening.
 */

import { io } from 'socket.io-client';

const defaultSignalingUrl = (() => {
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SIGNALING_URL || import.meta.env.VITE_API_URL))
    ? String(import.meta.env.VITE_SIGNALING_URL || import.meta.env.VITE_API_URL).trim()
    : '';
  if (envUrl) return envUrl.replace(/\/+$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
})();

export class SignalingClient {
  constructor(serverUrl, roomCode, role) {
    this.serverUrl = (serverUrl ? String(serverUrl).trim().replace(/\/+$/, '') : '') || defaultSignalingUrl;
    this.roomCode = roomCode;
    this.role = role;
    this.socket = null;
    this.handlers = {};
  }

  on(event, callback) {
    this.handlers[event] = callback;
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10
      });

      this.socket.on('connect', () => {
        this.handlers.status?.('Connected to signaling server. Joining room...');
        this.socket.emit('join_room', { room: this.roomCode, role: this.role });
      });

      this.socket.on('room_joined', (data) => {
        this.handlers.status?.(`Joined transfer room ${this.roomCode} (${data.peer_count} peer(s))`);
        this.handlers.room_joined?.(data);
        resolve(data);
      });

      this.socket.on('webrtc_offer', (data) => this.handlers.webrtc_offer?.(data));
      this.socket.on('webrtc_answer', (data) => this.handlers.webrtc_answer?.(data));
      this.socket.on('ice_candidate', (data) => this.handlers.ice_candidate?.(data));
      this.socket.on('transfer_meta', (data) => this.handlers.transfer_meta?.(data));
      this.socket.on('request_resume', (data) => this.handlers.request_resume?.(data));
      this.socket.on('transfer_status', (data) => this.handlers.transfer_status?.(data));
      this.socket.on('peer_disconnected', (data) => this.handlers.peer_disconnected?.(data));

      this.socket.on('connect_error', (err) => {
        this.handlers.error?.(`Signaling error: ${err.message}`);
        reject(err);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.emit('leave_room', { room: this.roomCode });
        this.socket.disconnect();
      } catch (_) {}
    }
  }
}
