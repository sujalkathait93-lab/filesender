/**
 * SecureShare Transfer State Machine (LLD: Session Manager)
 * Formalized states and transitions for file sender and receiver sessions.
 * Canonical Pipeline:
 * SELECT -> VALIDATE -> PREPARE -> CONNECT -> TRANSFER -> VERIFY -> PREVIEW -> DOWNLOAD -> COMPLETE -> CLEANUP
 */

export const TransferState = {
  IDLE: 'IDLE',
  SELECT: 'SELECT',
  VALIDATE: 'VALIDATE',
  PREPARE: 'PREPARE',
  PROCESSING: 'PROCESSING',
  CREATING_TRANSFER: 'CREATING_TRANSFER',
  WAITING_FOR_RECEIVER: 'WAITING_FOR_RECEIVER',
  CONNECT: 'CONNECT',
  TRANSFER: 'TRANSFER',
  VERIFY: 'VERIFY',
  PREVIEW: 'PREVIEW',
  DOWNLOAD: 'DOWNLOAD',
  COMPLETE: 'COMPLETE',
  CLEANUP: 'CLEANUP',

  // Failure & Termination States
  CANCELLED: 'CANCELLED',
  DISCONNECTED: 'DISCONNECTED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  EXPIRED: 'EXPIRED',
  CORRUPTED_CHUNK: 'CORRUPTED_CHUNK',
  TIMEOUT: 'TIMEOUT',
  FAILED: 'FAILED',

  // Aliases for backwards compatibility
  SELECTING: 'SELECT',
  VALIDATING: 'VALIDATE',
  PREPARING: 'PREPARE',
  CONNECTING: 'CONNECT',
  TRANSFERRING: 'TRANSFER',
  VERIFYING: 'VERIFY',
  DOWNLOAD_READY: 'DOWNLOAD',
  COMPLETED: 'COMPLETE'
};

const STATE_TRANSITIONS = {
  [TransferState.IDLE]: [
    TransferState.SELECT,
    TransferState.VALIDATE,
    TransferState.CONNECT,
    TransferState.FAILED
  ],
  [TransferState.SELECT]: [
    TransferState.IDLE,
    TransferState.VALIDATE,
    TransferState.CANCELLED,
    TransferState.FAILED
  ],
  [TransferState.VALIDATE]: [
    TransferState.SELECT,
    TransferState.PREPARE,
    TransferState.FAILED,
    TransferState.CANCELLED
  ],
  [TransferState.PREPARE]: [
    TransferState.PROCESSING,
    TransferState.CREATING_TRANSFER,
    TransferState.FAILED,
    TransferState.CANCELLED
  ],
  [TransferState.PROCESSING]: [
    TransferState.CREATING_TRANSFER,
    TransferState.FAILED,
    TransferState.CANCELLED
  ],
  [TransferState.CREATING_TRANSFER]: [
    TransferState.WAITING_FOR_RECEIVER,
    TransferState.CONNECT,
    TransferState.FAILED,
    TransferState.CANCELLED
  ],
  [TransferState.WAITING_FOR_RECEIVER]: [
    TransferState.CONNECT,
    TransferState.TRANSFER,
    TransferState.EXPIRED,
    TransferState.CANCELLED,
    TransferState.FAILED
  ],
  [TransferState.CONNECT]: [
    TransferState.TRANSFER,
    TransferState.INVALID_TOKEN,
    TransferState.DISCONNECTED,
    TransferState.TIMEOUT,
    TransferState.EXPIRED,
    TransferState.FAILED,
    TransferState.CANCELLED
  ],
  [TransferState.TRANSFER]: [
    TransferState.VERIFY,
    TransferState.CORRUPTED_CHUNK,
    TransferState.DISCONNECTED,
    TransferState.TIMEOUT,
    TransferState.EXPIRED,
    TransferState.FAILED,
    TransferState.CANCELLED
  ],
  [TransferState.VERIFY]: [
    TransferState.PREVIEW,
    TransferState.DOWNLOAD,
    TransferState.CORRUPTED_CHUNK,
    TransferState.FAILED,
    TransferState.CANCELLED
  ],
  [TransferState.PREVIEW]: [
    TransferState.DOWNLOAD,
    TransferState.COMPLETE,
    TransferState.CLEANUP,
    TransferState.EXPIRED,
    TransferState.CANCELLED,
    TransferState.FAILED
  ],
  [TransferState.DOWNLOAD]: [
    TransferState.PREVIEW,
    TransferState.COMPLETE,
    TransferState.CLEANUP,
    TransferState.EXPIRED,
    TransferState.FAILED,
    TransferState.CANCELLED
  ],
  [TransferState.COMPLETE]: [
    TransferState.CLEANUP,
    TransferState.IDLE
  ],
  [TransferState.CLEANUP]: [
    TransferState.IDLE
  ],

  // Terminal & Error States can transition to CLEANUP or IDLE
  [TransferState.CANCELLED]: [TransferState.IDLE, TransferState.CLEANUP],
  [TransferState.DISCONNECTED]: [TransferState.IDLE, TransferState.CONNECT, TransferState.CLEANUP],
  [TransferState.INVALID_TOKEN]: [TransferState.IDLE, TransferState.CLEANUP],
  [TransferState.EXPIRED]: [TransferState.IDLE, TransferState.CLEANUP],
  [TransferState.CORRUPTED_CHUNK]: [TransferState.IDLE, TransferState.TRANSFER, TransferState.CLEANUP],
  [TransferState.TIMEOUT]: [TransferState.IDLE, TransferState.CONNECT, TransferState.CLEANUP],
  [TransferState.FAILED]: [TransferState.IDLE, TransferState.CLEANUP]
};

