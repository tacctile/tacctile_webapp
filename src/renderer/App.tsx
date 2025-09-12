import React, { useState } from 'react';
import DesignTokensDemo from '../components/DesignTokensDemo';
import { SocialHub } from '../components/social-hub';
import '../components/social-hub/SocialHub.css';

type TabId = 'home' | 'social' | 'design';

interface Tab {
  id: TabId;
  label: string;
  component: React.ComponentType;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('home');

  const tabs: Tab[] = [
    { id: 'home', label: 'Home', component: () => <div className="tab-content"><h1>Ghost Hunter Toolbox</h1><p>Professional paranormal evidence analysis software</p></div> },
    { id: 'social', label: 'Social Hub', component: SocialHub },
    { id: 'design', label: 'Design System', component: DesignTokensDemo },
  ];

  const renderTabContent = () => {
    const activeTabData = tabs.find(tab => tab.id === activeTab);
    if (!activeTabData) return null;
    
    const Component = activeTabData.component;
    return <Component />;
  };

  return (
    <div className="app">
      <nav className="app-navigation">
        <div className="nav-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      
      <main className="app-content">
        {renderTabContent()}
      </main>

      <style jsx>{`
        .app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--background-primary, #f8fafc);
        }

        .app-navigation {
          background: var(--surface-primary, #ffffff);
          border-bottom: 1px solid var(--border-color, #e5e7eb);
          padding: 0 24px;
        }

        .nav-tabs {
          display: flex;
          gap: 0;
          max-width: 1200px;
          margin: 0 auto;
        }

        .nav-tab {
          padding: 16px 24px;
          background: none;
          border: none;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary, #6b7280);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }

        .nav-tab:hover {
          color: var(--text-primary, #1f2937);
          background: var(--surface-secondary, #f8fafc);
        }

        .nav-tab.active {
          color: var(--primary, #3b82f6);
          border-bottom-color: var(--primary, #3b82f6);
          background: var(--surface-secondary, #f8fafc);
        }

        .app-content {
          flex: 1;
          overflow-y: auto;
          background: var(--background-primary, #f8fafc);
        }

        .tab-content {
          padding: 48px 24px;
          text-align: center;
          max-width: 800px;
          margin: 0 auto;
        }

        .tab-content h1 {
          font-size: 3rem;
          font-weight: 700;
          margin-bottom: 16px;
          color: var(--text-primary, #1f2937);
        }

        .tab-content p {
          font-size: 1.25rem;
          color: var(--text-secondary, #6b7280);
          margin: 0;
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .app {
            background: var(--background-primary-dark, #111827);
          }

          .app-navigation {
            background: var(--surface-primary-dark, #1f2937);
            border-bottom-color: var(--border-color-dark, #374151);
          }

          .nav-tab {
            color: var(--text-secondary-dark, #d1d5db);
          }

          .nav-tab:hover {
            color: var(--text-primary-dark, #f9fafb);
            background: var(--surface-secondary-dark, #374151);
          }

          .nav-tab.active {
            background: var(--surface-secondary-dark, #374151);
          }

          .app-content {
            background: var(--background-primary-dark, #111827);
          }

          .tab-content h1 {
            color: var(--text-primary-dark, #f9fafb);
          }

          .tab-content p {
            color: var(--text-secondary-dark, #d1d5db);
          }
        }
      `}</style>
    </div>
  );
};

export default App;