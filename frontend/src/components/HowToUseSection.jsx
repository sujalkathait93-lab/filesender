import React, { useState, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, Download, ArrowRight, Sparkles, CheckCircle2,
  Check, ChevronDown, ChevronUp, Radio, Image as ImageIcon,
  Flame, ShieldCheck, Database, HardDrive, Clock, Eye, Info, Lock
} from 'lucide-react';
import {
  FILE_SHARING_LIFECYCLE_STEPS,
  FEATURE_EXPLANATIONS,
  QUICK_PICK_CARDS,
  COMPARISON_ROWS,
  FAQS,
  DATA_STORAGE_POLICY
} from '../data/guideData';

/**
 * Quick Decision Picker subcomponent (SRP: Quick recommendation presentation)
 */
const QuickPickSection = memo(function QuickPickSection() {
  return (
    <section className="quick-pick-section" aria-label="Quick Decision Guide">
      <div className="section-header">
        <span className="section-tag">QUICK DECISION GUIDE</span>
        <h2 className="section-title">Which Feature Should You Use?</h2>
        <p className="section-subtitle">
          Find the exact right sharing mode for your needs in one second.
        </p>
      </div>

      <div className="quick-pick-grid">
        {QUICK_PICK_CARDS.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="quick-pick-card">
              <div className="quick-pick-top">
                <div className="quick-pick-icon">
                  <Icon size={20} />
                </div>
                <span className={`badge ${card.badgeColor}`}>{card.badge}</span>
              </div>
              <h3 className="quick-pick-question">{card.question}</h3>
              <p className="quick-pick-answer">{card.answer}</p>
              <Link to={card.link} className="quick-pick-link">
                Use {card.title} <ArrowRight size={14} />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
});

/**
 * 9-Step File Sharing Complete Process Walkthrough
 */
const FileSharingLifecycleSection = memo(function FileSharingLifecycleSection() {
  return (
    <section id="how-to-use" className="lifecycle-section" aria-label="9-Step File Sharing Process">
      <div className="section-header">
        <span className="section-tag">COMPLETE PROCESS WALKTHROUGH</span>
        <h2 className="section-title">How File Sharing Works (9 Simple Steps)</h2>
        <p className="section-subtitle">
          From file selection to instant decryption and permanent cleanup.
        </p>
      </div>

      <div className="lifecycle-grid">
        {FILE_SHARING_LIFECYCLE_STEPS.map((item) => (
          <div key={item.step} className="lifecycle-card">
            <div className="lifecycle-header">
              <div className="lifecycle-step-num">{item.step}</div>
              <h3 className="lifecycle-step-title">{item.title}</h3>
            </div>
            <p className="lifecycle-step-desc">{item.desc}</p>
            <span className="lifecycle-step-detail">{item.detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
});

/**
 * Point-Wise Feature Explanation Deep-Dive Cards
 */
const FeatureDeepDiveSection = memo(function FeatureDeepDiveSection({ activeId, onSelectFeature }) {
  const activeFeature = FEATURE_EXPLANATIONS.find((f) => f.id === activeId) || FEATURE_EXPLANATIONS[0];
  const Icon = activeFeature.icon;

  return (
    <section id="features" className="features-deep-section" aria-label="Feature Explanations">
      <div className="section-header">
        <span className="section-tag">POINT-WISE FEATURE EXPLANATIONS</span>
        <h2 className="section-title">Every Feature Explained Clearly</h2>
        <p className="section-subtitle">
          Click any feature below to see what it does, why to use it, limits, and where data is stored.
        </p>
      </div>

      {/* Feature Selector Tabs */}
      <div className="guide-tabs-container" role="tablist">
        {FEATURE_EXPLANATIONS.map((feat) => {
          const FeatIcon = feat.icon;
          const isActive = activeId === feat.id;
          return (
            <button
              key={feat.id}
              role="tab"
              aria-selected={isActive}
              className={`guide-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectFeature(feat.id)}
            >
              <div className="guide-tab-icon">
                <FeatIcon size={18} />
              </div>
              <div className="guide-tab-info">
                <span className="guide-tab-title">{feat.title.split('(')[0].trim()}</span>
                <span className="guide-tab-subtitle">{feat.badge}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Feature Detail Card (7-Questions Point-Wise) */}
      <div className="guide-mode-card animate-in" key={activeFeature.id}>
        <div className="guide-mode-header">
          <div className="guide-mode-title-group">
            <div className="guide-mode-icon-circle">
              <Icon size={24} />
            </div>
            <div>
              <div className="guide-mode-badge-row">
                <h3 className="guide-mode-title">{activeFeature.title}</h3>
                <span className={`badge ${activeFeature.badgeColor}`}>{activeFeature.badge}</span>
              </div>
              <p className="guide-mode-desc">{activeFeature.whatIsIt}</p>
            </div>
          </div>

          <Link to="/upload" className="btn btn-primary guide-action-btn">
            Try {activeFeature.title.split('(')[0].trim()} <ArrowRight size={16} />
          </Link>
        </div>

        <div className="guide-qa-grid">
          <div className="guide-qa-item">
            <span className="qa-tag">1. WHAT IS IT?</span>
            <p>{activeFeature.whatIsIt}</p>
          </div>

          <div className="guide-qa-item">
            <span className="qa-tag">2. WHY USE IT?</span>
            <p>{activeFeature.whyUseIt}</p>
          </div>

          <div className="guide-qa-item guide-qa-item--full">
            <span className="qa-tag">3. HOW TO USE IT (STEP-BY-STEP)</span>
            <ol className="qa-steps-list">
              {activeFeature.howToUse.map((step, idx) => (
                <li key={idx}>
                  <span className="step-badge">{idx + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="guide-qa-item">
            <span className="qa-tag">4. WHAT HAPPENS NEXT?</span>
            <p>{activeFeature.whatHappensNext}</p>
          </div>

          <div className="guide-qa-item">
            <span className="qa-tag">5. IMPORTANT &amp; LIMITS</span>
            <p>{activeFeature.important}</p>
          </div>

          <div className="guide-qa-item">
            <span className="qa-tag">6. WHERE IS DATA STORED?</span>
            <p>{activeFeature.whereStored}</p>
          </div>

          <div className="guide-qa-item">
            <span className="qa-tag">7. WHEN IS DATA DELETED?</span>
            <p>{activeFeature.whenDeleted}</p>
          </div>

          {activeFeature.example && (
            <div className="guide-qa-item guide-qa-item--full guide-example-box">
              <span className="qa-tag">REAL-WORLD EXAMPLE</span>
              <p>💡 {activeFeature.example}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

/**
 * Storage & Privacy Architecture Section
 */
const StoragePolicySection = memo(function StoragePolicySection() {
  return (
    <section className="storage-policy-section" aria-label="Data Storage and Security">
      <div className="section-header">
        <span className="section-tag">SECURITY &amp; DATA STORAGE</span>
        <h2 className="section-title">Where Your Data Is Stored</h2>
        <p className="section-subtitle">
          Transparent separation of structured metadata, temporary ciphertext, and device cache.
        </p>
      </div>

      <div className="storage-grid">
        {DATA_STORAGE_POLICY.sections.map((sec, idx) => (
          <div key={idx} className="storage-policy-card">
            <div className="storage-policy-header">
              <strong>{sec.category}</strong>
              <span className="badge badge-slate">{sec.storageLocation}</span>
            </div>
            <ul className="storage-policy-points">
              {sec.whatStored.map((pt, pIdx) => (
                <li key={pIdx}>• {pt}</li>
              ))}
            </ul>
            <div className="storage-retention-tag">
              <span className="retention-label">Retention &amp; Deletion:</span>
              <span className="retention-text">{sec.retention}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});

/**
 * Mode Comparison Table
 */
const ModeComparisonTable = memo(function ModeComparisonTable() {
  return (
    <section className="comparison-section" aria-label="Transfer Mode Comparison">
      <div className="section-header">
        <span className="section-tag">FEATURE BREAKDOWN</span>
        <h2 className="section-title">Compare Transfer Modes</h2>
        <p className="section-subtitle">
          Quick side-by-side comparison of privacy, storage, and limits.
        </p>
      </div>

      <div className="comparison-table-container">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>What You Need</th>
              <th>
                <div className="table-header-mode">
                  <Upload size={16} /> Cloud Encrypted
                </div>
              </th>
              <th>
                <div className="table-header-mode">
                  <Radio size={16} /> WebRTC Direct P2P
                </div>
              </th>
              <th>
                <div className="table-header-mode">
                  <ImageIcon size={16} /> Steganography Vault
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row, idx) => (
              <tr key={idx}>
                <td className="row-feature-title">{row.feature}</td>
                <td>
                  <span className="table-value-pill">{row.cloud}</span>
                </td>
                <td>
                  <span className="table-value-pill pill-p2p">{row.p2p}</span>
                </td>
                <td>
                  <span className="table-value-pill pill-stego">{row.stego}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
});

/**
 * FAQ Accordion List
 */
const FaqAccordionSection = memo(function FaqAccordionSection({ expandedIndex, onToggleFaq }) {
  return (
    <section id="faq" className="faq-section" aria-label="Frequently Asked Questions">
      <div className="section-header">
        <span className="section-tag">FREQUENTLY ASKED QUESTIONS</span>
        <h2 className="section-title">Common Questions &amp; Answers</h2>
        <p className="section-subtitle">
          Quick answers to help you understand how files stay private, secure, and ephemeral.
        </p>
      </div>

      <div className="faq-accordion-list">
        {FAQS.map((faq, index) => {
          const isExpanded = expandedIndex === index;
          return (
            <div
              key={index}
              className={`faq-item ${isExpanded ? 'expanded' : ''}`}
            >
              <button
                className="faq-question-btn"
                onClick={() => onToggleFaq(index)}
                aria-expanded={isExpanded}
              >
                <span className="faq-question-text">{faq.q}</span>
                <div className="faq-toggle-icon">
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>
              {isExpanded && (
                <div className="faq-answer-pane animate-in">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
});

/**
 * Bottom Call-to-Action Banner
 */
const CtaBannerSection = memo(function CtaBannerSection() {
  return (
    <section className="guide-cta-card" aria-label="Call to Action">
      <div className="guide-cta-content">
        <div className="guide-cta-badge">
          <Sparkles size={14} /> Ready to Transfer?
        </div>
        <h3 className="guide-cta-title">Send Your First Encrypted File Now</h3>
        <p className="guide-cta-desc">
          Zero registrations, zero software to install, and zero keys on our servers. Send, Share and Done.
        </p>
        <div className="guide-cta-buttons">
          <Link to="/upload" className="btn btn-primary btn-lg">
            <Upload size={18} /> Send Files Now <ArrowRight size={16} />
          </Link>
          <Link to="/download" className="btn btn-secondary btn-lg">
            <Download size={18} /> Receive Files
          </Link>
        </div>
      </div>
    </section>
  );
});

/**
 * Main HowToUseSection orchestrator component
 */
export function HowToUseSection() {
  const [activeFeatureId, setActiveFeatureId] = useState('file_sharing');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handleSelectFeature = useCallback((id) => {
    setActiveFeatureId(id);
  }, []);

  const handleToggleFaq = useCallback((index) => {
    setExpandedFaq((prev) => (prev === index ? null : index));
  }, []);

  return (
    <div className="how-to-use-wrapper">
      <QuickPickSection />
      <FileSharingLifecycleSection />
      <FeatureDeepDiveSection activeId={activeFeatureId} onSelectFeature={handleSelectFeature} />
      <StoragePolicySection />
      <ModeComparisonTable />
      <FaqAccordionSection expandedIndex={expandedFaq} onToggleFaq={handleToggleFaq} />
      <CtaBannerSection />
    </div>
  );
}

export default HowToUseSection;