const USER_MESSAGES = {
  [TransferState.IDLE]: 'Ready',
  [TransferState.SELECT]: 'Selecting files',
  [TransferState.VALIDATE]: 'Validating files',
  [TransferState.PREPARE]: 'Preparing transfer',
  [TransferState.PROCESSING]: 'Encrypting and processing files',
  [TransferState.CREATING_TRANSFER]: 'Generating transfer session',
  [TransferState.WAITING_FOR_RECEIVER]: 'Waiting for receiver',
  [TransferState.CONNECT]: 'Establishing secure connection',
  [TransferState.TRANSFER]: 'Transferring files',
  [TransferState.VERIFY]: 'Verifying file integrity',
  [TransferState.PREVIEW]: 'Viewing 30-second preview',
  [TransferState.DOWNLOAD]: 'Ready for download',
  [TransferState.COMPLETE]: 'Transfer complete',
  [TransferState.CLEANUP]: 'Cleaning up session',

  [TransferState.CANCELLED]: 'Transfer cancelled',
  [TransferState.DISCONNECTED]: 'Connection disconnected',
  [TransferState.INVALID_TOKEN]: 'Invalid transfer code or key',
  [TransferState.EXPIRED]: 'Transfer session expired',
  [TransferState.CORRUPTED_CHUNK]: 'Data corruption detected in chunk',
  [TransferState.TIMEOUT]: 'Connection timed out',
  [TransferState.FAILED]: 'Transfer failed'
};

export class TransferStateMachine {
  constructor(initialState = TransferState.IDLE, onStateChange = null) {
    this.currentState = initialState;
    this.onStateChange = onStateChange;
    this.history = [initialState];
  }

  canTransitionTo(nextState) {
    const allowed = STATE_TRANSITIONS[this.currentState] || [];
    return allowed.includes(nextState);
  }

  transitionTo(nextState, metadata = {}) {
    const resolvedNextState = TransferState[nextState] || nextState;

    if (!this.canTransitionTo(resolvedNextState)) {
      console.warn(`Invalid state transition attempted: ${this.currentState} -> ${resolvedNextState}`);
      // Safety escape hatch for error states
      const errorStates = [
        TransferState.FAILED, TransferState.CANCELLED, TransferState.EXPIRED,
        TransferState.CLEANUP, TransferState.DISCONNECTED, TransferState.INVALID_TOKEN,
        TransferState.CORRUPTED_CHUNK, TransferState.TIMEOUT
      ];
      if (!errorStates.includes(resolvedNextState)) {
        return false;
      }
    }

    const prevState = this.currentState;
    this.currentState = resolvedNextState;
    this.history.push(resolvedNextState);

    if (typeof this.onStateChange === 'function') {
      this.onStateChange({
        currentState: this.currentState,
        prevState,
        userMessage: USER_MESSAGES[resolvedNextState] || resolvedNextState,
        metadata
      });
    }
    return true;
  }

  getState() {
    return this.currentState;
  }

  getUserMessage() {
    return USER_MESSAGES[this.currentState] || this.currentState;
  }

  isTerminal() {
    return [
      TransferState.COMPLETE, TransferState.EXPIRED, TransferState.FAILED,
      TransferState.CANCELLED, TransferState.INVALID_TOKEN, TransferState.TIMEOUT
    ].includes(this.currentState);
  }
}
