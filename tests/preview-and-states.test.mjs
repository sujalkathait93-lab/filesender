/**
 * Unit & Integration Test Suite for:
 * 1. File Manager (pack / unpack / detectFileType / size validation / 1 GB tiers)
 * 2. Preview Manager (30s countdown / MIME categorization / Object URL lifecycle)
 * 3. Transfer State Machine (canonical pipeline and error state transitions)
 * 4. Transfer Codes & URLs
 */

import { TransferStateMachine, TransferState } from '../frontend/src/stateMachine.js';
import { detectFileType, validateFiles, packFiles, unpackFiles, getFileSizeTier } from '../frontend/src/fileManager.js';
import { PreviewManager } from '../frontend/src/previewManager.js';
import { createTransferCode, parseTransferCode, createShareMessage, isValidTransferCodeInput } from '../frontend/src/transferCode.js';

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

async function runTests() {
  console.log('== 1. File Manager & Type Detection ==');
  check('image detection', detectFileType('photo.PNG').category === 'image' && detectFileType('photo.PNG').canPreviewDirectly === true);
  check('video detection', detectFileType('movie.mp4').category === 'video' && detectFileType('movie.mp4').canPreviewDirectly === true);
  check('audio detection', detectFileType('song.mp3').category === 'audio' && detectFileType('song.mp3').canPreviewDirectly === true);
  check('pdf detection', detectFileType('report.pdf').category === 'pdf' && detectFileType('report.pdf').canPreviewDirectly === true);
  check('text detection', detectFileType('code.py').category === 'text' && detectFileType('code.py').canPreviewDirectly === true);
  check('doc unsupported direct preview', detectFileType('notes.docx').category === 'document' && detectFileType('notes.docx').canPreviewDirectly === false);
  check('app unsupported direct preview', detectFileType('setup.exe').category === 'app' && detectFileType('setup.exe').canPreviewDirectly === false);
  check('generic unsupported direct preview', detectFileType('data.xyz').category === 'other' && detectFileType('data.xyz').canPreviewDirectly === false);

  console.log('== 2. File Size Validation & Smart Transfer Optimization (1 GB Limit) ==');
  const validFiles = [
    { name: 'f1.txt', size: 1024 * 1024 * 500 }, // 500 MB
    { name: 'f2.txt', size: 1024 * 1024 * 500 }, // 500 MB
  ];
  const v1 = validateFiles(validFiles, 0);
  check('under 1 GB capacity passes', v1.valid === true);

  const oversizedFiles = [
    { name: 'big.iso', size: 1024 * 1024 * 1024 * 1.5 } // 1.5 GB
  ];
  const v2 = validateFiles(oversizedFiles, 0);
  check('over 1 GB rejected', v2.valid === false && v2.error.includes('exceeds'));

  // Smart Transfer Optimization Tiers (0 to 1 GB)
  check('tier: empty', getFileSizeTier(0).tier === 'empty');
  check('tier: tiny (<1 MB)', getFileSizeTier(500 * 1024).tier === 'tiny' && getFileSizeTier(500 * 1024).stegoRecommended === true);
  check('tier: small (1-25 MB)', getFileSizeTier(15 * 1024 * 1024).tier === 'small');
  check('tier: medium (25-100 MB)', getFileSizeTier(60 * 1024 * 1024).tier === 'medium');
  check('tier: large (100-500 MB)', getFileSizeTier(300 * 1024 * 1024).tier === 'large');
  check('tier: ultra (500 MB - 1 GB)', getFileSizeTier(800 * 1024 * 1024).tier === 'ultra' && getFileSizeTier(800 * 1024 * 1024).suggestP2P === true);
  check('tier: overlimit (>1 GB)', getFileSizeTier(1.2 * 1024 * 1024 * 1024).tier === 'overlimit' && getFileSizeTier(1.2 * 1024 * 1024 * 1024).suggestP2P === true);

  console.log('== 3. Multi-File Bundle Packaging & Unpacking ==');
  const f1Data = new TextEncoder().encode('Content of file 1');
  const f2Data = new TextEncoder().encode('Content of file 2 with more data');
  const f1 = new Blob([f1Data], { type: 'text/plain' });
  f1.name = 'file1.txt';
  const f2 = new Blob([f2Data], { type: 'text/plain' });
  f2.name = 'file2.txt';

  const packRes = await packFiles([f1, f2]);
  check('multi-file bundle created', packRes.isBundle === true && packRes.fileCount === 2);

  const bundleBuffer = new Uint8Array(await packRes.blob.arrayBuffer());
  const unpacked = unpackFiles(bundleBuffer);
  check('unpacked file count matches', unpacked.isBundle === true && unpacked.files.length === 2);
  check('unpacked file 1 content matches', new TextDecoder().decode(unpacked.files[0].data) === 'Content of file 1');
  check('unpacked file 2 content matches', new TextDecoder().decode(unpacked.files[1].data) === 'Content of file 2 with more data');

  console.log('== 4. State Machine Transitions ==');
  const sm = new TransferStateMachine(TransferState.IDLE);
  check('initial state IDLE', sm.getState() === TransferState.IDLE);
  check('transition to SELECT', sm.transitionTo(TransferState.SELECT) === true && sm.getState() === TransferState.SELECT);
  check('transition to VALIDATE', sm.transitionTo(TransferState.VALIDATE) === true && sm.getState() === TransferState.VALIDATE);
  check('transition to PREPARE', sm.transitionTo(TransferState.PREPARE) === true && sm.getState() === TransferState.PREPARE);
  check('transition to PROCESSING', sm.transitionTo(TransferState.PROCESSING) === true && sm.getState() === TransferState.PROCESSING);
  check('transition to CREATING_TRANSFER', sm.transitionTo(TransferState.CREATING_TRANSFER) === true && sm.getState() === TransferState.CREATING_TRANSFER);
  check('transition to WAITING_FOR_RECEIVER', sm.transitionTo(TransferState.WAITING_FOR_RECEIVER) === true && sm.getState() === TransferState.WAITING_FOR_RECEIVER);
  check('transition to CONNECT', sm.transitionTo(TransferState.CONNECT) === true && sm.getState() === TransferState.CONNECT);
  check('transition to TRANSFER', sm.transitionTo(TransferState.TRANSFER) === true && sm.getState() === TransferState.TRANSFER);
  check('transition to VERIFY', sm.transitionTo(TransferState.VERIFY) === true && sm.getState() === TransferState.VERIFY);
  check('transition to PREVIEW', sm.transitionTo(TransferState.PREVIEW) === true && sm.getState() === TransferState.PREVIEW);
  check('transition to DOWNLOAD', sm.transitionTo(TransferState.DOWNLOAD) === true && sm.getState() === TransferState.DOWNLOAD);
  check('transition to COMPLETE', sm.transitionTo(TransferState.COMPLETE) === true && sm.getState() === TransferState.COMPLETE);
  check('COMPLETE is terminal', sm.isTerminal() === true);
  check('transition to CLEANUP', sm.transitionTo(TransferState.CLEANUP) === true && sm.getState() === TransferState.CLEANUP);

  // Test error states
  const smError = new TransferStateMachine(TransferState.CONNECT);
  check('transition to INVALID_TOKEN', smError.transitionTo(TransferState.INVALID_TOKEN) === true);
  check('transition from error to IDLE', smError.transitionTo(TransferState.IDLE) === true);

  console.log('== 5. Preview Manager Lifecycle & Object URL Management ==');
  let closed = false;
  const pm = new PreviewManager({
    onClose: () => { closed = true; }
  });

  const testFileItem = {
    name: 'test_image.png',
    size: 1024,
    type: 'image/png',
    data: new Uint8Array([1, 2, 3, 4]),
    blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })
  };

  const preview = pm.preparePreview(testFileItem);
  check('preview prepared for image', preview.category === 'image' && preview.canPreviewDirectly === true);

  pm.cleanup();
  check('cleanup resets preview state', pm.currentPreview === null && pm.activeObjectUrls.size === 0);

  console.log('== 6. Transfer Code Creation, Parsing & Share Templates ==');
  const code10 = createTransferCode('4be81', '9f8a7');
  check('createTransferCode format 10-digit FS-XXXXX-YYYYY', code10 === 'FS-4BE81-9F8A7');

  const p10_1 = parseTransferCode('FS-4BE81-9F8A7');
  check('parse 10-digit FS code', p10_1.fileId === '4be81' && p10_1.key === '9f8a7');

  const p10_2 = parseTransferCode('4BE81-9F8A7');
  check('parse 10-digit hyphenated code', p10_2.fileId === '4be81' && p10_2.key === '9f8a7');

  const p10_3 = parseTransferCode('4be819f8a7');
  check('parse 10-digit raw code', p10_3.fileId === '4be81' && p10_3.key === '9f8a7');

  const p10_num = parseTransferCode('12345-67890');
  check('parse 10-numeric digits hyphenated', p10_num.fileId === '12345' && p10_num.key === '67890');

  const p10_num_raw = parseTransferCode('1234567890');
  check('parse 10-numeric digits raw', p10_num_raw.fileId === '12345' && p10_num_raw.key === '67890');

  const code = createTransferCode('4be819d7', '9f8a73c2');
  check('createTransferCode format FS-XXX-YYY', code === 'FS-4BE819D7-9F8A73C2');

  const p1 = parseTransferCode('FS-4BE819D7-9F8A73C2');
  check('parse FS code', p1.fileId === '4be819d7' && p1.key === '9f8a73c2');

  const p2 = parseTransferCode('SEC-4BE819D7-9F8A73C2');
  check('parse SEC code legacy', p2.fileId === '4be819d7' && p2.key === '9f8a73c2');

  const p3 = parseTransferCode('https://fileshare.local/download?code=FS-4BE81-9F8A7');
  check('parse code from URL', p3.fileId === '4be81' && p3.key === '9f8a7');

  const p4 = parseTransferCode('https://fileshare.local/download?code=FS-4BE81#key=9F8A7');
  check('parse fragment key from a share link', p4.fileId === '4be81' && p4.key === '9f8a7');

  const p5 = parseTransferCode('4be819d79f8a73c2');
  check('parse raw 16-hex code', p5.fileId === '4be819d7' && p5.key === '9f8a73c2');
  check('reject non-hex transfer input', isValidTransferCodeInput('not a code!') === false);
  check('accept 10-digit transfer input', isValidTransferCodeInput('FS-4BE81-9F8A7') === true);
  check('accept raw 10-digit input', isValidTransferCodeInput('4be819f8a7') === true);
  check('accept 16-hex transfer input', isValidTransferCodeInput('FS-4BE819D7-9F8A73C2') === true);

  const shareMsg = createShareMessage({
    transferCode: 'FS-4BE81-9F8A7',
    shareUrl: 'https://fileshare.local/download?code=FS-4BE81-9F8A7',
    expiryHours: 1,
    fileCount: 3,
    totalSize: '45.2 MB'
  });
  check('share message contains transfer code', shareMsg.includes('Code: FS-4BE81-9F8A7'));
  check('share message contains link and expiry in seconds', shareMsg.includes('Link:') && shareMsg.includes('Expires: 60 seconds'));

  console.log(`\n== ${passed} passed, ${failed} failed ==`);
  process.exit(failed ? 1 : 0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
