/**
 * Transfer Queue Manager for FileShare
 *
 * Implements safe, orderly file queueing and sequential execution
 * ensuring File Parallelism (1 active large file transfer) and
 * real-time progress aggregation for multi-file transfers.
 */

import { SmartTransferOptimizer } from './smartTransferOptimizer.js';

export const QueueItemStatus = {
  READY: 'ready',
  QUEUED: 'queued',
  ENCRYPTING: 'encrypting',
  TRANSFERRING: 'transferring',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

export class TransferQueueManager {
  constructor({
    onQueueUpdate,
    onOverallProgress,
    onActiveFileProgress,
    onFileComplete,
    onQueueComplete,
    onError
  } = {}) {
    this.items = [];
    this.currentIndex = -1;
    this.isRunning = false;
    this.isPaused = false;
    this.isCancelled = false;

    this.onQueueUpdate = onQueueUpdate || (() => {});
    this.onOverallProgress = onOverallProgress || (() => {});
    this.onActiveFileProgress = onActiveFileProgress || (() => {});
    this.onFileComplete = onFileComplete || (() => {});
    this.onQueueComplete = onQueueComplete || (() => {});
    this.onError = onError || (() => {});
  }

  /**
   * Set or update files in the queue
   */
  setFiles(files) {
    const fileArray = Array.from(files || []);
    this.items = fileArray.map((file, index) => {
      const smartConfig = SmartTransferOptimizer.analyzeFile(file);
      return {
        id: `queue_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        smartConfig,
        status: QueueItemStatus.READY,
        progress: 0,
        transferredBytes: 0,
        speedBytesPerSec: 0,
        etaSeconds: 0,
        error: null,
        result: null
      };
    });

    this.currentIndex = -1;
    this.notifyQueueUpdate();
  }

  /**
   * Add additional files to queue
   */
  addFiles(newFiles) {
    const raw = Array.from(newFiles || []);
    const startIndex = this.items.length;
    const newItems = raw.map((file, idx) => {
      const smartConfig = SmartTransferOptimizer.analyzeFile(file);
      return {
        id: `queue_${Date.now()}_${startIndex + idx}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        smartConfig,
        status: QueueItemStatus.READY,
        progress: 0,
        transferredBytes: 0,
        speedBytesPerSec: 0,
        etaSeconds: 0,
        error: null,
        result: null
      };
    });

    this.items = [...this.items, ...newItems];
    this.notifyQueueUpdate();
  }

  /**
   * Remove item at index
   */
  removeItem(index) {
    if (index >= 0 && index < this.items.length) {
      this.items = this.items.filter((_, i) => i !== index);
      this.notifyQueueUpdate();
    }
  }

  /**
   * Clear the entire queue
   */
  clear() {
    this.items = [];
    this.currentIndex = -1;
    this.isRunning = false;
    this.isPaused = false;
    this.isCancelled = false;
    this.notifyQueueUpdate();
  }

  /**
   * Get overall batch transfer progress
   */
  getOverallProgress() {
    if (this.items.length === 0) {
      return {
        percent: 0,
        completedCount: 0,
        totalCount: 0,
        totalBytes: 0,
        transferredBytes: 0,
        speedBytesPerSec: 0,
        etaSeconds: 0
      };
    }

    const totalBytes = this.items.reduce((acc, item) => acc + (item.size || 0), 0);
    const transferredBytes = this.items.reduce((acc, item) => acc + (item.transferredBytes || 0), 0);
    const completedCount = this.items.filter(item => item.status === QueueItemStatus.COMPLETED).length;
    const percent = totalBytes > 0 ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : 0;

    const activeItem = this.getActiveItem();
    const speedBytesPerSec = activeItem ? activeItem.speedBytesPerSec : 0;
    const remainingBytes = Math.max(0, totalBytes - transferredBytes);
    const etaSeconds = speedBytesPerSec > 0 ? Math.ceil(remainingBytes / speedBytesPerSec) : 0;

    return {
      percent,
      completedCount,
      totalCount: this.items.length,
      totalBytes,
      transferredBytes,
      speedBytesPerSec,
      etaSeconds,
      activeItem
    };
  }

  /**
   * Get currently active item
   */
  getActiveItem() {
    if (this.currentIndex >= 0 && this.currentIndex < this.items.length) {
      return this.items[this.currentIndex];
    }
    return null;
  }

  /**
   * Update active file progress
   */
  updateItemProgress(index, { percent, transferredBytes, speedBytesPerSec, etaSeconds, stage }) {
    if (index >= 0 && index < this.items.length) {
      const item = this.items[index];
      item.progress = percent;
      item.transferredBytes = transferredBytes !== undefined ? transferredBytes : Math.round((percent / 100) * item.size);
      if (speedBytesPerSec !== undefined) item.speedBytesPerSec = speedBytesPerSec;
      if (etaSeconds !== undefined) item.etaSeconds = etaSeconds;
      if (stage) item.stage = stage;

      this.onActiveFileProgress({ item, index, percent, transferredBytes: item.transferredBytes, speedBytesPerSec: item.speedBytesPerSec, etaSeconds: item.etaSeconds });
      this.onOverallProgress(this.getOverallProgress());
    }
  }

  /**
   * Mark item status
   */
  setItemStatus(index, status, extra = {}) {
    if (index >= 0 && index < this.items.length) {
      const item = this.items[index];
      item.status = status;
      Object.assign(item, extra);

      if (status === QueueItemStatus.COMPLETED) {
        item.progress = 100;
        item.transferredBytes = item.size;
        this.onFileComplete({ item, index });
      }

      this.notifyQueueUpdate();
      this.onOverallProgress(this.getOverallProgress());
    }
  }

  notifyQueueUpdate() {
    this.onQueueUpdate([...this.items]);
  }

  cancel() {
    this.isCancelled = true;
    this.isRunning = false;
    if (this.currentIndex >= 0 && this.currentIndex < this.items.length) {
      this.items[this.currentIndex].status = QueueItemStatus.CANCELLED;
    }
    this.notifyQueueUpdate();
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }
}
