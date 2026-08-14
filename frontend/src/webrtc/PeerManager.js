/**
 * SecureShare Peer Connection Manager
 * Manages RTCPeerConnection lifecycle, ICE servers, and mode detection (LAN / STUN / TURN).
 */

export class PeerManager {
  constructor({ iceServers, onIceCandidate, onConnectionStateChange, onModeDetected }) {
    this.iceServers = iceServers || [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ];
    this.onIceCandidate = onIceCandidate;
    this.onConnectionStateChange = onConnectionStateChange;
    this.onModeDetected = onModeDetected;
    this.peerConnection = null;
    this.connectionMode = 'detecting';
  }

  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      this.onConnectionStateChange?.(state);

      if (state === 'connected' || state === 'completed') {
        this.detectConnectionMode();
      } else if (state === 'failed' || state === 'disconnected') {
        this.onModeDetected?.('cloud-fallback');
      }
    };

    return this.peerConnection;
  }

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
      this.onModeDetected?.(mode);
    } catch (_) {
      this.connectionMode = 'wan-stun';
      this.onModeDetected?.('wan-stun');
    }
  }

  close() {
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch (_) {}
    }
  }
}
