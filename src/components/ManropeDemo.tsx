import React from 'react';

const ManropeDemo: React.FC = () => {
  return (
    <div className="p-8" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Section */}
      <header className="mb-8">
        <h1 className="display-1 mb-4">Tacctile</h1>
        <p className="lead">Manrope Typography System - All Weights Demonstrated</p>
      </header>

      {/* Weight Showcase */}
      <section className="mb-8">
        <h2 className="heading-2 mb-6">Manrope Weight Variants</h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="font-extralight text-4xl">200 - ExtraLight: Professional Paranormal Investigation</div>
          <div className="font-light text-4xl">300 - Light: Advanced Detection Systems</div>
          <div className="font-regular text-4xl">400 - Regular: Evidence Analysis Platform</div>
          <div className="font-medium text-4xl">500 - Medium: Real-time EMF Monitoring</div>
          <div className="font-semibold text-4xl">600 - SemiBold: Temperature Anomaly Detection</div>
          <div className="font-bold text-4xl">700 - Bold: Audio Spectrum Analysis</div>
          <div className="font-extrabold text-4xl">800 - ExtraBold: Visual Pattern Recognition</div>
        </div>
      </section>

      {/* Typography Scale */}
      <section className="mb-8">
        <h2 className="heading-2 mb-6">Typography Scale</h2>
        
        <div style={{ display: 'grid', gap: '2rem' }}>
          {/* Display Sizes */}
          <div>
            <h3 className="heading-4 mb-4">Display</h3>
            <div className="display-1">Display 1 - Hero Text</div>
            <div className="display-2">Display 2 - Large Headers</div>
            <div className="display-3">Display 3 - Section Headers</div>
          </div>

          {/* Headings */}
          <div>
            <h3 className="heading-4 mb-4">Headings</h3>
            <h1 className="heading-1">Heading 1 - Main Title</h1>
            <h2 className="heading-2">Heading 2 - Major Section</h2>
            <h3 className="heading-3">Heading 3 - Subsection</h3>
            <h4 className="heading-4">Heading 4 - Component Title</h4>
            <h5 className="heading-5">Heading 5 - Card Header</h5>
            <h6 className="heading-6">Heading 6 - Small Header</h6>
          </div>

          {/* Body Text */}
          <div>
            <h3 className="heading-4 mb-4">Body Text</h3>
            <p className="body-xl">Body XL - Large paragraph text for emphasis and readability in primary content areas.</p>
            <p className="body-lg">Body Large - Enhanced readability for important content sections and introductions.</p>
            <p className="body-md">Body Medium - Standard paragraph text for general content and descriptions throughout the application.</p>
            <p className="body-sm">Body Small - Compact text for secondary information and supporting details.</p>
            <p className="body-xs">Body XS - Minimal text for captions, timestamps, and tertiary information.</p>
          </div>

          {/* Labels & Buttons */}
          <div>
            <h3 className="heading-4 mb-4">UI Elements</h3>
            <div className="label-xl mb-2">LABEL EXTRA LARGE</div>
            <div className="label-lg mb-2">LABEL LARGE</div>
            <div className="label-md mb-2">LABEL MEDIUM</div>
            <div className="label-sm mb-4">LABEL SMALL</div>
            
            <button className="button-lg" style={{ 
              padding: '12px 24px', 
              backgroundColor: '#8b5cf6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px',
              marginRight: '1rem'
            }}>
              BUTTON LARGE
            </button>
            <button className="button-md" style={{ 
              padding: '8px 20px', 
              backgroundColor: '#8b5cf6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px',
              marginRight: '1rem'
            }}>
              BUTTON MEDIUM
            </button>
            <button className="button-sm" style={{ 
              padding: '6px 16px', 
              backgroundColor: '#8b5cf6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px'
            }}>
              BUTTON SMALL
            </button>
          </div>

          {/* Captions */}
          <div>
            <h3 className="heading-4 mb-4">Supporting Text</h3>
            <div className="caption-lg mb-2">Caption Large - Additional information and metadata</div>
            <div className="caption-md">Caption Medium - Timestamps and small details</div>
          </div>
        </div>
      </section>

      {/* Practical Examples */}
      <section className="mb-8">
        <h2 className="heading-2 mb-6">Practical Application</h2>
        
        {/* Card Example */}
        <div style={{ 
          backgroundColor: '#1f2937', 
          padding: '2rem', 
          borderRadius: '12px',
          marginBottom: '2rem'
        }}>
          <h3 className="heading-3 mb-2">EMF Detection Alert</h3>
          <div className="label-md uppercase mb-3" style={{ color: '#22d3ee' }}>ACTIVE MONITORING</div>
          <p className="body-lg mb-4">
            Electromagnetic field anomaly detected in the northeast sector. 
            Readings show a <strong className="font-bold">3.5 milligauss spike</strong> above baseline levels.
          </p>
          <div className="caption-lg" style={{ color: '#9ca3af' }}>
            Last updated: 2 minutes ago • Sensor ID: EMF-001
          </div>
        </div>

        {/* Data Display */}
        <div style={{ 
          backgroundColor: '#111827', 
          padding: '2rem', 
          borderRadius: '12px'
        }}>
          <h4 className="heading-4 mb-4">Evidence Summary</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
            <div>
              <div className="label-sm uppercase mb-1" style={{ color: '#9ca3af' }}>Temperature</div>
              <div className="text-3xl font-bold" style={{ color: '#3b82f6' }}>-4.2°C</div>
              <div className="caption-md">Below baseline</div>
            </div>
            <div>
              <div className="label-sm uppercase mb-1" style={{ color: '#9ca3af' }}>EMF Level</div>
              <div className="text-3xl font-semibold" style={{ color: '#10b981' }}>2.8 mG</div>
              <div className="caption-md">Within normal</div>
            </div>
            <div>
              <div className="label-sm uppercase mb-1" style={{ color: '#9ca3af' }}>Audio Anomalies</div>
              <div className="text-3xl font-medium" style={{ color: '#f59e0b' }}>3</div>
              <div className="caption-md">Requires review</div>
            </div>
          </div>
        </div>
      </section>

      {/* Typography Guidelines */}
      <section>
        <h2 className="heading-2 mb-6">Usage Guidelines</h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <h5 className="heading-5 mb-2">Weight Usage</h5>
            <ul style={{ lineHeight: '2' }}>
              <li><span className="font-extralight">ExtraLight (200)</span> - Large display text, subtle headers</li>
              <li><span className="font-light">Light (300)</span> - Elegant body text, quotes</li>
              <li><span className="font-regular">Regular (400)</span> - Standard body text</li>
              <li><span className="font-medium">Medium (500)</span> - UI labels, navigation</li>
              <li><span className="font-semibold">SemiBold (600)</span> - Buttons, emphasis</li>
              <li><span className="font-bold">Bold (700)</span> - Headers, important text</li>
              <li><span className="font-extrabold">ExtraBold (800)</span> - Hero text, strong emphasis</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ManropeDemo;