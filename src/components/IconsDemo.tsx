import React, { useState } from 'react';
import { Icon, IconButton, IconWithText, IconGroup } from './Icon';
import { GhostIcons, SemanticIcons } from '../config/ghost-icons';
import '../styles/icons.css';

const IconsDemo: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('evidence');
  const [iconSize, setIconSize] = useState<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md');

  const categories = Object.keys(GhostIcons) as Array<keyof typeof GhostIcons>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ marginBottom: '3rem' }}>
        <h1 className="heading-1 mb-4">Material Icons System</h1>
        <p className="lead">Ghost Hunter Toolbox - Comprehensive Icon Library</p>
      </header>

      {/* Icon Size Controls */}
      <section style={{ marginBottom: '2rem' }}>
        <h3 className="heading-4 mb-4">Icon Size</h3>
        <IconGroup>
          {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(size => (
            <button
              key={size}
              onClick={() => setIconSize(size)}
              style={{
                padding: '8px 16px',
                backgroundColor: iconSize === size ? '#8b5cf6' : '#1f2937',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {size.toUpperCase()}
            </button>
          ))}
        </IconGroup>
      </section>

      {/* Category Tabs */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          flexWrap: 'wrap',
          borderBottom: '2px solid #374151',
          paddingBottom: '0.5rem'
        }}>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              style={{
                padding: '8px 16px',
                backgroundColor: selectedCategory === category ? '#8b5cf6' : 'transparent',
                color: selectedCategory === category ? 'white' : '#a3a3a3',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                fontWeight: 600,
                textTransform: 'capitalize'
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {/* Icons Grid */}
      <section style={{ marginBottom: '3rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '1rem',
          padding: '2rem',
          backgroundColor: '#111827',
          borderRadius: '12px'
        }}>
          {Object.entries(GhostIcons[selectedCategory as keyof typeof GhostIcons] || {}).map(([name, IconComponent]) => (
            <div
              key={name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '1rem',
                backgroundColor: '#1f2937',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#374151';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1f2937';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Icon 
                icon={IconComponent} 
                size={iconSize}
                color='default'
              />
              <span style={{ 
                marginTop: '0.5rem', 
                fontSize: '12px', 
                color: '#a3a3a3',
                textAlign: 'center'
              }}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Evidence Icons with Colors */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 className="heading-2 mb-4">Evidence Detection Icons</h2>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {Object.entries(GhostIcons.evidence).slice(0, 7).map(([name, IconComponent]) => (
            <IconWithText
              key={name}
              icon={IconComponent}
              text={name.toUpperCase()}
              iconSize="xl"
              iconColor='default'
              vertical
            />
          ))}
        </div>
      </section>

      {/* Alert System */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 className="heading-2 mb-4">Alert Levels</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {Object.entries(SemanticIcons.evidenceSeverity).map(([level, IconComponent]) => (
            <div
              key={level}
              style={{
                padding: '1rem 2rem',
                backgroundColor: '#1f2937',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <Icon 
                icon={IconComponent} 
                size="lg"
                color={
                  level === 'none' ? 'success' :
                  level === 'low' ? 'info' :
                  level === 'medium' ? 'warning' :
                  level === 'high' ? 'error' : 'anomaly'
                }
              />
              <div>
                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{level}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {level === 'none' ? 'All Clear' :
                   level === 'low' ? 'Minor Activity' :
                   level === 'medium' ? 'Notable Activity' :
                   level === 'high' ? 'Significant Activity' : 'Extreme Activity'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Icon Buttons */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 className="heading-2 mb-4">Icon Buttons</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <IconButton icon={GhostIcons.media.play} variant="filled" />
          <IconButton icon={GhostIcons.media.pause} variant="tonal" />
          <IconButton icon={GhostIcons.media.stop} variant="outlined" />
          <IconButton icon={GhostIcons.media.record} iconColor="error" />
          <IconButton icon={GhostIcons.alerts.warning} iconColor="warning" badge="3" />
          <IconButton icon={GhostIcons.alerts.critical} iconColor="error" badge={true} />
        </div>
      </section>

      {/* Animated Icons */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 className="heading-2 mb-4">Animated Icons</h2>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <Icon icon={GhostIcons.status.timer} size="xl" spin />
            <div style={{ marginTop: '0.5rem', fontSize: '12px' }}>Spin</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Icon icon={GhostIcons.investigation.active} size="xl" pulse color="error" />
            <div style={{ marginTop: '0.5rem', fontSize: '12px' }}>Pulse</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Icon icon={GhostIcons.alerts.warning} size="xl" bounce color="warning" />
            <div style={{ marginTop: '0.5rem', fontSize: '12px' }}>Bounce</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Icon icon={GhostIcons.detection.radar} size="xl" ping color="primary" />
            <div style={{ marginTop: '0.5rem', fontSize: '12px' }}>Ping</div>
          </div>
        </div>
      </section>

      {/* Media Controls */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 className="heading-2 mb-4">Media Player Controls</h2>
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          padding: '1.5rem',
          backgroundColor: '#111827',
          borderRadius: '12px',
          justifyContent: 'center'
        }}>
          <IconButton icon={GhostIcons.media.previous} size="sm" />
          <IconButton icon={GhostIcons.media.rewind} />
          <IconButton icon={GhostIcons.media.play} variant="filled" size="lg" />
          <IconButton icon={GhostIcons.media.forward} />
          <IconButton icon={GhostIcons.media.next} size="sm" />
          <div style={{ marginLeft: '2rem' }}>
            <IconButton icon={GhostIcons.media.volumeUp} />
          </div>
          <div style={{ marginLeft: '1rem' }}>
            <IconButton icon={GhostIcons.media.record} iconColor="error" badge={true} />
          </div>
        </div>
      </section>

      {/* Hardware Status */}
      <section>
        <h2 className="heading-2 mb-4">Hardware & Status</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{
            padding: '1rem',
            backgroundColor: '#1f2937',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <Icon icon={GhostIcons.status.wifi} color="success" />
            <span>WiFi Connected</span>
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: '#1f2937',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <Icon icon={GhostIcons.hardware.bluetooth} color="info" />
            <span>Bluetooth Active</span>
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: '#1f2937',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <Icon icon={GhostIcons.status.battery} color="success" />
            <span>Battery 90%</span>
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: '#1f2937',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <Icon icon={GhostIcons.status.storage} color="warning" />
            <span>Storage 75%</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default IconsDemo;