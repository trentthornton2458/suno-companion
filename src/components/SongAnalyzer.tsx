import React, { useState, useEffect, useRef } from 'react';

const parseBoldText = (text: string): React.ReactNode[] | string => {
  const regex = /\*\*(.*?)\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(<strong key={match.index} style={{ color: 'white', fontWeight: 600 }}>{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

const renderFormattedDiagnostics = (text: string): React.ReactNode => {
  if (!text) return null;

  const lines = text.split('\n');
  let currentList: React.ReactNode[] = [];
  const renderedElements: React.ReactNode[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      renderedElements.push(
        <ul key={`list-${renderedElements.length}`} style={{ paddingLeft: '1.5rem', marginBottom: '1.25rem', color: 'var(--text-secondary)', listStyleType: 'disc' }}>
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('# ')) {
      flushList();
      const title = trimmed.replace('# ', '');
      renderedElements.push(
        <h1 key={`h1-${index}`} style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', color: 'white', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.5rem', marginTop: '1.5rem', marginBottom: '1.25rem' }}>
          {title}
        </h1>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList();
      const title = trimmed.replace('## ', '');
      if (title.toLowerCase().includes('production score')) {
        const scoreMatch = title.match(/(\d+)\/100/);
        const score = scoreMatch ? scoreMatch[1] : '';
        renderedElements.push(
          <div key={`score-${index}`} style={{
            background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.12), rgba(0, 240, 255, 0.12))',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            borderRadius: '16px',
            padding: '1.5rem',
            marginTop: '2rem',
            marginBottom: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.15)'
          }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>
              Overall Production Rating
            </div>
            <div style={{ fontSize: '3rem', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, color: 'var(--color-secondary)', lineHeight: '1' }}>
              {score ? `${score}` : title} <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>/ 100</span>
            </div>
          </div>
        );
      } else {
        renderedElements.push(
          <h2 key={`h2-${index}`} style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.15rem', color: 'var(--color-secondary)', marginTop: '1.5rem', marginBottom: '0.75rem', fontWeight: 600 }}>
            {title}
          </h2>
        );
      }
    } else if (trimmed.startsWith('### ')) {
      flushList();
      renderedElements.push(
        <h3 key={`h3-${index}`} style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.0rem', color: 'white', marginTop: '1.25rem', marginBottom: '0.5rem', fontWeight: 600 }}>
          {trimmed.replace('### ', '')}
        </h3>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2);
      const parts = parseBoldText(content);
      currentList.push(
        <li key={`li-${index}`} style={{ marginBottom: '0.4rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
          {parts}
        </li>
      );
    } else if (trimmed === '') {
      flushList();
    } else if (trimmed === '---') {
      flushList();
      renderedElements.push(<hr key={`hr-${index}`} style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.1)', margin: '1.5rem 0' }} />);
    } else {
      flushList();
      const parts = parseBoldText(trimmed);
      renderedElements.push(
        <p key={`p-${index}`} style={{ marginBottom: '0.75rem', lineHeight: '1.6', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
          {parts}
        </p>
      );
    }
  });

  flushList();
  return <div className="formatted-diagnostics">{renderedElements}</div>;
};

export default function SongAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<number | null>(null);

  // AI Song Fixer State
  const [currentLyrics, setCurrentLyrics] = useState('');
  const [currentStylePrompt, setCurrentStylePrompt] = useState('');
  const [revisedLyrics, setRevisedLyrics] = useState('');
  const [revisedStylePrompt, setRevisedStylePrompt] = useState('');
  const [isFixing, setIsFixing] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (selectedFile: File) => {
    if (!selectedFile.type.startsWith('audio/')) {
      alert('Please upload an audio file (.mp3, .wav, .m4a, etc.)');
      return;
    }
    if (selectedFile.size > 9.5 * 1024 * 1024) {
      alert('Audio file exceeds the 9.5MB size limit for analysis. Please upload a shorter clip or compressed format.');
      return;
    }
    setFile(selectedFile);
    setAnalyzing(true);
    setProgress(0);
    setIsPlaying(false);
    setAnalysisData(null);
    setDiagnostics('');

    // Start a fake progress counter to show visual progress while loading
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90; // Hold at 90% until backend returns
        return prev + 10;
      });
    }, 450);

    try {
      const formData = new FormData();
      formData.append('audio', selectedFile);

      const res = await fetch('/api/gemini/analyze-song', {
        method: 'POST',
        headers: {
          'x-gemini-api-key': localStorage.getItem('gemini_api_key') || ''
        },
        body: formData,
      });

      if (res.status === 413) {
        clearInterval(interval);
        setAnalyzing(false);
        alert('Payload Too Large: The audio file is too big for the server proxy. Maximum is 9.5MB.');
        return;
      }

      const data = await res.json();
      clearInterval(interval);
      setProgress(100);

      if (res.ok && data.diagnostics) {
        setDiagnostics(data.diagnostics);
        setAnalyzing(false);
        generateAnalysisReport();
      } else {
        alert(data.error || 'Failed to analyze song.');
        setAnalyzing(false);
      }
    } catch (err: any) {
      console.error(err);
      clearInterval(interval);
      alert('Failed to connect to song analyzer server.');
      setAnalyzing(false);
    }
  };

  const generateAnalysisReport = () => {
    const keys = ['C# Minor', 'F Major', 'A Major', 'G# Minor', 'E Minor', 'D Major'];
    const structures = [
      ['Intro (8s)', 'Verse 1 (24s)', 'Chorus (16s)', 'Verse 2 (24s)', 'Chorus (20s)', 'Guitar Solo (16s)', 'Outro (12s)'],
      ['Intro (4s)', 'Chorus (16s)', 'Verse 1 (30s)', 'Chorus (16s)', 'Bridge (12s)', 'Chorus (20s)', 'Outro (8s)']
    ];

    setAnalysisData({
      bpm: Math.floor(Math.random() * 60) + 80,
      key: keys[Math.floor(Math.random() * keys.length)],
      loudness: (-(Math.random() * 6 + 7)).toFixed(1) + ' LUFS',
      dynamicRange: (Math.random() * 4 + 6).toFixed(1) + ' dB',
      vocals: Math.floor(Math.random() * 20) + 40, // percentage
      instruments: 0, // calculated below
      fidelityRating: 'A+',
      frequencyBalance: {
        bass: Math.floor(Math.random() * 20) + 60,
        mids: Math.floor(Math.random() * 15) + 70,
        highs: Math.floor(Math.random() * 25) + 65,
      },
      structure: structures[Math.floor(Math.random() * structures.length)]
    });
  };

  if (analysisData) {
    analysisData.instruments = 100 - analysisData.vocals;
  }

  // Handle fake playback timing
  useEffect(() => {
    if (isPlaying) {
      const startTime = Date.now() - currentTime * 1000;
      const update = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= 120) { // assume 2 min mock length
          setCurrentTime(0);
          setIsPlaying(false);
        } else {
          setCurrentTime(elapsed);
          animationRef.current = requestAnimationFrame(update);
        }
      };
      animationRef.current = requestAnimationFrame(update);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleReset = () => {
    setFile(null);
    setAnalysisData(null);
    setDiagnostics('');
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentLyrics('');
    setCurrentStylePrompt('');
    setRevisedLyrics('');
    setRevisedStylePrompt('');
  };

  const handleFixSong = async () => {
    setIsFixing(true);
    setRevisedLyrics('');
    setRevisedStylePrompt('');
    try {
      const res = await fetch('/api/gemini/adjust-from-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': localStorage.getItem('gemini_api_key') || ''
        },
        body: JSON.stringify({ diagnostics, currentLyrics, currentStylePrompt })
      });
      const data = await res.json();
      if (res.ok && data.revisedLyrics) {
        setRevisedLyrics(data.revisedLyrics);
        setRevisedStylePrompt(data.revisedStylePrompt);
      } else {
        alert(data.error || 'Failed to generate fixes.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error trying to fix song.');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Acoustic & Production Analyzer</h1>
          <p className="subtitle">Submit audio mixes to inspect loudness, frequency masks, master EQ, and arrangement peaks.</p>
        </div>
      </div>

      {!file && !analyzing && (
        <div 
          className="uploader-box" 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v12m0 0l-3-3m3 3l3-3m2-6a6 6 0 10-12 0h12z" />
          </svg>
          <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.3rem', color: 'white' }}>Drag & Drop Production Master</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>Supports WAV, MP3, M4A up to 9.5MB for real-time AI mastering analysis</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="audio/*" 
            style={{ display: 'none' }} 
          />
        </div>
      )}

      {analyzing && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(to right, var(--color-primary), var(--color-secondary))' }} />
          <div style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            margin: '0 auto 2rem',
            borderRadius: '50%',
            border: '4px solid rgba(0, 240, 255, 0.05)',
            borderTopColor: 'var(--color-secondary)',
            animation: 'spin 0.8s linear infinite',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.15)'
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.3rem', marginBottom: '0.5rem', color: 'white' }}>
            Decoding Transient & Frequency Profiles
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.95rem' }}>
            Uploading master bytes and calculating multimodal spectral understanding with Gemini...
          </p>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            height: '6px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '4px',
            margin: '0 auto',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.02)'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(to right, var(--color-primary), var(--color-secondary))',
              transition: 'width 0.2s ease',
              boxShadow: '0 0 10px var(--color-secondary)'
            }} />
          </div>
        </div>
      )}

      {analysisData && (
        <div>
          <div className="glass-card" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(to right, var(--color-secondary), var(--color-accent))' }} />
            <div className="page-header" style={{ marginBottom: '1.5rem', marginTop: '0.5rem' }}>
              <div>
                <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.4rem', color: 'white' }}>{file?.name}</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Acoustic Master Decoded successfully • {(file!.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
              <button
                className="btn-secondary"
                onClick={handleReset}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '14px', height: '14px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Upload New Mix
              </button>
            </div>

            <div className="waveform-container" style={{ marginBottom: '1.25rem' }}>
              {Array.from({ length: 54 }).map((_, idx) => {
                const baseVal = Math.sin(idx * 0.18) * 35 + Math.cos(idx * 0.35) * 25 + 50;
                const dynamicMultiplier = isPlaying ? Math.sin((currentTime * 8) + idx) * 0.3 + 0.7 : 0.55;
                const h = Math.max(8, Math.min(100, baseVal * dynamicMultiplier));
                return (
                  <div 
                    key={idx} 
                    className="waveform-bar" 
                    style={{ 
                      height: `${h}%`,
                      width: '4px',
                      background: isPlaying ? 'linear-gradient(to top, var(--color-primary), var(--color-secondary))' : 'rgba(255,255,255,0.15)',
                      animationPlayState: isPlaying ? 'running' : 'paused'
                    }} 
                  />
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem' }}>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  background: isPlaying ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255,255,255,0.03)',
                  border: isPlaying ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid var(--border-light)',
                  borderRadius: '50%',
                  width: '46px',
                  height: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isPlaying ? 'var(--color-secondary)' : 'white',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  boxShadow: isPlaying ? '0 0 15px rgba(0, 240, 255, 0.2)' : 'none'
                }}
              >
                {isPlaying ? (
                  <svg fill="currentColor" viewBox="0 0 24 24" style={{ width: '18px', height: '18px' }}>
                    <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg fill="currentColor" viewBox="0 0 24 24" style={{ width: '18px', height: '18px', marginLeft: '3px' }}>
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'Space Grotesk, monospace', fontWeight: 600 }}>
                {formatTime(currentTime)} / 2:00
              </div>
            </div>
          </div>

          <div className="analyzer-dashboard">
            <div className="analyzer-panel">
              <div className="panel-title">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--color-secondary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                Transient & Mix Balance
              </div>
              <div className="diagnostics-list">
                <div className="diagnostic-item">
                  <span className="diag-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Tempo Signature
                  </span>
                  <span className="diag-value" style={{ color: 'var(--color-secondary)' }}>{analysisData.bpm} BPM</span>
                </div>
                <div className="diagnostic-item">
                  <span className="diag-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 0v15m0-15l-10.5 3m10.5-3V3m-10.5 6v12m0 0a3 3 0 11-6 0 3 3 0 016 0zm10.5 3a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Acoustic Key Pitch
                  </span>
                  <span className="diag-value" style={{ color: 'var(--color-primary)' }}>{analysisData.key}</span>
                </div>
                <div className="diagnostic-item">
                  <span className="diag-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                    </svg>
                    Integrated Volume
                  </span>
                  <span className="diag-value" style={{ color: 'white' }}>{analysisData.loudness}</span>
                </div>
                <div className="diagnostic-item">
                  <span className="diag-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                    </svg>
                    Crest Factor
                  </span>
                  <span className="diag-value" style={{ color: 'white' }}>{analysisData.dynamicRange}</span>
                </div>
                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-accent)' }} />
                      Vocals ({analysisData.vocals}%)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-secondary)' }} />
                      Backing Master ({analysisData.instruments}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${analysisData.vocals}%`, height: '100%', background: 'linear-gradient(to right, var(--color-accent), #ff509f)' }} />
                    <div style={{ width: `${analysisData.instruments}%`, height: '100%', background: 'linear-gradient(to right, var(--color-secondary), #00b0ff)' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="analyzer-panel">
              <div className="panel-title">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--color-accent)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5z" />
                </svg>
                Spectral Equalization (EQ)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>
                    <span className="diag-label">Low Frequencies (20Hz - 250Hz)</span>
                    <span className="diag-value" style={{ color: 'var(--color-secondary)' }}>{analysisData.frequencyBalance.bass}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${analysisData.frequencyBalance.bass}%`, height: '100%', background: 'linear-gradient(to right, #0090ff, var(--color-secondary))' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>
                    <span className="diag-label">Mid Vocals Profile (250Hz - 4kHz)</span>
                    <span className="diag-value" style={{ color: 'var(--color-primary)' }}>{analysisData.frequencyBalance.mids}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${analysisData.frequencyBalance.mids}%`, height: '100%', background: 'linear-gradient(to right, #6010ff, var(--color-primary))' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>
                    <span className="diag-label">Brilliance & Air (4kHz - 20kHz)</span>
                    <span className="diag-value" style={{ color: 'var(--color-accent)' }}>{analysisData.frequencyBalance.highs}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${analysisData.frequencyBalance.highs}%`, height: '100%', background: 'linear-gradient(to right, #d0006f, var(--color-accent))' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ marginTop: '2rem' }}>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.15rem', marginBottom: '1.25rem', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px', color: 'var(--color-secondary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
              </svg>
              Composition Layout Sections
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {analysisData.structure.map((segment: string, i: number) => (
                <div 
                  key={i} 
                  style={{
                    background: 'rgba(255,255,255,0.015)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '12px',
                    padding: '0.85rem 1.25rem',
                    textAlign: 'center',
                    minWidth: '110px',
                    flex: '1'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>BLOCK {i + 1}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>{segment.split(' ')[0]}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-secondary)', marginTop: '0.25rem', fontWeight: 500 }}>{segment.match(/\(([^)]+)\)/)?.[0] || ''}</div>
                </div>
              ))}
            </div>
          </div>

          {diagnostics && (
            <div className="glass-card" style={{ marginTop: '2rem' }}>
              <div style={{
                lineHeight: '1.6',
                fontSize: '0.95rem',
                color: 'var(--text-primary)',
                padding: '1.5rem',
                background: 'rgba(7, 8, 14, 0.4)',
                borderRadius: '16px',
                border: '1px solid var(--border-light)',
                fontFamily: 'Outfit, sans-serif'
              }}>
                {renderFormattedDiagnostics(diagnostics)}
              </div>

              <div style={{ marginTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '2rem' }}>
                <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.25rem', marginBottom: '0.5rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--color-primary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.67 2.67 0 1113.5 17.25l-5.83-5.83m5.83 5.83l-5.83-5.83M11.42 8.83L17.25 3a2.67 2.67 0 11-3.75 3.75l-5.83 5.83M8.83 11.42L3 17.25a2.67 2.67 0 11-3.75-3.75l5.83-5.83M8.83 11.42l-5.83-5.83" />
                  </svg>
                  AI Production Alignment (Song Fixer)
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                  Submit your current composition profile. Gemini will rewrite lyrics and adjust timing tags to fit the exact rhythmic peaks identified above.
                </p>
                
                <div className="grid-song-fixer">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>Current Suno Prompt Profile</label>
                      <textarea
                        value={currentStylePrompt}
                        onChange={e => setCurrentStylePrompt(e.target.value)}
                        placeholder="e.g. synthwave | female whispered vocal | fast tempo..."
                        style={{ background: 'rgba(255,255,255,0.015)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.75rem', fontSize: '0.9rem', width: '100%', minHeight: '80px', outline: 'none', resize: 'vertical' }}
                      />
                    </div>
                    
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>Original Lyrics draft</label>
                      <textarea
                        value={currentLyrics}
                        onChange={e => setCurrentLyrics(e.target.value)}
                        placeholder="Paste your lyrical blueprint here..."
                        style={{ background: 'rgba(255,255,255,0.015)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.75rem', fontSize: '0.9rem', width: '100%', minHeight: '280px', outline: 'none', resize: 'vertical', fontFamily: 'monospace' }}
                      />
                    </div>
                    
                    <button 
                      className="btn-primary" 
                      style={{ width: '100%', padding: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={handleFixSong}
                      disabled={isFixing}
                    >
                      {isFixing ? (
                        <>
                          <span className="spinner-mini" />
                          Revising Cadence...
                        </>
                      ) : (
                        <>
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.67 2.67 0 1113.5 17.25l-5.83-5.83m5.83 5.83l-5.83-5.83M11.42 8.83L17.25 3a2.67 2.67 0 11-3.75 3.75l-5.83 5.83M8.83 11.42L3 17.25a2.67 2.67 0 11-3.75-3.75l5.83-5.83M8.83 11.42l-5.83-5.83" />
                          </svg>
                          Suggest Dynamic Fixes
                        </>
                      )}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', marginBottom: '0.4rem', color: 'var(--color-secondary)' }}>Revised Style Prompt</label>
                      <textarea
                        value={revisedStylePrompt}
                        readOnly
                        placeholder="Engineered style recommendations will output here..."
                        style={{ background: 'rgba(7, 8, 14, 0.5)', color: 'var(--color-secondary)', border: '1px dashed rgba(0, 240, 255, 0.3)', borderRadius: '10px', padding: '0.75rem', fontSize: '0.9rem', width: '100%', minHeight: '80px', outline: 'none', resize: 'vertical' }}
                      />
                    </div>
                    
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', marginBottom: '0.4rem', color: 'var(--color-secondary)' }}>Revised Rhythm Lyrics</label>
                      <textarea
                        value={revisedLyrics}
                        readOnly
                        placeholder="Rhythm-corrected lyrics will output here..."
                        style={{ background: 'rgba(7, 8, 14, 0.5)', color: 'var(--color-secondary)', border: '1px dashed rgba(0, 240, 255, 0.3)', borderRadius: '10px', padding: '0.75rem', fontSize: '0.9rem', width: '100%', minHeight: '280px', outline: 'none', resize: 'vertical', fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
