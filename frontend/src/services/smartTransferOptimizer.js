/**
 * Smart Transfer Optimization Engine for FileShare
 *
 * Automatically analyzes selected file(s), detects metadata and exact size,
 * enforces the 1 GB maximum individual file size limit, and dynamically assigns:
 * - Transfer Mode
 * - Chunk Size
 * - Buffer Level / Threshold
 * - Max Chunk Parallelism
 * - Multi-file Queue Strategy
 */

export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB (1,073,741,824 bytes)

export const KB = 1024;
export const MB = 1024 * 1024;
export const GB = 1024 * 1024 * 1024;

/**
 * Default Optimization Table Specification
 */
export const OPTIMIZATION_TIERS = [
  {
    minSize: 0,
    maxSize: 1 * MB,
    mode: 'Direct',
    chunkSize: null, // No chunking for tiny files (< 1MB)
    chunkSizeLabel: 'None',
    bufferLevel: 'Minimal',
    bufferThreshold: 256 * KB,
    maxParallelism: 1,
    description: 'Instant direct payload transfer with minimal memory footprint.'
  },
  {
    minSize: 1 * MB,
    maxSize: 25 * MB,
    mode: 'Small',
    chunkSize: 256 * KB,
    chunkSizeLabel: '256 KB',
    bufferLevel: 'Low',
    bufferThreshold: 512 * KB,
    maxParallelism: 1,
    description: 'Fast single-channel streaming with 256 KB chunking.'
  },
  {
    minSize: 25 * MB,
    maxSize: 50 * MB,
    mode: 'Standard',
    chunkSize: 512 * KB,
    chunkSizeLabel: '512 KB',
    bufferLevel: 'Low',
    bufferThreshold: 512 * KB,
    maxParallelism: 1,
    description: 'Standard streaming with 512 KB slices and low buffer ceiling.'
  },
  {
    minSize: 50 * MB,
    maxSize: 100 * MB,
    mode: 'Standard+',
    chunkSize: 768 * KB,
    chunkSizeLabel: '768 KB',
    bufferLevel: 'Medium',
    bufferThreshold: 1 * MB,
    maxParallelism: 1,
    description: 'Enhanced throughput with 768 KB chunking and medium buffering.'
  },
  {
    minSize: 100 * MB,
    maxSize: 200 * MB,
    mode: 'Large',
    chunkSize: 1 * MB,
    chunkSizeLabel: '1 MB',
    bufferLevel: 'Medium',
    bufferThreshold: 1 * MB,
    maxParallelism: 2,
    description: 'Parallel stream with 1 MB chunks and dual in-flight buffers.'
  },
  {
    minSize: 200 * MB,
    maxSize: 300 * MB,
    mode: 'Large+',
    chunkSize: 1.25 * MB,
    chunkSizeLabel: '1.25 MB',
    bufferLevel: 'Medium',
    bufferThreshold: 1 * MB,
    maxParallelism: 2,
    description: 'Dual-chunk streaming with 1.25 MB slices.'
  },
  {
    minSize: 300 * MB,
    maxSize: 400 * MB,
    mode: 'High',
    chunkSize: 1.5 * MB,
    chunkSizeLabel: '1.5 MB',
    bufferLevel: 'Medium',
    bufferThreshold: 1 * MB,
    maxParallelism: 2,
    description: 'High-speed pipeline with 1.5 MB chunking and dual parallelism.'
  },
  {
    minSize: 400 * MB,
    maxSize: 500 * MB,
    mode: 'High+',
    chunkSize: 2 * MB,
    chunkSizeLabel: '2 MB',
    bufferLevel: 'High',
    bufferThreshold: 2 * MB,
    maxParallelism: 2,
    description: '2 MB streaming chunks with high backpressure capacity.'
  },
  {
    minSize: 500 * MB,
    maxSize: 600 * MB,
    mode: 'Optimized',
    chunkSize: 2.25 * MB,
    chunkSizeLabel: '2.25 MB',
    bufferLevel: 'High',
    bufferThreshold: 2 * MB,
    maxParallelism: 2,
    description: 'Optimized high-volume transfer with 2.25 MB chunk slices.'
  },
  {
    minSize: 600 * MB,
    maxSize: 700 * MB,
    mode: 'Optimized+',
    chunkSize: 2.5 * MB,
    chunkSizeLabel: '2.5 MB',
    bufferLevel: 'High',
    bufferThreshold: 2 * MB,
    maxParallelism: 3,
    description: 'Triple in-flight chunk pipeline with 2.5 MB slices.'
  },
  {
    minSize: 700 * MB,
    maxSize: 800 * MB,
    mode: 'Performance',
    chunkSize: 2.75 * MB,
    chunkSizeLabel: '2.75 MB',
    bufferLevel: 'High',
    bufferThreshold: 2 * MB,
    maxParallelism: 3,
    description: 'Maximum multi-channel stream with 2.75 MB chunks.'
  },
  {
    minSize: 800 * MB,
    maxSize: 900 * MB,
    mode: 'Performance+',
    chunkSize: 3 * MB,
    chunkSizeLabel: '3 MB',
    bufferLevel: 'High',
    bufferThreshold: 2 * MB,
    maxParallelism: 3,
    description: 'High-throughput 3 MB chunks with triple chunk parallelism.'
  },
  {
    minSize: 900 * MB,
    maxSize: 1 * GB,
    mode: 'Maximum',
    chunkSize: 3.25 * MB,
    chunkSizeLabel: '3.25 MB',
    bufferLevel: 'High',
    bufferThreshold: 2 * MB,
    maxParallelism: 3,
    description: 'Maximum throughput configuration for files approaching 1 GB.'
  }
];

