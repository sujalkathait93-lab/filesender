import React, { useState, useEffect } from 'react';
import {
  HelpCircle, X, Upload, Flame, Radio, Image as ImageIcon,
  ShieldCheck, Clock, Eye, Check, Info, Database, ArrowRight
} from 'lucide-react';
import { FEATURE_EXPLANATIONS, FILE_SHARING_LIFECYCLE_STEPS } from '../../data/guideData';

/**
 * FeatureGuideModal Component
 * Primary Responsibility: Display comprehensive, point-wise 7-question guide for all features, limits, and storage rules.
 */
export function FeatureGuideModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('file_sharing');

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentFeature = FEATURE_EXPLANATIONS.find((f) => f.id === activeTab) || FEATURE_EXPLANATIONS[0];
  const Icon = currentFeature.icon;

  return (
    <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Complete Feature & Privacy Guide">
      <div className="preview-modal feature-guide-modal animate-in">
        <div className="preview-header">
          <h3><HelpCircle size={18} /> Feature &amp; Privacy Guide</h3>
          <button className="preview-close" onClick={onClose} aria-label="Close guide">
            <X size={18} />
          </button>
        </div>

        {/* Feature Selector Tabs */}
        <div className="guide-modal-tabs" role="tablist">
          {FEATURE_EXPLANATIONS.map((feat) => {
            const FeatIcon = feat.icon;
            const isActive = activeTab === feat.id;
            return (
              <button
                key={feat.id}
                role="tab"
                aria-selected={isActive}
                className={`guide-modal-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(feat.id)}
              >
                <FeatIcon size={15} />
                <span>{feat.title.split('(')[0].trim()}</span>
              </button>
            );
          })}
        </div>

        <div className="guide-modal-body">
          {/* Active Feature Detail Card */}
          <div className="guide-modal-card animate-in" key={currentFeature.id}>
            <div className="guide-modal-card-top">
              <div className="guide-modal-icon-badge">
                <Icon size={22} />
              </div>
              <div>
                <div className="guide-modal-title-row">
                  <h4>{currentFeature.title}</h4>
                  <span className={`badge ${currentFeature.badgeColor}`}>{currentFeature.badge}</span>
                </div>
                <p className="guide-modal-summary">{currentFeature.whatIsIt}</p>
              </div>
            </div>

            {/* 7-Question Point-Wise Grid */}
            <div className="guide-qa-grid">
              <div className="guide-qa-item">
                <span className="qa-tag">1. WHAT IS IT?</span>
                <p>{currentFeature.whatIsIt}</p>
              </div>

              <div className="guide-qa-item">
                <span className="qa-tag">2. WHY USE IT?</span>
                <p>{currentFeature.whyUseIt}</p>
              </div>

              <div className="guide-qa-item guide-qa-item--full">
                <span className="qa-tag">3. HOW TO USE IT (STEP-BY-STEP)</span>
                <ol className="qa-steps-list">
                  {currentFeature.howToUse.map((step, idx) => (
                    <li key={idx}>
                      <span className="step-badge">{idx + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="guide-qa-item">
                <span className="qa-tag">4. WHAT HAPPENS NEXT?</span>
                <p>{currentFeature.whatHappensNext}</p>
              </div>

              <div className="guide-qa-item">
                <span className="qa-tag">5. IMPORTANT &amp; LIMITS</span>
                <p>{currentFeature.important}</p>
              </div>

              <div className="guide-qa-item">
                <span className="qa-tag">6. WHERE IS DATA STORED?</span>
                <p>{currentFeature.whereStored}</p>
              </div>

              <div className="guide-qa-item">
                <span className="qa-tag">7. WHEN IS DATA DELETED?</span>
                <p>{currentFeature.whenDeleted}</p>
              </div>

              {currentFeature.example && (
                <div className="guide-qa-item guide-qa-item--full guide-example-box">
                  <span className="qa-tag">REAL-WORLD EXAMPLE</span>
                  <p>💡 {currentFeature.example}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="preview-footer">
          <button className="btn btn-primary btn-md" onClick={onClose}>
            Got it, Let's Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
