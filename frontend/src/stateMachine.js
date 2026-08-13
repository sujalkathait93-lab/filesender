/**
 * SecureShare Transfer State Machine
 * Formalized states and transitions for file sender and receiver sessions.
 */

export const TransferState = {
  IDLE: 'IDLE',
  SELECTING: 'SELECTING',
  VALIDATING: 'VALIDATING',
  PREPARING: 'PREPARING',
  PROCESSING: 'PROCESSING',
  CREATING_TRANSFER: 'CREATING_TRANSFER',
  WAITING_FOR_RECEIVER: 'WAITING_FOR_RECEIVER',
  CONNECTING: 'CONNECTING',
  TRANSFERRING: 'TRANSFERRING',
  VERIFYING: 'VERIFYING',
  FINALIZING: 'FINALIZING',
  DOWNLOAD_READY: 'DOWNLOAD_READY',
  COMPLETED: 'COMPLETED',
  CLEANUP: 'CLEANUP',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

const STATE_TRANSITIONS = {
  [TransferState.IDLE]: [TransferState.SELECTING, TransferState.CONNECTING, TransferState.FAILED],
  [TransferState.SELECTING]: [TransferState.IDLE, TransferState.VALIDATING, TransferState.CANCELLED],
  [TransferState.VALIDATING]: [TransferState.SELECTING, TransferState.PREPARING, TransferState.FAILED, TransferState.CANCELLED],
  [TransferState.PREPARING]: [TransferState.PROCESSING, TransferState.FAILED, TransferState.CANCELLED],
  [TransferState.PROCESSING]: [TransferState.CREATING_TRANSFER, TransferState.FAILED, TransferState.CANCELLED],
  [TransferState.CREATING_TRANSFER]: [TransferState.WAITING_FOR_RECEIVER, TransferState.CONNECTING, TransferState.FAILED, TransferState.CANCELLED],
  [TransferState.WAITING_FOR_RECEIVER]: [TransferState.CONNECTING, TransferState.EXPIRED, TransferState.CANCELLED, TransferState.FAILED],
  [TransferState.CONNECTING]: [TransferState.TRANSFERRING, TransferState.FAILED, TransferState.CANCELLED, TransferState.EXPIRED],
  [TransferState.TRANSFERRING]: [TransferState.VERIFYING, TransferState.FAILED, TransferState.CANCELLED, TransferState.EXPIRED],
  [TransferState.VERIFYING]: [TransferState.FINALIZING, TransferState.FAILED, TransferState.CANCELLED],
  [TransferState.FINALIZING]: [TransferState.DOWNLOAD_READY, TransferState.COMPLETED, TransferState.FAILED],
  [TransferState.DOWNLOAD_READY]: [TransferState.COMPLETED, TransferState.CLEANUP, TransferState.EXPIRED, TransferState.FAILED],
  [TransferState.COMPLETED]: [TransferState.CLEANUP],
  [TransferState.CLEANUP]: [TransferState.IDLE],
  [TransferState.EXPIRED]: [TransferState.IDLE, TransferState.CLEANUP],
  [TransferState.FAILED]: [TransferState.IDLE, TransferState.CLEANUP],
  [TransferState.CANCELLED]: [TransferState.IDLE, TransferState.CLEANUP]
};

const USER_MESSAGES = {
  [TransferState.IDLE]: 'Ready',
  [TransferState.SELECTING]: 'Selecting files',
  [TransferState.VALIDATING]: 'Validating files',
  [TransferState.PREPARING]: 'Preparing transfer',
  [TransferState.PROCESSING]: 'Encrypting and processing files',
  [TransferState.CREATING_TRANSFER]: 'Generating transfer session',
  [TransferState.WAITING_FOR_RECEIVER]: 'Waiting for receiver',
  [TransferState.CONNECTING]: 'Establishing secure connection',
  [TransferState.TRANSFERRING]: 'Sending files',
  [TransferState.VERIFYING]: 'Verifying file integrity',
  [TransferState.FINALIZING]: 'Finalizing transfer',
  [TransferState.DOWNLOAD_READY]: 'Ready for download',
  [TransferState.COMPLETED]: 'Transfer complete',
  [TransferState.CLEANUP]: 'Cleaning up session',
  [TransferState.EXPIRED]: 'Transfer code expired',
  [TransferState.FAILED]: 'Transfer failed',
  [TransferState.CANCELLED]: 'Transfer cancelled'
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
    if (!this.canTransitionTo(nextState)) {
      console.warn(`Invalid state transition attempted: ${this.currentState} -> ${nextState}`);
      if (![TransferState.FAILED, TransferState.CANCELLED, TransferState.EXPIRED, TransferState.CLEANUP].includes(nextState)) {
        return false;
      }
    }

    const prevState = this.currentState;
    this.currentState = nextState;
    this.history.push(nextState);

    if (typeof this.onStateChange === 'function') {
      this.onStateChange({
        currentState: this.currentState,
        prevState,
        userMessage: USER_MESSAGES[nextState] || nextState,
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
    return [TransferState.COMPLETED, TransferState.EXPIRED, TransferState.FAILED, TransferState.CANCELLED].includes(this.currentState);
  }
}
