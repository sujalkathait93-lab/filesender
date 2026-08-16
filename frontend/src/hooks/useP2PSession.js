/**
 * Optional same-time P2P signaling using existing WebRTCSession.
 * REST remains the reliable path if signaling or NAT fails.
 */
import { useCallback, useRef, useState } from 'react';
import { WebRTCSession } from '../webrtc';

export function useP2PSession() {
  const sessionRef = useRef(null);
  const [p2pStatus, setP2pStatus] = useState('');
  const [p2pState, setP2pState] = useState('idle');

  const stopP2P = useCallback(() => {
    try { sessionRef.current?.destroy(); } catch (_) {}
    sessionRef.current = null;
    setP2pState('idle');
    setP2pStatus('');
  }, []);

  const startP2P = useCallback(async (roomCode, role = 'sender') => {
    if (!roomCode) return;
    stopP2P();
    setP2pState('waiting');
    setP2pStatus('Waiting for peer…');
    const session = new WebRTCSession({
      roomCode: String(roomCode).toLowerCase(),
      role,
      onStatus: (msg) => {
        setP2pStatus(msg);
        const lower = String(msg || '').toLowerCase();
        if (lower.includes('datachannel connected') || lower.includes('ice state: connected') || lower.includes('peer connected')) {
          setP2pState('connected');
        }
      },
      onError: (err) => {
        setP2pState('error');
        setP2pStatus(typeof err === 'string' ? err : (err?.message || 'P2P signaling failed. Use REST download.'));
      },
      onComplete: () => setP2pState('connected'),
    });
    sessionRef.current = session;
    try {
      const joined = await session.initSignaling();
      if ((joined?.peer_count || 1) >= 2) {
        setP2pState('connected');
        setP2pStatus('Peer in room. Direct P2P may start; REST download still works.');
      } else {
        setP2pState('waiting');
        setP2pStatus(role === 'sender'
          ? 'Waiting for peer… Keep this tab open. REST share still works.'
          : 'Waiting for sender… If they are offline, use Save & Download.');
      }
    } catch (_) {
      setP2pState('error');
      setP2pStatus('P2P signaling unavailable (common on Vercel). REST download is the default.');
    }
  }, [stopP2P]);

  return { p2pStatus, p2pState, startP2P, stopP2P };
}
