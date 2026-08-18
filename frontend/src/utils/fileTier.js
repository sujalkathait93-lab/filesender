/**
 * File Size Tier Analyzer Module
 * Primary Responsibility: Categorize selected payload sizes into UX tiers with guidance tips.
 */

/**
 * Intelligent File Size Tier & Guidance Analyzer (SRP: UI file size categorization up to 1 GB)
 */
export function getFileSizeTier(bytes = 0) {
  if (!bytes || bytes <= 0) {
    return {
      tier: 'empty',
      label: 'No files selected',
      badgeClass: 'badge-slate',
      description: 'Select files up to 1 GB total.',
      suggestP2P: false,
      stegoRecommended: false,
      optimizationTip: 'Max payload 1 GB with zero-knowledge AES-256-GCM encryption.'
    };
  }

  const ONE_MB = 1024 * 1024;
  const TWENTY_FIVE_MB = 25 * ONE_MB;
  const ONE_HUNDRED_MB = 100 * ONE_MB;
  const FIVE_HUNDRED_MB = 500 * ONE_MB;
  const ONE_GB = 1024 * 1024 * 1024;

  if (bytes < ONE_MB) {
    return {
      tier: 'tiny',
      label: 'Tiny (< 1 MB)',
      badgeClass: 'badge-emerald',
      description: 'Instant transfer with zero server strain. Steganography Image Vault & Burn-on-Read recommended.',
      suggestP2P: false,
      stegoRecommended: true,
      optimizationTip: 'Sub-second client encryption • Steganography capable'
    };
  }

  if (bytes <= TWENTY_FIVE_MB) {
    return {
      tier: 'small',
      label: 'Small (1 – 25 MB)',
      badgeClass: 'badge-primary',
      description: 'Standard Cloud Encrypted transfer. Uploads and encrypts in under 1 second with automatic gzip compression.',
      suggestP2P: false,
      stegoRecommended: bytes <= 10 * ONE_MB,
      optimizationTip: 'High-speed cloud vault • Adaptive gzip compression'
    };
  }

  if (bytes <= ONE_HUNDRED_MB) {
    return {
      tier: 'medium',
      label: 'Medium (25 – 100 MB)',
      badgeClass: 'badge-cyan',
      description: 'Optimized Cloud Transfer with memory-safe 4 MB streaming encryption slices.',
      suggestP2P: false,
      stegoRecommended: false,
      optimizationTip: 'Chunked stream active • Constant low RAM footprint'
    };
  }

  if (bytes <= FIVE_HUNDRED_MB) {
    return {
      tier: 'large',
      label: 'Large (100 – 500 MB)',
      badgeClass: 'badge-amber',
      description: 'High-Speed Streaming Vault active. Memory-safe chunked pipeline (4 MB slices). Direct P2P available.',
      suggestP2P: false,
      stegoRecommended: false,
      optimizationTip: 'Stream & Batch memory pipeline • Zero browser freeze'
    };
  }

  if (bytes <= ONE_GB) {
    return {
      tier: 'ultra',
      label: 'Ultra (500 MB – 1 GB)',
      badgeClass: 'badge-purple',
      description: 'Approaching 1 GB capacity limit. Direct WebRTC P2P recommended for 0 server load & instant transfer, or continue with Streamed Cloud Vault.',
      suggestP2P: true,
      stegoRecommended: false,
      optimizationTip: 'Near 1 GB max • Direct P2P recommended for fastest transfer'
    };
  }

  return {
    tier: 'overlimit',
    label: 'Over Limit (> 1 GB)',
    badgeClass: 'badge-rose',
    description: 'Selected size exceeds the 1 GB cloud storage limit. Switch to WebRTC Direct P2P to transfer unlimited sizes device-to-device.',
    suggestP2P: true,
    stegoRecommended: false,
    optimizationTip: 'Exceeds 1 GB • WebRTC Direct P2P required'
  };
}
