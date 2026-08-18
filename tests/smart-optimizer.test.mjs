/**
 * Unit & Integration Test Suite for:
 * Smart Transfer Optimization Engine
 * - 13 Size Range Table Tiers
 * - 1 GB Individual File Limits & Rejection
 * - Dynamic Chunk Sizing & Parallelism
 * - Transfer Queue Strategies & Sequencing
 * - Single-Chunk Retry & Backpressure Settings
 */

import { SmartTransferOptimizer, OPTIMIZATION_TIERS, MAX_FILE_SIZE_BYTES } from '../frontend/src/services/smartTransferOptimizer.js';
import { TransferQueueManager, QueueItemStatus } from '../frontend/src/services/transferQueue.js';
import { calculateTransferPlan, StreamBatchSender, StreamBatchReceiver } from '../frontend/src/chunkManager.js';
import { generateKey } from '../frontend/src/crypto.js';

let passed = 0;
let failed = 0;

function check(name, condition, extra = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

async function runTests() {
  console.log('== 1. Smart Transfer Optimization Table Verification (All 13 Tiers) ==');

  // Tier 1: 0 - 1 MB -> Direct
  const t1 = SmartTransferOptimizer.getTier(500 * KB);
  check('0-1 MB: Mode is Direct', t1.mode === 'Direct');
  check('0-1 MB: Chunk Size is None (null)', t1.chunkSize === null);
  check('0-1 MB: Buffer is Minimal', t1.bufferLevel === 'Minimal');
  check('0-1 MB: Max Parallelism is 1', t1.maxParallelism === 1);

  // Tier 2: 1 - 25 MB -> Small (256 KB)
  const t2 = SmartTransferOptimizer.getTier(15 * MB);
  check('1-25 MB: Mode is Small', t2.mode === 'Small');
  check('1-25 MB: Chunk Size is 256 KB', t2.chunkSize === 256 * KB);
  check('1-25 MB: Buffer is Low', t2.bufferLevel === 'Low');
  check('1-25 MB: Max Parallelism is 1', t2.maxParallelism === 1);

  // Tier 3: 25 - 50 MB -> Standard (512 KB)
  const t3 = SmartTransferOptimizer.getTier(40 * MB);
  check('25-50 MB: Mode is Standard', t3.mode === 'Standard');
  check('25-50 MB: Chunk Size is 512 KB', t3.chunkSize === 512 * KB);
  check('25-50 MB: Buffer is Low', t3.bufferLevel === 'Low');
  check('25-50 MB: Max Parallelism is 1', t3.maxParallelism === 1);

  // Tier 4: 50 - 100 MB -> Standard+ (768 KB)
  const t4 = SmartTransferOptimizer.getTier(75 * MB);
  check('50-100 MB: Mode is Standard+', t4.mode === 'Standard+');
  check('50-100 MB: Chunk Size is 768 KB', t4.chunkSize === 768 * KB);
  check('50-100 MB: Buffer is Medium', t4.bufferLevel === 'Medium');
  check('50-100 MB: Max Parallelism is 1', t4.maxParallelism === 1);

  // Tier 5: 100 - 200 MB -> Large (1 MB)
  const t5 = SmartTransferOptimizer.getTier(150 * MB);
  check('100-200 MB: Mode is Large', t5.mode === 'Large');
  check('100-200 MB: Chunk Size is 1 MB', t5.chunkSize === 1 * MB);
  check('100-200 MB: Buffer is Medium', t5.bufferLevel === 'Medium');
  check('100-200 MB: Max Parallelism is 2', t5.maxParallelism === 2);

  // Tier 6: 200 - 300 MB -> Large+ (1.25 MB)
  const t6 = SmartTransferOptimizer.getTier(250 * MB);
  check('200-300 MB: Mode is Large+', t6.mode === 'Large+');
  check('200-300 MB: Chunk Size is 1.25 MB', t6.chunkSize === 1.25 * MB);
  check('200-300 MB: Buffer is Medium', t6.bufferLevel === 'Medium');
  check('200-300 MB: Max Parallelism is 2', t6.maxParallelism === 2);

  // Tier 7: 300 - 400 MB -> High (1.5 MB)
  const t7 = SmartTransferOptimizer.getTier(350 * MB);
  check('300-400 MB: Mode is High', t7.mode === 'High');
  check('300-400 MB: Chunk Size is 1.5 MB', t7.chunkSize === 1.5 * MB);
  check('300-400 MB: Buffer is Medium', t7.bufferLevel === 'Medium');
  check('300-400 MB: Max Parallelism is 2', t7.maxParallelism === 2);

  // Tier 8: 400 - 500 MB -> High+ (2 MB)
  const t8 = SmartTransferOptimizer.getTier(450 * MB);
  check('400-500 MB: Mode is High+', t8.mode === 'High+');
  check('400-500 MB: Chunk Size is 2 MB', t8.chunkSize === 2 * MB);
  check('400-500 MB: Buffer is High', t8.bufferLevel === 'High');
  check('400-500 MB: Max Parallelism is 2', t8.maxParallelism === 2);

  // Tier 9: 500 - 600 MB -> Optimized (2.25 MB)
  const t9 = SmartTransferOptimizer.getTier(550 * MB);
  check('500-600 MB: Mode is Optimized', t9.mode === 'Optimized');
  check('500-600 MB: Chunk Size is 2.25 MB', t9.chunkSize === 2.25 * MB);
  check('500-600 MB: Buffer is High', t9.bufferLevel === 'High');
  check('500-600 MB: Max Parallelism is 2', t9.maxParallelism === 2);

  // Tier 10: 600 - 700 MB -> Optimized+ (2.5 MB)
  const t10 = SmartTransferOptimizer.getTier(650 * MB);
  check('600-700 MB: Mode is Optimized+', t10.mode === 'Optimized+');
  check('600-700 MB: Chunk Size is 2.5 MB', t10.chunkSize === 2.5 * MB);
  check('600-700 MB: Buffer is High', t10.bufferLevel === 'High');
  check('600-700 MB: Max Parallelism is 3', t10.maxParallelism === 3);

  // Tier 11: 700 - 800 MB -> Performance (2.75 MB)
  const t11 = SmartTransferOptimizer.getTier(750 * MB);
  check('700-800 MB: Mode is Performance', t11.mode === 'Performance');
  check('700-800 MB: Chunk Size is 2.75 MB', t11.chunkSize === 2.75 * MB);
  check('700-800 MB: Buffer is High', t11.bufferLevel === 'High');
  check('700-800 MB: Max Parallelism is 3', t11.maxParallelism === 3);

  // Tier 12: 800 - 900 MB -> Performance+ (3 MB)
  const t12 = SmartTransferOptimizer.getTier(850 * MB);
  check('800-900 MB: Mode is Performance+', t12.mode === 'Performance+');
  check('800-900 MB: Chunk Size is 3 MB', t12.chunkSize === 3 * MB);
  check('800-900 MB: Buffer is High', t12.bufferLevel === 'High');
  check('800-900 MB: Max Parallelism is 3', t12.maxParallelism === 3);

  // Tier 13: 900 MB - 1 GB -> Maximum (3.25 MB)
  const t13 = SmartTransferOptimizer.getTier(950 * MB);
  check('900 MB-1 GB: Mode is Maximum', t13.mode === 'Maximum');
  check('900 MB-1 GB: Chunk Size is 3.25 MB', t13.chunkSize === 3.25 * MB);
  check('900 MB-1 GB: Buffer is High', t13.bufferLevel === 'High');
  check('900 MB-1 GB: Max Parallelism is 3', t13.maxParallelism === 3);

  // Over 1 GB -> Reject
  const tReject = SmartTransferOptimizer.getTier(1.2 * GB);
  check('>1 GB: Mode is Reject', tReject.mode === 'Reject');
  check('>1 GB: Max Parallelism is 0', tReject.maxParallelism === 0);
  check('>1 GB: Valid is false', tReject.valid === false);

  console.log('== 2. Individual File Validation & Immediate 1 GB Limit Enforcement ==');
  const validFile = { name: 'document.pdf', size: 50 * MB, type: 'application/pdf' };
  const vValid = SmartTransferOptimizer.validateFile(validFile);
  check('50 MB file is valid', vValid.valid === true && vValid.error === null);

  const oversizedFile = { name: 'huge_archive.zip', size: 1.25 * GB, type: 'application/zip' };
  const vOver = SmartTransferOptimizer.validateFile(oversizedFile);
  check('1.25 GB file is rejected', vOver.valid === false);
  check('Rejection error includes friendly title & limit', vOver.error.includes('File Too Large') && vOver.error.includes('1 GB'));

  const analysis = SmartTransferOptimizer.analyzeFile(validFile);
  check('analyzeFile returns complete metadata', analysis.fileName === 'document.pdf' && analysis.mode === 'Standard' && analysis.isSmartOptimized === true);

  console.log('== 3. Multi-File Transfer Strategy & Queue Analysis ==');
  // 1 file strategy
  const b1 = SmartTransferOptimizer.analyzeBatch([validFile]);
  check('1 file strategy is Normal Smart Optimization', b1.strategy === 'Normal Smart Optimization');

  // 2-5 files strategy
  const b2 = SmartTransferOptimizer.analyzeBatch([
    { name: 'f1.jpg', size: 2 * MB },
    { name: 'f2.pdf', size: 15 * MB },
    { name: 'f3.mp4', size: 500 * MB },
    { name: 'f4.zip', size: 900 * MB }
  ]);
  check('4 files strategy: Queue files, one active large file', b2.strategy === 'Queue files, one active large file');
  check('4 files hasLargeFiles is true', b2.hasLargeFiles === true);
  check('4 files allValid is true', b2.allValid === true);
  check('4 files total size formatted accurately', b2.totalSize === (2 + 15 + 500 + 900) * MB);

  // 6-20 files strategy
  const b6 = SmartTransferOptimizer.analyzeBatch(Array.from({ length: 10 }, (_, i) => ({ name: `f${i}.txt`, size: 1 * MB })));
  check('10 files strategy: Queue + one active file', b6.strategy === 'Queue + one active file');

  // 20+ files strategy
  const b25 = SmartTransferOptimizer.analyzeBatch(Array.from({ length: 25 }, (_, i) => ({ name: `f${i}.txt`, size: 100 * KB })));
  check('25 files strategy: Queue + sequential processing', b25.strategy === 'Queue + sequential processing');

  console.log('== 4. Transfer Queue Manager Lifecycle & Aggregation ==');
  const queue = new TransferQueueManager();
  queue.setFiles([
    { name: 'a.jpg', size: 10 * MB, type: 'image/jpeg' },
    { name: 'b.mp4', size: 200 * MB, type: 'video/mp4' }
  ]);

  check('queue initialized with 2 items', queue.items.length === 2);
  check('first item status is ready', queue.items[0].status === QueueItemStatus.READY);

  queue.currentIndex = 0;
  queue.setItemStatus(0, QueueItemStatus.TRANSFERRING);
  queue.updateItemProgress(0, { percent: 50, transferredBytes: 5 * MB, speedBytesPerSec: 2 * MB, etaSeconds: 3 });

  const prog = queue.getOverallProgress();
  check('overall progress calculated correctly', prog.completedCount === 0 && prog.totalCount === 2 && prog.transferredBytes === 5 * MB);

  queue.setItemStatus(0, QueueItemStatus.COMPLETED);
  const prog2 = queue.getOverallProgress();
  check('completed file updates completedCount', prog2.completedCount === 1 && prog2.transferredBytes === 10 * MB);

  console.log('== 5. Dynamic Chunk Plan & Single-Chunk Recovery ==');
  const plan = calculateTransferPlan(750 * MB);
  check('750 MB file gets 2.75 MB chunk plan', plan.chunkSize === 2.75 * MB);
  check('750 MB file gets Performance mode', plan.mode === 'Performance');
  check('750 MB file gets Max Parallelism 3', plan.maxParallelism === 3);

  // Test single chunk retransmission mechanism
  const { key, iv, password } = await generateKey();
  const testFileBlob = new Blob([new Uint8Array(5 * 1024 * 1024)], { type: 'application/octet-stream' });
  testFileBlob.name = 'test_5mb.bin';

  const sender = new StreamBatchSender({
    file: testFileBlob,
    key,
    baseIV: iv,
    fileId: 'test_file_id',
    transferId: 'test_tx_id'
  });

  const chunk0 = await sender.processChunk(0);
  check('individual chunk processed with checksum & metadata', chunk0.chunkIndex === 0 && typeof chunk0.checksum === 'string' && chunk0.data instanceof Uint8Array);

  const retransmittedChunk = await sender.retransmitChunk(0);
  check('chunk retransmitted successfully without full restart', retransmittedChunk.chunkIndex === 0 && sender.chunkStatus.get(0).retries === 1);

  console.log(`\n== ${passed} passed, ${failed} failed ==`);
  process.exit(failed ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test suite failure:', err);
  process.exit(1);
});
