import React, { useState, useEffect } from 'react';

interface SettingsProps {
  onSettingsChange?: () => void;
}

export default function Settings({ onSettingsChange }: SettingsProps) {
  const [geminiKey, setGeminiKey] = useState('');
  const [sunoCookie, setSunoCookie] = useState('');
  const [showGemini, setShowGemini] = useState(false);
  const [showSuno, setShowSuno] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const key = data.geminiApiKey || localStorage.getItem('gemini_api_key') || '';
        const cookie = data.sunoCookie || localStorage.getItem('suno_cookie') || '';
        setGeminiKey(key);
        setSunoCookie(cookie);
        if (key) localStorage.setItem('gemini_api_key', key);
        if (cookie) localStorage.setItem('suno_cookie', cookie);
      })
      .catch(err => {
        console.error('Error fetching settings from backend:', err);
        const savedGemini = localStorage.getItem('gemini_api_key') || '';
        const savedSuno = localStorage.getItem('suno_cookie') || '';
        setGeminiKey(savedGemini);
        setSunoCookie(savedSuno);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          geminiApiKey: geminiKey,
          sunoCookie: sunoCookie,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('gemini_api_key', geminiKey);
        localStorage.setItem('suno_cookie', sunoCookie);
        setStatusMessage('Settings saved successfully!');
        if (onSettingsChange) {
          onSettingsChange();
        }
      } else {
        setStatusMessage(`Error: ${data.error || 'Failed to save settings'}`);
      }
    } catch (err: any) {
      console.error('Error saving settings to backend:', err);
      setStatusMessage('Error saving settings to backend.');
    }
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleClear = async () => {
    if (window.confirm('Are you sure you want to clear your credentials? This will remove system API integrations.')) {
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            geminiApiKey: '',
            sunoCookie: '',
          }),
        });
      } catch (err) {
        console.error('Error clearing settings on backend:', err);
      }
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('suno_cookie');
      setGeminiKey('');
      setSunoCookie('');
      setStatusMessage('Credentials cleared successfully.');
      if (onSettingsChange) {
        onSettingsChange();
      }
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Workspace Settings</h1>
          <p className="subtitle">Configure integration tokens, developer credentials, and API environment setups.</p>
        </div>
      </div>

      <div className="settings-grid">
        <form onSubmit={handleSave} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(to right, var(--color-primary), var(--color-secondary))' }} />

          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.3rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem', marginTop: '0.5rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--color-secondary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25z" />
            </svg>
            System Credentials
          </h2>

          <div className="input-group credential-field" style={{ marginBottom: '0.5rem' }}>
            <label htmlFor="gemini-key" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Gemini API Key</label>
            <input
              id="gemini-key"
              type={showGemini ? 'text' : 'password'}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="credential-input"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-light)',
                borderRadius: '10px',
                padding: '0.8rem 1rem',
                color: 'white',
                fontSize: '0.95rem'
              }}
            />
            <button
              type="button"
              className="visibility-toggle"
              onClick={() => setShowGemini(!showGemini)}
              title={showGemini ? 'Hide API Key' : 'Show API Key'}
              style={{ top: '35px' }}
            >
              {showGemini ? (
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>

          <div className="input-group credential-field" style={{ marginBottom: '0.5rem' }}>
            <label htmlFor="suno-cookie" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Suno Session Cookie</label>
            <textarea
              id="suno-cookie"
              rows={4}
              value={sunoCookie}
              onChange={(e) => setSunoCookie(e.target.value)}
              placeholder="Paste your Suno.com session cookie values..."
              style={{
                width: '100%',
                paddingRight: '3rem',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-light)',
                borderRadius: '10px',
                color: 'white',
                lineHeight: '1.4'
              }}
            />
            <button
              type="button"
              className="visibility-toggle"
              onClick={() => setShowSuno(!showSuno)}
              style={{ top: '42px' }}
              title={showSuno ? 'Hide Cookie' : 'Show Cookie'}
            >
              {showSuno ? (
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>

          {statusMessage && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(0, 240, 255, 0.08)',
              border: '1px solid var(--color-secondary)',
              color: 'var(--color-secondary)',
              fontSize: '0.9rem',
              textAlign: 'center',
              fontWeight: 600,
              boxShadow: '0 0 10px rgba(0, 240, 255, 0.1)'
            }}>
              {statusMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.8rem', fontWeight: 700 }}>
              Save Credentials
            </button>
            <button type="button" onClick={handleClear} className="btn-secondary" style={{ padding: '0.8rem', fontWeight: 600 }}>
              Clear All
            </button>
          </div>
        </form>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(to right, var(--color-accent), var(--color-primary))' }} />

          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.3rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem', marginTop: '0.5rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--color-accent)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0110.2 21a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.748 3.748 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0113.8 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
            System Bridges
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-light)', padding: '0.85rem 1rem', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'white' }}>Gemini Pro LLM Engine</span>
              <span className={`status-badge ${geminiKey ? 'connected' : 'disconnected'}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: geminiKey ? 'var(--color-secondary)' : 'var(--color-accent)', boxShadow: geminiKey ? '0 0 8px var(--color-secondary)' : '0 0 8px var(--color-accent)' }} />
                {geminiKey ? 'ACTIVE' : 'DISCONNECTED'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-light)', padding: '0.85rem 1rem', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'white' }}>Suno API Bridge</span>
              <span className={`status-badge ${sunoCookie ? 'connected' : 'disconnected'}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: sunoCookie ? 'var(--color-secondary)' : 'var(--color-accent)', boxShadow: sunoCookie ? '0 0 8px var(--color-secondary)' : '0 0 8px var(--color-accent)' }} />
                {sunoCookie ? 'ACTIVE COOKIE' : 'NO COOKIE'}
              </span>
            </div>
          </div>

          <div style={{
            marginTop: '1.25rem',
            padding: '1.25rem',
            borderRadius: '14px',
            backgroundColor: 'rgba(7, 8, 14, 0.4)',
            border: '1px solid var(--border-light)',
            fontSize: '0.85rem',
            lineHeight: '1.5',
            color: 'var(--text-secondary)'
          }}>
            <h3 style={{ color: 'white', marginBottom: '0.6rem', fontSize: '0.95rem', fontWeight: 600 }}>Setup Reference Guide</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p>
                1. <strong>Gemini Key:</strong> Obtain a free key from <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-secondary)', textDecoration: 'none', fontWeight: 600 }}>Google AI Studio</a> to enable prompt engineering & master song fixers.
              </p>
              <p>
                2. <strong>Suno Cookie:</strong> Authenticate on Suno.com, open browser Inspector (F12) → Application/Storage → Cookies, and paste the session cookies into the bridge field.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
