import React, { useState } from 'react';
import { useTheme } from '../utils/theme-manager';
import { Icon } from './Icon';
import { GhostIcons } from '../config/ghost-icons';

const DesignTokensDemo: React.FC = () => {
  const { toggleTheme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('colors');

  // Color categories
  const colorCategories = {
    primary: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '95', '99', '100'],
    secondary: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '95', '99', '100'],
    tertiary: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '95', '99', '100'],
    error: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '95', '99', '100'],
    neutral: ['0', '4', '6', '10', '12', '17', '20', '22', '24', '30', '40', '50', '60', '70', '80', '87', '90', '92', '94', '95', '96', '98', '99', '100']
  };

  // Spacing values
  const spacingValues = ['0', 'px', '0_5', '1', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20', '24', '32'];
  
  // Shadow levels
  const shadowLevels = ['sm', 'base', 'md', 'lg', 'xl', '2xl'];
  const elevationLevels = ['0', '1', '2', '3', '4', '5'];
  
  // Border radius values
  const radiusValues = ['none', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', 'full'];

  const tabs = ['colors', 'spacing', 'typography', 'shadows', 'animations'];

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-surface-container-high elevation-2 sticky top-0 z-sticky">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="heading-1 text-primary">Design Tokens System</h1>
              <p className="body-lg text-surface-variant mt-2">
                Comprehensive CSS Custom Properties for Tacctile
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary-container rounded-lg transition-all hover:elevation-2"
            >
              <Icon 
                icon={isDark ? GhostIcons.environment.night : GhostIcons.environment.day} 
                size="md" 
              />
              <span className="font-medium">{isDark ? 'Dark' : 'Light'} Theme</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-surface-container border-b border-outline-variant sticky top-20 z-sticky">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2 overflow-x-auto py-2">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-all whitespace-nowrap ${
                  activeTab === tab 
                    ? 'bg-primary text-on-primary' 
                    : 'bg-surface-container-low text-surface hover:bg-surface-container'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Colors Tab */}
        {activeTab === 'colors' && (
          <div className="space-y-8">
            <section>
              <h2 className="heading-2 mb-6">Theme Colors</h2>
              <div className="grid gap-6">
                {/* Primary Palette */}
                <div>
                  <h3 className="heading-4 mb-3">Primary Palette</h3>
                  <div className="flex gap-1 overflow-x-auto pb-2">
                    {colorCategories.primary.map(tone => (
                      <div key={tone} className="flex-shrink-0">
                        <div 
                          className="w-16 h-16 rounded-lg border border-outline-variant"
                          style={{ backgroundColor: `var(--color-primary-${tone})` }}
                        />
                        <div className="text-xs text-center mt-1">{tone}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Secondary Palette */}
                <div>
                  <h3 className="heading-4 mb-3">Secondary Palette</h3>
                  <div className="flex gap-1 overflow-x-auto pb-2">
                    {colorCategories.secondary.map(tone => (
                      <div key={tone} className="flex-shrink-0">
                        <div 
                          className="w-16 h-16 rounded-lg border border-outline-variant"
                          style={{ backgroundColor: `var(--color-secondary-${tone})` }}
                        />
                        <div className="text-xs text-center mt-1">{tone}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Surface Colors */}
                <div>
                  <h3 className="heading-4 mb-3">Surface Containers</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {['lowest', 'low', '', 'high', 'highest'].map(level => (
                      <div 
                        key={level}
                        className={`p-4 rounded-lg border border-outline-variant bg-surface-container${level ? `-${level}` : ''}`}
                      >
                        <div className="font-medium">Container{level && ` ${level}`}</div>
                        <div className="text-xs text-surface-variant mt-1">
                          {level || 'default'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Semantic Colors */}
            <section>
              <h2 className="heading-2 mb-6">Semantic Colors</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-primary text-on-primary p-4 rounded-lg">
                  <div className="font-semibold">Primary</div>
                </div>
                <div className="bg-secondary text-on-secondary p-4 rounded-lg">
                  <div className="font-semibold">Secondary</div>
                </div>
                <div className="bg-tertiary text-on-tertiary p-4 rounded-lg">
                  <div className="font-semibold">Tertiary</div>
                </div>
                <div className="bg-error text-on-error p-4 rounded-lg">
                  <div className="font-semibold">Error</div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Spacing Tab */}
        {activeTab === 'spacing' && (
          <div className="space-y-8">
            <section>
              <h2 className="heading-2 mb-6">Spacing Scale</h2>
              <div className="space-y-2">
                {spacingValues.map(value => (
                  <div key={value} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-mono">--spacing-{value}</div>
                    <div 
                      className="bg-primary h-8 rounded"
                      style={{ width: `var(--spacing-${value.replace('_', '\\.')})` }}
                    />
                    <div className="text-sm text-surface-variant">
                      {value === '0' ? '0' : 
                       value === 'px' ? '1px' :
                       value.includes('_') ? `${parseFloat(value.replace('_', '.')) * 4}px` :
                       `${parseInt(value) * 4}px`}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="heading-2 mb-6">Sizing Examples</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {['4', '8', '12', '16', '24', '32'].map(size => (
                  <div key={size} className="flex flex-col items-center gap-2">
                    <div 
                      className={`w-${size} h-${size} bg-primary-container rounded-lg`}
                      style={{ 
                        width: `var(--size-${size})`,
                        height: `var(--size-${size})`
                      }}
                    />
                    <div className="text-sm">Size {size}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Typography Tab */}
        {activeTab === 'typography' && (
          <div className="space-y-8">
            <section>
              <h2 className="heading-2 mb-6">Typography Scale</h2>
              <div className="space-y-4">
                {['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'].map(size => (
                  <div key={size} className="border-b border-outline-variant pb-2">
                    <div 
                      style={{ fontSize: `var(--text-${size})` }}
                      className="font-medium"
                    >
                      Text {size} - The quick brown fox jumps over the lazy dog
                    </div>
                    <div className="text-xs text-surface-variant mt-1">
                      var(--text-{size})
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="heading-2 mb-6">Font Weights</h2>
              <div className="space-y-2">
                {[
                  { name: 'extralight', value: '200' },
                  { name: 'light', value: '300' },
                  { name: 'normal', value: '400' },
                  { name: 'medium', value: '500' },
                  { name: 'semibold', value: '600' },
                  { name: 'bold', value: '700' },
                  { name: 'extrabold', value: '800' }
                ].map(weight => (
                  <div 
                    key={weight.name}
                    style={{ fontWeight: `var(--font-${weight.name})` }}
                    className="text-xl"
                  >
                    {weight.name} ({weight.value}) - Tacctile
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Shadows Tab */}
        {activeTab === 'shadows' && (
          <div className="space-y-8">
            <section>
              <h2 className="heading-2 mb-6">Box Shadows</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {shadowLevels.map(level => (
                  <div 
                    key={level}
                    className={`p-6 bg-surface-container rounded-lg shadow-${level}`}
                    style={{ boxShadow: `var(--shadow-${level})` }}
                  >
                    <div className="font-medium">Shadow {level}</div>
                    <div className="text-sm text-surface-variant mt-1">
                      var(--shadow-{level})
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="heading-2 mb-6">Material 3 Elevation</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {elevationLevels.map(level => (
                  <div 
                    key={level}
                    className={`p-6 bg-surface-container rounded-lg elevation-${level}`}
                  >
                    <div className="font-medium">Elevation {level}</div>
                    <div className="text-sm text-surface-variant mt-1">
                      {level === '0' ? 'Flat' : `${parseInt(level) * 2}dp elevation`}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="heading-2 mb-6">Border Radius</h2>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                {radiusValues.map(radius => (
                  <div 
                    key={radius}
                    className={`p-4 bg-primary-container text-center rounded-${radius}`}
                    style={{ borderRadius: `var(--radius-${radius})` }}
                  >
                    <div className="text-sm font-medium">{radius}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Animations Tab */}
        {activeTab === 'animations' && (
          <div className="space-y-8">
            <section>
              <h2 className="heading-2 mb-6">Transition Durations</h2>
              <div className="space-y-4">
                {['instant', 'fast', 'base', 'moderate', 'slow', 'slower', 'slowest'].map(duration => (
                  <div key={duration} className="flex items-center gap-4">
                    <div className="w-24 text-sm">{duration}</div>
                    <div 
                      className="w-16 h-16 bg-primary rounded-lg cursor-pointer transition-transform hover:scale-110"
                      style={{ transitionDuration: `var(--duration-${duration})` }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    />
                    <div className="text-sm text-surface-variant">
                      Hover to see transition
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="heading-2 mb-6">Easing Functions</h2>
              <div className="space-y-4">
                {['linear', 'in', 'out', 'in-out', 'emphasized', 'spring'].map(easing => (
                  <div key={easing} className="flex items-center gap-4">
                    <div className="w-24 text-sm">ease-{easing}</div>
                    <div 
                      className="w-16 h-16 bg-secondary rounded-lg cursor-pointer transition-all hover:translate-x-20"
                      style={{ 
                        transitionDuration: '1s',
                        transitionTimingFunction: `var(--ease-${easing})`
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(5rem)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                    />
                    <div className="text-sm text-surface-variant">
                      Hover to see easing
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default DesignTokensDemo;