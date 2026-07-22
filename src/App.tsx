import { useState, useEffect } from 'react';
import SongwritingAssistant from './components/SongwritingAssistant';
import StyleManager, { StylePreset } from './components/StyleManager';
import SongAnalyzer from './components/SongAnalyzer';
import Settings from './components/Settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<'assistant' | 'styles' | 'analyzer' | 'settings'>('assistant');
  
  // State to pass presets between Style Manager and Songwriting Assistant
  const [appliedStylePrompt, setAppliedStylePrompt] = useState('');
  const [appliedBpm, setAppliedBpm] = useState(120);

  // Status indicators for credentials
  const [credentialsConfigured, setCredentialsConfigured] = useState({
    gemini: false,
    suno: false
  });

  const checkCredentials = async () => {
    let gemini = !!localStorage.getItem('gemini_api_key');
    let suno = !!localStorage.getItem('suno_cookie');

    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.geminiApiKey) {
          localStorage.setItem('gemini_api_key', data.geminiApiKey);
          gemini = true;
        }
        if (data.sunoCookie) {
          localStorage.setItem('suno_cookie', data.sunoCookie);
          suno = true;
        }
      }
    } catch (err) {
      console.warn('Backend settings query on mount failed, relying on localStorage:', err);
    }

    setCredentialsConfigured({ gemini, suno });
  };

  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    checkCredentials();

    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isMobileWidth = window.innerWidth <= 1024;
      setIsMobile(isMobileUA || isMobileWidth);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleApplyStyle = (style: StylePreset) => {
    setAppliedStylePrompt(style.prompt);
    setAppliedBpm(style.bpm);
    setActiveTab('assistant');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'assistant':
        return (
          <SongwritingAssistant 
            initialStylePrompt={appliedStylePrompt} 
            initialBpm={appliedBpm} 
          />
        );
      case 'styles':
        return <StyleManager onSelectStyle={handleApplyStyle} />;
      case 'analyzer':
        return <SongAnalyzer />;
      case 'settings':
        return <Settings onSettingsChange={checkCredentials} />;
      default:
        return <SongwritingAssistant />;
    }
  };

  return (
    <div className={`app-layout ${isMobile ? 'mobile-layout' : ''}`}>
      {/* Background Ambient Glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />
      <div className="ambient-glow-3" />

      {/* Mobile Header */}
      {isMobile && (
        <header className="mobile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="menu-toggle-btn" onClick={() => setSidebarOpen(true)} title="Open menu">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '24px', height: '24px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div className="logo-icon">S</div>
            <div className="logo-text">SUNO<span>Companion</span></div>
          </div>
          <div className="mobile-header-status" title={credentialsConfigured.gemini && credentialsConfigured.suno ? 'Online & Configured' : 'Credentials Missing'}>
            <span className={`status-dot ${credentialsConfigured.gemini && credentialsConfigured.suno ? 'online' : 'offline'}`} />
          </div>
        </header>
      )}

      {/* Sidebar Navigation */}
      {(!isMobile || sidebarOpen) && (
        <>
          {isMobile && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
          <aside className={`sidebar ${isMobile ? 'mobile-drawer' : ''}`}>
            <div className="sidebar-header">
              <div className="logo-icon">S</div>
              <div className="logo-text">SUNO<span>Companion</span></div>
              {isMobile && (
                <button className="close-sidebar-btn" onClick={() => setSidebarOpen(false)} title="Close menu">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <ul className="sidebar-menu">
              <li 
                className={`menu-item ${activeTab === 'assistant' ? 'active' : ''}`}
                onClick={() => { setActiveTab('assistant'); if (isMobile) setSidebarOpen(false); }}
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Songwriting Assistant
              </li>

              <li 
                className={`menu-item ${activeTab === 'styles' ? 'active' : ''}`}
                onClick={() => { setActiveTab('styles'); if (isMobile) setSidebarOpen(false); }}
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122l9.37-9.37M9.53 16.122a3 3 0 10-4.242 4.243 3 3 0 004.242-4.243zm9.37-9.37a3 3 0 11-4.243-4.242 3 3 0 014.243 4.242z" />
                </svg>
                Style Manager
              </li>

              <li 
                className={`menu-item ${activeTab === 'analyzer' ? 'active' : ''}`}
                onClick={() => { setActiveTab('analyzer'); if (isMobile) setSidebarOpen(false); }}
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                </svg>
                Song Analyzer
              </li>

              <li 
                className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => { setActiveTab('settings'); if (isMobile) setSidebarOpen(false); }}
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </li>
            </ul>

            <div className="sidebar-footer">
              <div className="footer-avatar">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0110.2 21a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.748 3.748 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0113.8 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>System Integration</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: credentialsConfigured.gemini && credentialsConfigured.suno ? 'var(--color-secondary)' : 'var(--color-accent)',
                    boxShadow: credentialsConfigured.gemini && credentialsConfigured.suno ? '0 0 8px var(--color-secondary)' : '0 0 8px var(--color-accent)'
                  }} />
                  <span style={{ fontSize: '0.75rem' }}>
                    {credentialsConfigured.gemini && credentialsConfigured.suno ? 'Online & Configured' : 'Credentials Missing'}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Main View Area */}
      <main className="main-content">
        {renderContent()}
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="mobile-nav">
          <button 
            className={`mobile-nav-item ${activeTab === 'assistant' ? 'active' : ''}`}
            onClick={() => setActiveTab('assistant')}
          >
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            <span>Assistant</span>
          </button>

          <button 
            className={`mobile-nav-item ${activeTab === 'styles' ? 'active' : ''}`}
            onClick={() => setActiveTab('styles')}
          >
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122l9.37-9.37M9.53 16.122a3 3 0 10-4.242 4.243 3 3 0 004.242-4.243zm9.37-9.37a3 3 0 11-4.243-4.242 3 3 0 014.243 4.242z" />
            </svg>
            <span>Styles</span>
          </button>

          <button 
            className={`mobile-nav-item ${activeTab === 'analyzer' ? 'active' : ''}`}
            onClick={() => setActiveTab('analyzer')}
          >
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
            </svg>
            <span>Analyzer</span>
          </button>

          <button 
            className={`mobile-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
          </button>
        </nav>
      )}
    </div>
  );
}
