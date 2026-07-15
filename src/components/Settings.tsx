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
        setGeminiKey(data.geminiApiKey || '');
        setSunoCookie(data.sunoCookie || '');
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
    if (window.confirm('Are you sure you want to clear your credentials?')) {
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
      setStatusMessage('Credentials cleared.');
      if (onSettingsChange) {
        onSettingsChange();
      }
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  return (
    <div>
      <h1>Workspace Settings</h1>
      <p className="subtitle">Configure your developer integration credentials and API configurations.</p>

      <div className="settings-grid">
        <form onSubmit={handleSave} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            Credentials Configuration
          </h2>

          <div className="input-group credential-field">
            <label htmlFor="gemini-key">Gemini API Key</label>
            <input
              id="gemini-key"
              type={showGemini ? 'text' : 'password'}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="credential-input"
            />
            <button
              type="button"
              className="visibility-toggle"
              onClick={() => setShowGemini(!showGemini)}
              title={showGemini ? 'Hide API Key' : 'Show API Key'}
            >
              {showGemini ? (
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>

          <div className="input-group credential-field">
            <label htmlFor="suno-cookie">Suno Session Cookie</label>
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
                fontSize: '0.85rem'
              }}
            />
            <button
              type="button"
              className="visibility-toggle"
              onClick={() => setShowSuno(!showSuno)}
              style={{ top: '48px' }}
              title={showSuno ? 'Hide Cookie' : 'Show Cookie'}
            >
              {showSuno ? (
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
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
              backgroundColor: 'rgba(0, 240, 255, 0.1)',
              border: '1px solid var(--color-secondary)',
              color: 'var(--color-secondary)',
              fontSize: '0.9rem',
              textAlign: 'center',
              animation: 'pulse-slow 2s infinite'
            }}>
              {statusMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>
              Save Credentials
            </button>
            <button type="button" onClick={handleClear} className="btn-secondary">
              Clear All
            </button>
          </div>
        </form>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            Integration Status
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.95rem' }}>Gemini Pro LLM Engine</span>
              <span className={`status-badge ${geminiKey ? 'connected' : 'disconnected'}`}>
                {geminiKey ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.95rem' }}>Suno API Bridge</span>
              <span className={`status-badge ${sunoCookie ? 'connected' : 'disconnected'}`}>
                {sunoCookie ? 'ACTIVE COOKIE' : 'NO COOKIE'}
              </span>
            </div>
          </div>

          <div style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-light)',
            fontSize: '0.85rem',
            lineHeight: '1.5',
            color: 'var(--text-secondary)'
          }}>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.95rem' }}>Setup Guide</h3>
            <p style={{ marginBottom: '0.5rem' }}>
              1. <strong>Gemini Key:</strong> Create a API key in <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-secondary)', textDecoration: 'none' }}>Google AI Studio</a>.
            </p>
            <p>
              2. <strong>Suno Cookie:</strong> Log in to suno.com in your browser, open Developer Tools (F12), check the Network tab or Application (Cookies) panel, and copy the session cookies (specifically the <code>__client</code> or <code>session_id</code> properties) to feed to the API agent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
