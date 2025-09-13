import React, { useState } from 'react';
import { useMaterial3 } from '../contexts/Material3Provider';
import { GhostHunterColors } from '../styles/material3/colors';
import { elevation, shape, motion } from '../styles/material3/theme';

export const Material3Demo: React.FC = () => {
  const { isDark, toggleTheme } = useMaterial3();
  const [selectedChip, setSelectedChip] = useState<string>('emf');
  const [cardElevation, setCardElevation] = useState(1);

  const evidenceTypes = [
    { id: 'emf', label: 'EMF', color: GhostHunterColors.evidence.emf },
    { id: 'temperature', label: 'Temperature', color: GhostHunterColors.evidence.temperature },
    { id: 'audio', label: 'Audio', color: GhostHunterColors.evidence.audio },
    { id: 'visual', label: 'Visual', color: GhostHunterColors.evidence.visual },
    { id: 'motion', label: 'Motion', color: GhostHunterColors.evidence.motion }
  ];

  const alertLevels = [
    { level: 'safe', label: 'Safe', color: GhostHunterColors.alerts.safe },
    { level: 'caution', label: 'Caution', color: GhostHunterColors.alerts.caution },
    { level: 'warning', label: 'Warning', color: GhostHunterColors.alerts.warning },
    { level: 'danger', label: 'Danger', color: GhostHunterColors.alerts.danger }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header with Theme Toggle */}
      <div className="surface-container-high elevation-2" style={{ 
        padding: '24px', 
        borderRadius: shape.large,
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="type-display-medium primary">Tacctile</h1>
            <p className="type-body-large on-surface-variant">Material Design 3 Theme System</p>
          </div>
          <button 
            className="md3-button interactive primary-container on-primary-container"
            onClick={toggleTheme}
            style={{
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-on-primary-container)'
            }}
          >
            {isDark ? '🌙 Dark' : '☀️ Light'} Theme
          </button>
        </div>
      </div>

      {/* Color System Demo */}
      <section style={{ marginBottom: '48px' }}>
        <h2 className="type-headline-large" style={{ marginBottom: '24px' }}>Dynamic Color System</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {/* Primary Colors */}
          <div className="md3-card elevated" style={{ padding: '20px' }}>
            <h3 className="type-title-large">Primary Palette</h3>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'var(--md-sys-color-primary)',
                borderRadius: shape.medium
              }} />
              <div style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                borderRadius: shape.medium
              }} />
              <div style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'var(--md-sys-color-on-primary-container)',
                borderRadius: shape.medium
              }} />
            </div>
          </div>

          {/* Secondary Colors */}
          <div className="md3-card elevated" style={{ padding: '20px' }}>
            <h3 className="type-title-large">Secondary Palette</h3>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'var(--md-sys-color-secondary)',
                borderRadius: shape.medium
              }} />
              <div style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'var(--md-sys-color-secondary-container)',
                borderRadius: shape.medium
              }} />
              <div style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'var(--md-sys-color-on-secondary-container)',
                borderRadius: shape.medium
              }} />
            </div>
          </div>

          {/* Tertiary Colors */}
          <div className="md3-card elevated" style={{ padding: '20px' }}>
            <h3 className="type-title-large">Tertiary Palette</h3>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'var(--md-sys-color-tertiary)',
                borderRadius: shape.medium
              }} />
              <div style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'var(--md-sys-color-tertiary-container)',
                borderRadius: shape.medium
              }} />
              <div style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'var(--md-sys-color-on-tertiary-container)',
                borderRadius: shape.medium
              }} />
            </div>
          </div>
        </div>
      </section>

      {/* Evidence Type Chips */}
      <section style={{ marginBottom: '48px' }}>
        <h2 className="type-headline-large" style={{ marginBottom: '24px' }}>Evidence Detection</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {evidenceTypes.map(type => (
            <button
              key={type.id}
              className={`md3-chip interactive ${selectedChip === type.id ? 'selected' : ''}`}
              onClick={() => setSelectedChip(type.id)}
              style={{
                backgroundColor: selectedChip === type.id ? type.color : 'var(--md-sys-color-surface-container-low)',
                color: selectedChip === type.id ? '#000' : 'var(--md-sys-color-on-surface)',
                borderColor: type.color,
                transition: `all ${motion.duration.short4} ${motion.easing.emphasized}`
              }}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Selected Evidence Card */}
        <div className="md3-card elevated slide-up" style={{ 
          marginTop: '24px',
          padding: '24px',
          backgroundColor: GhostHunterColors.getTones(evidenceTypes.find(e => e.id === selectedChip)?.color || '')[95]
        }}>
          <h3 className="type-title-large">{evidenceTypes.find(e => e.id === selectedChip)?.label} Detection Active</h3>
          <p className="type-body-large" style={{ marginTop: '8px' }}>
            Monitoring for {selectedChip} anomalies in real-time...
          </p>
        </div>
      </section>

      {/* Alert Levels */}
      <section style={{ marginBottom: '48px' }}>
        <h2 className="type-headline-large" style={{ marginBottom: '24px' }}>Alert System</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {alertLevels.map(alert => (
            <div
              key={alert.level}
              className="md3-card interactive"
              style={{
                padding: '20px',
                backgroundColor: GhostHunterColors.getTones(alert.color)[90],
                borderLeft: `4px solid ${alert.color}`,
                cursor: 'pointer',
                transition: `all ${motion.duration.short4} ${motion.easing.emphasized}`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = elevation.level3;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = elevation.level1;
              }}
            >
              <h4 className="type-title-medium" style={{ color: alert.color }}>
                {alert.label}
              </h4>
              <p className="type-body-medium" style={{ marginTop: '8px' }}>
                Status: {alert.level === 'safe' ? 'No anomalies detected' : `${alert.label} level activity`}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Elevation Demo */}
      <section style={{ marginBottom: '48px' }}>
        <h2 className="type-headline-large" style={{ marginBottom: '24px' }}>Elevation System</h2>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          {[0, 1, 2, 3, 4, 5].map(level => (
            <button
              key={level}
              className="md3-button interactive"
              onClick={() => setCardElevation(level)}
              style={{
                backgroundColor: cardElevation === level ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container)',
                color: cardElevation === level ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'
              }}
            >
              Level {level}
            </button>
          ))}
        </div>
        <div 
          className={`surface-container elevation-${cardElevation}`}
          style={{
            padding: '32px',
            borderRadius: shape.large,
            transition: `all ${motion.duration.medium2} ${motion.easing.emphasized}`,
            textAlign: 'center'
          }}
        >
          <h3 className="type-title-large">Elevation Level {cardElevation}</h3>
          <p className="type-body-large" style={{ marginTop: '8px' }}>
            {cardElevation === 0 ? 'Flat surface' : `Elevated ${cardElevation * 2}dp from surface`}
          </p>
        </div>
      </section>

      {/* Typography Scale */}
      <section>
        <h2 className="type-headline-large" style={{ marginBottom: '24px' }}>Typography Scale</h2>
        <div className="md3-card elevated" style={{ padding: '32px' }}>
          <div className="type-display-large" style={{ marginBottom: '16px' }}>Display Large</div>
          <div className="type-display-medium" style={{ marginBottom: '16px' }}>Display Medium</div>
          <div className="type-display-small" style={{ marginBottom: '16px' }}>Display Small</div>
          <div className="type-headline-large" style={{ marginBottom: '16px' }}>Headline Large</div>
          <div className="type-headline-medium" style={{ marginBottom: '16px' }}>Headline Medium</div>
          <div className="type-headline-small" style={{ marginBottom: '16px' }}>Headline Small</div>
          <div className="type-title-large" style={{ marginBottom: '16px' }}>Title Large</div>
          <div className="type-title-medium" style={{ marginBottom: '16px' }}>Title Medium</div>
          <div className="type-title-small" style={{ marginBottom: '16px' }}>Title Small</div>
          <div className="type-body-large" style={{ marginBottom: '16px' }}>Body Large - Main content text</div>
          <div className="type-body-medium" style={{ marginBottom: '16px' }}>Body Medium - Secondary content</div>
          <div className="type-body-small" style={{ marginBottom: '16px' }}>Body Small - Supporting text</div>
          <div className="type-label-large" style={{ marginBottom: '16px' }}>LABEL LARGE</div>
          <div className="type-label-medium" style={{ marginBottom: '16px' }}>LABEL MEDIUM</div>
          <div className="type-label-small">LABEL SMALL</div>
        </div>
      </section>
    </div>
  );
};

export default Material3Demo;