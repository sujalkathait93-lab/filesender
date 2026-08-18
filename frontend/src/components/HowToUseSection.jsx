import React, { useState, useCallback, memo } from 'react'
import { Link } from 'react-router-dom'
import {
  Upload, Download, ArrowRight, Sparkles, CheckCircle2,
  Check, ChevronDown, ChevronUp, Radio, Image as ImageIcon
} from 'lucide-react'
import {
  TRANSFER_MODES,
  FEATURES_LIST,
  QUICK_PICK_CARDS,
  COMPARISON_ROWS,
  FAQS
} from '../data/guideData'

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
 * Mode Tabs Selector (SRP: Mode navigation buttons)
 */
const ModeTabsNav = memo(function ModeTabsNav({ activeTab, onSelectMode }) {
  return (
    <div className="guide-tabs-container" role="tablist" aria-label="Transfer Modes">
      {TRANSFER_MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = activeTab === mode.id;
        return (
          <button
            key={mode.id}
            role="tab"
            aria-selected={isActive}
            className={`guide-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onSelectMode(mode.id)}
          >
            <div className="guide-tab-icon">
              <Icon size={18} />
            </div>
            <div className="guide-tab-info">
              <span className="guide-tab-title">{mode.title}</span>
              <span className="guide-tab-subtitle">{mode.subtitle}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
});

/**
 * Mode Walkthrough Detail Card (SRP: Step-by-step instructions for active mode)
 */
const ModeWalkthroughCard = memo(function ModeWalkthroughCard({ mode }) {
  const Icon = mode.icon;
  return (
    <div className="guide-mode-card animate-in" key={mode.id}>
      <div className="guide-mode-header">
        <div className="guide-mode-title-group">
          <div className="guide-mode-icon-circle">
            <Icon size={24} />
          </div>
          <div>
            <div className="guide-mode-badge-row">
              <h3 className="guide-mode-title">{mode.title}</h3>
              <span className={`badge ${mode.badgeColor}`}>{mode.badge}</span>
            </div>
            <p className="guide-mode-desc">{mode.simpleSummary}</p>
            <div className="guide-best-for-bar">
              <span className="best-for-label">BEST FOR:</span>
              <span className="best-for-text">{mode.bestFor}</span>
            </div>
          </div>
        </div>

        <Link to={mode.actionLink} className="btn btn-primary guide-action-btn">
          {mode.actionText} <ArrowRight size={16} />
        </Link>
      </div>

      <div className="guide-steps-grid">
        {mode.steps.map((step) => (
          <div key={step.number} className="guide-step-card">
            <div className="guide-step-header">
              <div className="guide-step-badge">Step {step.number}</div>
              <CheckCircle2 size={16} className="guide-step-check" />
            </div>
            <h4 className="guide-step-title">{step.title}</h4>
            <p className="guide-step-desc">{step.desc}</p>
            <div className="guide-step-tip">
              <span className="guide-tip-label">TIP</span>
              <span>{step.tip}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * Features Deep-Dive Grid (SRP: Technical capability highlights and format tags)
 */
const FeaturesDeepGrid = memo(function FeaturesDeepGrid() {
  return (
    <section id="features" className="features-deep-section" aria-label="Main Features">
      <div className="section-header">
        <span className="section-tag">MAIN FEATURES EXPLAINED</span>
        <h2 className="section-title">Why FileShare Is Safer &amp; Faster</h2>
        <p className="section-subtitle">
          Simple points explaining how each feature protects your privacy and speeds up transfers.
        </p>
      </div>

      <div className="features-deep-grid">
        {FEATURES_LIST.map((feat, idx) => {
          const Icon = feat.icon;
          return (
            <div key={idx} className="feature-deep-card">
              <div className="feature-deep-top">
                <div className="feature-deep-icon">
                  <Icon size={22} />
                </div>
                <span className="feature-category-badge">{feat.tag}</span>
              </div>
              <h3 className="feature-deep-title">{feat.title}</h3>
              <p className="feature-simple-summary">{feat.simpleText}</p>

              <ul className="feature-deep-points">
                {feat.points.map((pt, pIdx) => (
                  <li key={pIdx}>
                    <Check size={14} className="feature-check-icon" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>

              <div className="feature-formats-list">
                <span className="feature-formats-heading">Supported Formats:</span>
                <div className="feature-format-chips">
                  {feat.bestForFormats.map((fmt, fIdx) => (
                    <span key={fIdx} className="format-chip">
                      <strong>{fmt.label}</strong> ({fmt.ext})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});

/**
 * Mode Comparison Table (SRP: Side-by-side mode capabilities)
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
 * FAQ Accordion List (SRP: Expandable security questions)
 */
const FaqAccordionSection = memo(function FaqAccordionSection({ expandedIndex, onToggleFaq }) {
  return (
    <section id="faq" className="faq-section" aria-label="Frequently Asked Questions">
      <div className="section-header">
        <span className="section-tag">FREQUENTLY ASKED QUESTIONS</span>
        <h2 className="section-title">Common Questions &amp; Answers</h2>
        <p className="section-subtitle">
          Quick answers to help you understand how files stay private and safe.
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
 * Bottom Call-to-Action Banner (SRP: Transfer kickoff CTA)
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
 * Main HowToUseSection orchestrator component adhering to Single Responsibility Principle.
 */
export function HowToUseSection() {
  const [activeTab, setActiveTab] = useState('cloud');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handleSelectMode = useCallback((modeId) => {
    setActiveTab(modeId);
  }, []);

  const handleToggleFaq = useCallback((index) => {
    setExpandedFaq((prev) => (prev === index ? null : index));
  }, []);

  const currentMode = TRANSFER_MODES.find((m) => m.id === activeTab) || TRANSFER_MODES[0];

  return (
    <div className="how-to-use-wrapper">
      <QuickPickSection />

      <section id="how-to-use" className="guide-section" aria-label="How to Use">
        <div className="section-header">
          <span className="section-tag">STEP-BY-STEP USER GUIDE</span>
          <h2 className="section-title">How to Use FileShare</h2>
          <p className="section-subtitle">
            Click any transfer mode below to see simple, step-by-step instructions.
          </p>
        </div>

        <ModeTabsNav activeTab={activeTab} onSelectMode={handleSelectMode} />
        <ModeWalkthroughCard mode={currentMode} />
      </section>

      <FeaturesDeepGrid />
      <ModeComparisonTable />
      <FaqAccordionSection expandedIndex={expandedFaq} onToggleFaq={handleToggleFaq} />
      <CtaBannerSection />
    </div>
  );
}

export default HowToUseSection;
