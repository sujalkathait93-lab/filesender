import React, { useState, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, Download, ArrowRight, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  FILE_SHARING_LIFECYCLE_STEPS,
  QUICK_PICK_CARDS,
  FAQS
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
          Find the exact right sharing mode for your files in one second.
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
          From file selection to instant decryption and permanent server cleanup.
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
 * FAQ Accordion List
 */
const FaqAccordionSection = memo(function FaqAccordionSection({ expandedIndex, onToggleFaq }) {
  return (
    <section id="faq" className="faq-section" aria-label="Frequently Asked Questions">
      <div className="section-header">
        <span className="section-tag">FREQUENTLY ASKED QUESTIONS</span>
        <h2 className="section-title">Common Questions &amp; Answers</h2>
        <p className="section-subtitle">
          Quick answers to help you understand zero-knowledge privacy, burn on read, and automatic purging.
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
          Zero accounts, zero cookies required, and zero keys on our servers. Send, Share and Done.
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
 * Clean, fast, minimal landing page guide
 */
export function HowToUseSection() {
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handleToggleFaq = useCallback((index) => {
    setExpandedFaq((prev) => (prev === index ? null : index));
  }, []);

  return (
    <div className="how-to-use-wrapper">
      <QuickPickSection />
      <FileSharingLifecycleSection />
      <FaqAccordionSection expandedIndex={expandedFaq} onToggleFaq={handleToggleFaq} />
      <CtaBannerSection />
    </div>
  );
}

export default HowToUseSection;