export class SmartTransferOptimizer {
  /**
   * Format bytes to human readable format
   */
  static formatSize(bytes) {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Validate single file against 1 GB maximum limit
   */
  static validateFile(file) {
    if (!file) {
      return {
        valid: false,
        error: 'No file provided.',
        code: 'FILE_EMPTY'
      };
    }

    const size = file.size ?? 0;
    const name = file.name || 'unnamed_file';

    if (size < 0) {
      return {
        valid: false,
        error: `Invalid file size for ${name}.`,
        code: 'FILE_INVALID'
      };
    }

    if (size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File Too Large\n\nMaximum file size: 1 GB\nSelected file (${this.formatSize(size)}) exceeds maximum allowed limit of 1 GB.\n\nPlease select a smaller file.`,
        title: 'File Too Large',
        maxLimit: '1 GB',
        actualSize: this.formatSize(size),
        code: 'FILE_TOO_LARGE'
      };
    }

    return {
      valid: true,
      error: null,
      code: 'OK'
    };
  }

  /**
   * Determine matching tier for a given file size
   */
  static getTier(fileSize) {
    const size = Math.max(0, fileSize || 0);

    if (size > MAX_FILE_SIZE_BYTES) {
      return {
        mode: 'Reject',
        chunkSize: null,
        chunkSizeLabel: '—',
        bufferLevel: '—',
        bufferThreshold: 0,
        maxParallelism: 0,
        description: 'Selected file exceeds the 1 GB maximum limit.',
        valid: false
      };
    }

    for (const tier of OPTIMIZATION_TIERS) {
      // 0 MB to 1 MB includes 0 and up to 1 MB inclusive
      if (tier.minSize === 0 && size <= tier.maxSize) {
        return { ...tier, valid: true };
      }
      if (size > tier.minSize && size <= tier.maxSize) {
        return { ...tier, valid: true };
      }
    }

    // Default to last valid tier if within 1 GB
    const last = OPTIMIZATION_TIERS[OPTIMIZATION_TIERS.length - 1];
    return { ...last, valid: true };
  }

  /**
   * Get transfer mode name
   */
  static getTransferMode(fileSize) {
    return this.getTier(fileSize).mode;
  }

  /**
   * Get chunk size in bytes (or null for Direct)
   */
  static getChunkSize(fileSize) {
    return this.getTier(fileSize).chunkSize;
  }

  /**
   * Get buffer policy details
   */
  static getBufferPolicy(fileSize) {
    const tier = this.getTier(fileSize);
    return {
      level: tier.bufferLevel,
      threshold: tier.bufferThreshold
    };
  }

  /**
   * Get maximum chunk parallelism
   */
  static getMaxParallelism(fileSize) {
    return this.getTier(fileSize).maxParallelism;
  }

  /**
   * Full analysis of an individual file
   */
  static analyzeFile(file) {
    if (!file) return null;

    const validation = this.validateFile(file);
    const size = file.size ?? 0;
    const name = file.name || 'unnamed_file';
    const mimeType = file.type || 'application/octet-stream';
    const tier = this.getTier(size);

    return {
      fileName: name,
      fileSize: size,
      formattedSize: this.formatSize(size),
      mimeType,
      mode: tier.mode,
      chunkSize: tier.chunkSize,
      chunkSizeLabel: tier.chunkSizeLabel,
      bufferLevel: tier.bufferLevel,
      bufferThreshold: tier.bufferThreshold,
      maxParallelism: tier.maxParallelism,
      description: tier.description,
      valid: validation.valid,
      validationError: validation.error,
      isSmartOptimized: true,
      customOverridden: false
    };
  }

  /**
   * Determine multiple-file transfer strategy
   */
  static getQueueStrategy(fileCount, hasLargeFiles) {
    if (fileCount <= 1) {
      return {
        strategy: 'Normal Smart Optimization',
        concurrency: 1,
        description: 'Single-file smart transfer stream.'
      };
    }
    if (fileCount <= 5) {
      return {
        strategy: 'Queue files, one active large file',
        concurrency: 1,
        description: 'Sequential execution for large files, active queue.'
      };
    }
    if (fileCount <= 20) {
      return {
        strategy: 'Queue + one active file',
        concurrency: 1,
        description: 'Ordered queue with single active file pipeline.'
      };
    }
    return {
      strategy: 'Queue + sequential processing',
      concurrency: 1,
      description: 'Controlled sequential batch processing.'
    };
  }

  /**
   * Analyze an array of files as a batch
   */
  static analyzeBatch(files) {
    const fileArray = Array.from(files || []);
    if (fileArray.length === 0) {
      return {
        files: [],
        fileCount: 0,
        totalSize: 0,
        formattedTotalSize: '0 B',
        allValid: false,
        rejectedFiles: [],
        hasLargeFiles: false,
        strategy: 'Normal Smart Optimization',
        queueStrategy: null
      };
    }

    let totalSize = 0;
    let hasLargeFiles = false;
    const analyses = [];
    const rejectedFiles = [];

    for (const f of fileArray) {
      const analysis = this.analyzeFile(f);
      analyses.push(analysis);
      totalSize += f.size || 0;

      if (!analysis.valid) {
        rejectedFiles.push({ file: f, reason: analysis.validationError });
      }

      // Files >= 25 MB are considered large files for queue sequencing
      if ((f.size || 0) >= 25 * MB) {
        hasLargeFiles = true;
      }
    }

    const queueStrategy = this.getQueueStrategy(fileArray.length, hasLargeFiles);

    return {
      files: analyses,
      fileCount: fileArray.length,
      totalSize,
      formattedTotalSize: this.formatSize(totalSize),
      allValid: rejectedFiles.length === 0,
      rejectedFiles,
      hasLargeFiles,
      strategy: queueStrategy.strategy,
      queueStrategy,
      isSmartOptimized: true
    };
  }
}
