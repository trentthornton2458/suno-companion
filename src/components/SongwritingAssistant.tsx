import { useState, useRef, useEffect, useMemo } from 'react';
import { analyzeLyricMeter } from '../utils/lyric-meter-utils';

const LYRIC_PRESETS = [
  { label: '[Verse]', code: '\n[Verse]\n' },
  { label: '[Chorus]', code: '\n[Chorus]\n' },
  { label: '[Bridge]', code: '\n[Bridge]\n' },
  { label: '[Whispered]', code: ' [Whispered] ' },
  { label: '[Belted]', code: ' [Belted] ' },
  { label: '[Screamed]', code: ' [Screamed] ' },
  { label: '[Melodic Rap]', code: ' [Melodic Rap] ' },
  { label: '[Spoken Word]', code: ' [Spoken Word] ' },
  { label: '[Guitar Solo]', code: '\n[Guitar Solo]\n' },
  { label: '[Synthesizer Breakdown]', code: '\n[Synthesizer Breakdown]\n' },
  { label: '[Outro]', code: '\n[Outro]\n' }
];

interface SongwritingAssistantProps {
  initialStylePrompt?: string;
  initialBpm?: number;
}

export default function SongwritingAssistant({ initialStylePrompt = '', initialBpm = 120 }: SongwritingAssistantProps) {
  // Wizard State
  const [_currentStep, _setCurrentStep] = useState(1);
  const [bpm, setBpm] = useState(initialBpm);
  const [selectedWizardOptions] = useState<{ [key: number]: string[] }>({
    1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  });
  
  // Custom manual prompt input overlay
  const [customPromptText, setCustomPromptText] = useState('');
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);

  // Lyric Workspace State
  const [lyrics, setLyrics] = useState(`[Intro]\n(Electronic synth arpeggio fades in)\n\n[Verse 1]\nWalking down the neon boulevard\nRaindrops falling on a broken card\nI see my shadow in the glass reflection\nSearching for a phantom connection\n\n[Chorus]\n[Belted]\nBut we are just signals in the night\nBurning out before the morning light!\nGlowing in the glass, shining bright\nFade away into the neon white`);
  const lyricTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Integration States
  const [rawDescription, setRawDescription] = useState('');
  const [curatingPrompt, setCuratingPrompt] = useState(false);
  const [songTopic, setSongTopic] = useState('');

  const [lyricSection, setLyricSection] = useState('Verse');
  const [lyricDelivery, setLyricDelivery] = useState('Standard');
  const [lyricSectionPrompt, setLyricSectionPrompt] = useState('');
  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [suggestedLyrics, setSuggestedLyrics] = useState('');

  // Explicit & Lyric Analysis States
  const [isMakingExplicit, setIsMakingExplicit] = useState(false);
  const [isAnalyzingLyrics, setIsAnalyzingLyrics] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showTimingGuide, setShowTimingGuide] = useState(false);
  const [explicitMode, setExplicitMode] = useState(false);
  const [explicitFrequency, setExplicitFrequency] = useState(50);

  // Meter & Full Song Generator States
  const [showMeterOverlay, setShowMeterOverlay] = useState(true);
  const [showFullSongModal, setShowFullSongModal] = useState(false);
  const [fullSongStructure, setFullSongStructure] = useState('Pop/Rock');
  const [fullSongTopic, setFullSongTopic] = useState('');
  const [fullSongSyllables, setFullSongSyllables] = useState(8);
  const [generatingFullSong, setGeneratingFullSong] = useState(false);

  const [songTitle, setSongTitle] = useState('');
  const [sunoModel, setSunoModel] = useState('chirp-v3-5');
  const [makeInstrumental, setMakeInstrumental] = useState(false);
  const [generatingSong, setGeneratingSong] = useState(false);
  const [generations, setGenerations] = useState<any[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showMusicGen, setShowMusicGen] = useState(false);

  // Sync state if selected preset was passed from parent
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (initialStylePrompt) {
      setCustomPromptText(initialStylePrompt);
      setIsEditingPrompt(true);
    }
  }, [initialStylePrompt]);

  useEffect(() => {
    if (initialBpm) {
      setBpm(initialBpm);
    }
  }, [initialBpm]);

  // Construct stacked prompt
  const getStackedPrompt = () => {
    if (isEditingPrompt) {
      return customPromptText;
    }

    const parts: string[] = [];
    
    // Step 1: Genre
    if (selectedWizardOptions[1].length > 0) parts.push(selectedWizardOptions[1].join(' '));
    // Step 2: Mood
    if (selectedWizardOptions[2].length > 0) parts.push(selectedWizardOptions[2].join(' '));
    // Step 3: Instrumentation
    if (selectedWizardOptions[3].length > 0) parts.push(selectedWizardOptions[3].join(' '));
    // Step 4: Vocals
    if (selectedWizardOptions[4].length > 0) parts.push(selectedWizardOptions[4].join(' '));
    // Step 5: Modifiers
    if (selectedWizardOptions[5].length > 0) parts.push(selectedWizardOptions[5].join(' '));
    // Step 6: Mix
    if (selectedWizardOptions[6].length > 0) parts.push(selectedWizardOptions[6].join(' '));
    
    // Add BPM
    parts.push(`${bpm} bpm`);

    return parts.join(' | ');
  };

  const stackedPrompt = getStackedPrompt();

  // Insert lyric tags at cursor
  const insertPresetCode = (code: string) => {
    const textarea = lyricTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    setLyrics(before + code + after);
    
    // Restore focus and cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + code.length, start + code.length);
    }, 50);
  };

  // Lyric statistics
  const getLyricStats = () => {
    const lines = lyrics.split('\n').filter(l => l.trim().length > 0).length;
    const words = lyrics.split(/\s+/).filter(w => w.length > 0).length;
    const chars = lyrics.length;
    return { lines, words, chars };
  };

  const stats = getLyricStats();

  // API Call handlers
  const handleCuratePrompt = async () => {
    setCuratingPrompt(true);
    try {
      const res = await fetch('/api/gemini/curate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': localStorage.getItem('gemini_api_key') || ''
        },
        body: JSON.stringify({
          rawDescription,
          bpm
        })
      });
      const data = await res.json();
      if (res.ok && data.curatedPrompt) {
        setCustomPromptText(data.curatedPrompt);
        setIsEditingPrompt(true);
      } else {
        alert(data.error || 'Failed to curate prompt.');
      }
    } catch (error: any) {
      console.error(error);
      alert('Failed to connect to prompt curation server.');
    } finally {
      setCuratingPrompt(false);
    }
  };

  const handleLyricHelp = async () => {
    setGeneratingLyrics(true);
    try {
      const res = await fetch('/api/gemini/lyric-helper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': localStorage.getItem('gemini_api_key') || ''
        },
        body: JSON.stringify({
          prompt: songTopic || 'Write a song',
          stylePrompt: customPromptText || stackedPrompt,
          previousLyrics: lyrics,
          section: lyricSection,
          deliveryCue: lyricDelivery === 'Standard' ? '' : lyricDelivery,
          sectionPrompt: lyricSectionPrompt,
          explicitMode,
          explicitFrequency
        })
      });
      const data = await res.json();
      if (res.ok && data.lyrics) {
        setSuggestedLyrics(data.lyrics);
      } else {
        alert(data.error || 'Failed to generate suggested lyrics.');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to connect to lyrics helper.');
    } finally {
      setGeneratingLyrics(false);
    }
  };

  const handleMakeExplicit = async () => {
    setIsMakingExplicit(true);
    try {
      const res = await fetch('/api/gemini/make-explicit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': localStorage.getItem('gemini_api_key') || ''
        },
        body: JSON.stringify({
          lyrics,
          stylePrompt: customPromptText || stackedPrompt
        })
      });
      const data = await res.json();
      if (res.ok && data.explicitLyrics) {
        setLyrics(data.explicitLyrics);
      } else {
        alert(data.error || 'Failed to make lyrics explicit.');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to connect to make explicit service.');
    } finally {
      setIsMakingExplicit(false);
    }
  };

  const handleAnalyzeLyrics = async () => {
    setIsAnalyzingLyrics(true);
    setAnalysisResult(null);
    try {
      const res = await fetch('/api/gemini/analyze-lyrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': localStorage.getItem('gemini_api_key') || ''
        },
        body: JSON.stringify({
          lyrics,
          stylePrompt: customPromptText || stackedPrompt
        })
      });
      const data = await res.json();
      if (res.ok && data.recommendations) {
        setAnalysisResult(data);
      } else {
        alert(data.error || 'Failed to analyze lyrics.');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to connect to lyric analysis service.');
    } finally {
      setIsAnalyzingLyrics(false);
    }
  };

  const handleGenerateFullSong = async () => {
    setGeneratingFullSong(true);
    try {
      const res = await fetch('/api/gemini/generate-full-song', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': localStorage.getItem('gemini_api_key') || ''
        },
        body: JSON.stringify({
          structure: fullSongStructure,
          topic: fullSongTopic || songTopic || 'An emotional song narrative',
          stylePrompt: customPromptText || stackedPrompt,
          targetSyllables: fullSongSyllables,
          explicitMode,
          explicitFrequency
        })
      });
      const data = await res.json();
      if (res.ok && data.lyrics) {
        setLyrics(data.lyrics);
        setShowFullSongModal(false);
      } else {
        alert(data.error || 'Failed to generate full song lyrics.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to full song generator.');
    } finally {
      setGeneratingFullSong(false);
    }
  };

  // PERFORMANCE OPTIMIZATION (Bolt ⚡): Memoize lyric meter analysis results.
  // This prevents running complex full-text parsing, regex transformations, and metric calculations
  // on unrelated state updates like slider movements, style engineering, modal toggles, title input, or polling interval triggers.
  const meterAnalysis = useMemo(() => analyzeLyricMeter(lyrics), [lyrics]);

  const handleGenerateSong = async () => {
    setGeneratingSong(true);
    try {
      const res = await fetch('/api/suno/custom_generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: lyrics,
          tags: customPromptText || stackedPrompt,
          title: songTitle || 'Neon Rain',
          make_instrumental: makeInstrumental,
          model: sunoModel
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to submit generation job.');
        setGeneratingSong(false);
        return;
      }

      const clips = Array.isArray(data) ? data : [data];
      setGenerations(prev => [...clips, ...prev]);
      startPolling(clips.map((c: any) => c.id));
    } catch (error: any) {
      console.error(error);
      alert('Network error while generating song.');
      setGeneratingSong(false);
    }
  };

  const startPolling = (clipIds: string[]) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/suno/get?ids=${clipIds.join(',')}`);
        if (!res.ok) return;

        const updatedClips = await res.json();
        setGenerations(prev => {
          return prev.map(clip => {
            const match = updatedClips.find((uc: any) => uc.id === clip.id);
            return match ? match : clip;
          });
        });

        const allDone = updatedClips.every((c: any) => c.status === 'complete' || c.status === 'streaming' || c.status === 'error');
        if (allDone) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setGeneratingSong(false);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000);
  };

  return (
    <div style={{ paddingBottom: '3rem' }}>
      <div className="page-header">
        <div>
          <h1>Songwriting Workspace</h1>
          <p className="subtitle">Tune prompts with the multi-layer style designer and compose rhythm-optimized lyrics.</p>
        </div>
      </div>

      <div className="assistant-grid">
        {/* Style Formulator (Left Panel) */}
        <div className="glass-card wizard-container" style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Neon accent corner */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(to right, var(--color-primary), var(--color-secondary))' }} />

          <div style={{ marginBottom: '1.25rem', marginTop: '0.5rem' }}>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.3rem', marginBottom: '0.4rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--color-secondary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.982-11.761a1 1 0 00-.018-1.282L15 4l-9.813 11.904z" />
              </svg>
              Style Prompt Designer
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
              Describe your desired sonics in plain English, and Gemini will engineer an optimized style prompt.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <textarea 
              value={rawDescription} 
              onChange={e => setRawDescription(e.target.value)} 
              placeholder="e.g., A slow melancholic 80s retrowave track with heavy modular bass, gated reverb drums, lush whispered vocals, and vintage record dust..."
              style={{
                width: '100%',
                padding: '1rem',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                color: 'white',
                fontSize: '0.95rem',
                outline: 'none',
                fontFamily: 'inherit',
                minHeight: '120px',
                resize: 'vertical',
                transition: 'var(--transition-smooth)'
              }}
              className="lyrics-textarea-focus"
            />

            {/* BPM Slider */}
            <div className="bpm-container" style={{ margin: '0' }}>
              <div className="bpm-header">
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Default Tempo</span>
                <span className="bpm-value">{bpm} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>BPM</span></span>
              </div>
              <input 
                type="range" 
                min="60" 
                max="200" 
                value={bpm} 
                onChange={e => {
                  setBpm(Number(e.target.value));
                }}
                className="slider" 
              />
            </div>

            <button 
              className="btn-primary" 
              onClick={handleCuratePrompt} 
              disabled={curatingPrompt}
              style={{ padding: '0.9rem', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {curatingPrompt ? (
                <>
                  <span className="spinner-mini" />
                  Engineering Style...
                </>
              ) : (
                <>
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.982-11.761a1 1 0 00-.018-1.282L15 4l-9.813 11.904z" />
                  </svg>
                  ✨ Curate Style Prompt
                </>
              )}
            </button>
          </div>

          {/* Prompt Preview */}
          <div className="prompt-preview-box" style={{ marginTop: '1.75rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div className="preview-title" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Generated Style Prompt</div>
              <div style={{ 
                fontSize: '0.8rem', 
                color: (customPromptText.length > 120) ? 'var(--color-accent)' : 'var(--text-muted)',
                fontWeight: 600,
                background: 'rgba(255,255,255,0.03)',
                padding: '0.15rem 0.45rem',
                borderRadius: '6px'
              }}>
                {customPromptText.length} / 120 chars
              </div>
            </div>

            <textarea
              value={customPromptText}
              onChange={e => setCustomPromptText(e.target.value)}
              placeholder="Your engineered prompt will appear here..."
              style={{
                width: '100%',
                background: 'rgba(7, 8, 14, 0.4)',
                border: '1px solid var(--border-light)',
                color: 'white',
                fontFamily: 'Space Grotesk, monospace',
                padding: '1rem',
                borderRadius: '12px',
                resize: 'vertical',
                fontSize: '0.95rem',
                minHeight: '80px',
                outline: 'none',
                lineHeight: '1.4'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1rem' }}>
              <button
                className="copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(customPromptText);
                  alert('Suno prompt copied!');
                }}
                style={{ background: 'rgba(0, 240, 255, 0.04)', border: '1px solid rgba(0, 240, 255, 0.15)', padding: '0.4rem 0.8rem', borderRadius: '8px' }}
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '15px', height: '15px', color: 'var(--color-secondary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5h.008v.008H6.75V7.5zm0 3h.008v.008H6.75v-.008zm0 3h.008v.008H6.75v-.008z" />
                </svg>
                Copy Prompt
              </button>
            </div>
          </div>
        </div>

        {/* Lyric Workspace (Right Panel) */}
        <div className="glass-card lyric-workspace" style={{ position: 'relative' }}>
          <div className="workspace-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.3rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--color-primary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
                Lyrics Workspace
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                Rhyme: <strong style={{ color: 'var(--color-secondary)' }}>{meterAnalysis.rhymeSchemeSummary}</strong> | Avg Syllables: <strong style={{ color: 'var(--color-secondary)' }}>{meterAnalysis.avgSyllablesPerLine}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="btn-secondary"
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.75rem',
                  borderColor: showMeterOverlay ? 'var(--color-secondary)' : 'rgba(255,255,255,0.12)',
                  color: showMeterOverlay ? 'var(--color-secondary)' : 'var(--text-secondary)',
                  background: showMeterOverlay ? 'rgba(0, 240, 255, 0.05)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onClick={() => setShowMeterOverlay(!showMeterOverlay)}
                title="Toggle real-time meter analyzer"
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '13px', height: '13px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25z" />
                </svg>
                {showMeterOverlay ? 'Meter Gutter Active' : 'Show Meter Gutter'}
              </button>
              <button
                className="btn-primary"
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setShowFullSongModal(true)}
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '13px', height: '13px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.982-11.761a1 1 0 00-.018-1.282L15 4l-9.813 11.904z" />
                </svg>
                Generate Song
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', marginTop: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Structural Elements & Delivery Tags:</span>
            <button 
              style={{ fontSize: '0.8rem', color: 'var(--color-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '3px' }}
              onClick={() => setShowTimingGuide(!showTimingGuide)}
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '13px', height: '13px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
              </svg>
              {showTimingGuide ? 'Hide Guide' : 'Suno Timing Guide'}
            </button>
          </div>

          {showTimingGuide && (
            <div style={{
              background: 'rgba(0, 240, 255, 0.02)',
              border: '1px solid rgba(0, 240, 255, 0.15)',
              borderRadius: '12px',
              padding: '1rem',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
              lineHeight: '1.5'
            }}>
              <strong style={{ color: 'white', display: 'block', marginBottom: '0.5rem' }}>Punctuation Secrets for Beat & Pauses:</strong>
              <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem', listStyleType: 'square' }}>
                <li><strong>Commas ( , )</strong>: Forces short breath / 1-beat pause.</li>
                <li><strong>Periods ( . )</strong>: Complete full stop for clean rhythmic boundaries.</li>
                <li><strong>Ellipses ( ... )</strong>: Triggers a dramatic vocal fade-out / suspense pause.</li>
                <li><strong>Hyphens ( - )</strong>: Connects words for rapid, seamless flows.</li>
                <li><strong>Double Newlines</strong>: Forces Suno to switch melodic arrangement flows.</li>
              </ul>
            </div>
          )}

          <div className="presets-row" style={{ marginBottom: '0.75rem' }}>
            {LYRIC_PRESETS.map((preset, idx) => (
              <button 
                key={idx} 
                className="preset-chip" 
                onClick={() => insertPresetCode(preset.code)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Punctuation Macros:</span>
          <div className="presets-row" style={{ marginBottom: '1.25rem' }}>
            <button className="preset-chip" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', minWidth: '40px' }} title="Forces short breath" onClick={() => insertPresetCode(',')}>,</button>
            <button className="preset-chip" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', minWidth: '40px' }} title="Full stop" onClick={() => insertPresetCode('.')}>.</button>
            <button className="preset-chip" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', minWidth: '40px' }} title="Suspense trail-off" onClick={() => insertPresetCode('...')}>...</button>
            <button className="preset-chip" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', minWidth: '40px' }} title="Rapid fire bridge" onClick={() => insertPresetCode('-')}>-</button>
            <button className="preset-chip" style={{ background: 'rgba(0, 240, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.2)', color: 'var(--color-secondary)' }} title="Insert structural pause" onClick={() => insertPresetCode('\n\n')}>[Beat Pause]</button>
          </div>

          {showMeterOverlay && (
            <div className="meter-overlay-container" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.5rem', marginBottom: '0.4rem', fontWeight: 600 }}>
                <span>CADENCE GUTTER</span>
                <span>METRIC FLOW DETECTOR</span>
              </div>
              {meterAnalysis.lines.map((line, idx) => (
                <div key={idx} className={`meter-line-row ${line.isTag ? 'is-tag' : ''}`}>
                  <div className="meter-gutter">
                    {!line.isTag && line.syllables > 0 ? (
                      <>
                        <span className={`syllable-badge ${line.isImbalanced ? 'imbalanced' : ''}`} title={line.isImbalanced ? 'Cadence fluctuates too much' : ''}>
                          {line.syllables} syl
                        </span>
                        {line.rhymeGroup && (
                          <span className="rhyme-badge" style={{ backgroundColor: line.rhymeColor, color: '#000' }}>
                            {line.rhymeGroup}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-secondary)', fontWeight: 700, letterSpacing: '0.5px' }}>STRUCTURE</span>
                    )}
                  </div>
                  <div className="meter-text-content" style={{ color: line.isTag ? 'var(--color-secondary)' : 'var(--text-primary)', fontWeight: line.isTag ? 700 : 400 }}>
                    {line.text || <span style={{ opacity: 0.25 }}>(empty beat pause)</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="lyrics-editor">
            <textarea 
              ref={lyricTextareaRef}
              className="lyrics-textarea"
              value={lyrics}
              onChange={e => setLyrics(e.target.value)}
              placeholder="Start drafting or generate lyrics..."
            />
            <div className="lyrics-stats">
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span>Lines: <strong>{stats.lines}</strong></span>
                <span>Words: <strong>{stats.words}</strong></span>
                <span>Chars: <strong>{stats.chars}</strong>/3000</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', background: 'rgba(255,0,127,0.05)', color: 'var(--color-accent)', borderColor: 'rgba(255,0,127,0.2)' }}
                  onClick={handleMakeExplicit}
                  disabled={isMakingExplicit}
                >
                  {isMakingExplicit ? 'Re-writing...' : '🔞 Inject Explicit'}
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-secondary)', borderColor: 'rgba(0, 240, 255, 0.2)' }}
                  onClick={handleAnalyzeLyrics}
                  disabled={isAnalyzingLyrics}
                >
                  {isAnalyzingLyrics ? 'Critiquing...' : '🔍 Critique Meter'}
                </button>
              </div>
            </div>
          </div>

          {analysisResult && (
            <div style={{
              marginTop: '1.25rem',
              padding: '1.5rem',
              borderRadius: '16px',
              background: 'rgba(13, 14, 26, 0.8)',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.1rem', margin: 0, color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0110.2 21a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.748 3.748 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0113.8 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                  </svg>
                  Gemini Lyric Critique
                </h4>
                <span style={{ fontSize: '0.75rem', background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: 700, color: 'var(--color-secondary)' }}>
                  Rating: {analysisResult.rating}
                </span>
              </div>
              
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.25rem', background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '10px', borderLeft: '3px solid var(--color-primary)' }}>
                {analysisResult.critique}
              </p>

              <h5 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Adjusted Cadence Versions:</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {analysisResult.recommendations.map((rec: any, idx: number) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: 'white' }}>{rec.degree}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{rec.description}</div>
                      </div>
                      <button 
                        className="btn-primary" 
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          setLyrics(rec.revisedLyrics);
                          setAnalysisResult(null);
                        }}
                      >
                        Apply Script
                      </button>
                    </div>
                    <pre style={{
                      whiteSpace: 'pre-wrap',
                      background: 'rgba(7,8,14,0.6)',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      maxHeight: '120px',
                      overflowY: 'auto',
                      fontFamily: 'monospace',
                      margin: 0,
                      border: '1px solid rgba(255,255,255,0.02)'
                    }}>{rec.revisedLyrics}</pre>
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                  onClick={() => setAnalysisResult(null)}
                >
                  Dismiss Analysis
                </button>
              </div>
            </div>
          )}

          {/* AI Lyric Assistant Section */}
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.015)',
            border: '1px solid var(--border-light)'
          }}>
            <h4 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 9.152c.582.448 1.148.89 1.676 1.345m-1.676-1.345c-.528-.407-1.072-.821-1.616-1.222m3.292 2.567c.528.407 1.012.785 1.436 1.139m-1.436-1.139a30.3 30.3 0 0 1-3.292-2.567m-3.921 12.164h-.008v.008h.008v-.008Zm0-3h-.008v.008h.008v-.008Zm0-3h-.008v.008h.008v-.008Zm3-3h-.008v.008h.008v-.008Zm3-3h-.008v.008h.008v-.008Z" />
              </svg>
              AI Lyric Writing Assistant
            </h4>
            
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', color: 'var(--color-secondary)', letterSpacing: '0.3px' }}>Global Narrative / Story Theme</label>
              <textarea 
                value={songTopic} 
                onChange={e => setSongTopic(e.target.value)}
                placeholder="e.g., A protagonist driving through a rain-soaked neon highway at midnight, trying to escape their past..."
                style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.6rem 0.8rem', fontSize: '0.85rem', width: '100%', minHeight: '60px', outline: 'none', resize: 'vertical' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', letterSpacing: '0.3px' }}>Section Context & Prompts</label>
              <textarea 
                value={lyricSectionPrompt} 
                onChange={e => setLyricSectionPrompt(e.target.value)}
                placeholder="e.g., Describe the reflection of the dashboard meters on the windshield, feeling isolated yet free."
                style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.6rem 0.8rem', fontSize: '0.85rem', width: '100%', minHeight: '60px', outline: 'none', resize: 'vertical' }}
              />
            </div>

            <div className="grid-2col-compact" style={{ marginBottom: '1rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block' }}>Target Section</label>
                <select 
                  value={lyricSection} 
                  onChange={e => setLyricSection(e.target.value)}
                  style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.5rem', fontSize: '0.85rem', width: '100%', height: '38px', outline: 'none' }}
                >
                  <option value="Intro">Intro</option>
                  <option value="Verse">Verse</option>
                  <option value="Chorus">Chorus</option>
                  <option value="Bridge">Bridge</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block' }}>Vocal Delivery Cue</label>
                <select 
                  value={lyricDelivery} 
                  onChange={e => setLyricDelivery(e.target.value)}
                  style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.5rem', fontSize: '0.85rem', width: '100%', height: '38px', outline: 'none' }}
                >
                  <option value="Standard">Standard</option>
                  <option value="[Whispered]">[Whispered]</option>
                  <option value="[Belted]">[Belted]</option>
                  <option value="[Screamed]">[Screamed]</option>
                  <option value="[Melodic Rap]">[Melodic Rap]</option>
                  <option value="[Spoken Word]">[Spoken Word]</option>
                </select>
              </div>
            </div>

            <div className="grid-explicit-control" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="assistant-explicit-mode"
                  checked={explicitMode} 
                  onChange={e => setExplicitMode(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                />
                <label htmlFor="assistant-explicit-mode" style={{ cursor: 'pointer', fontSize: '0.85rem', margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>Explicit Mode 🔞</label>
              </div>
              
              {explicitMode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Explicitness Frequency</span>
                    <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>{explicitFrequency}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={explicitFrequency} 
                    onChange={e => setExplicitFrequency(Number(e.target.value))}
                    className="slider"
                    style={{ height: '4px' }}
                  />
                </div>
              )}
            </div>

            <button 
              className="btn-primary" 
              style={{ width: '100%', padding: '0.65rem', fontSize: '0.9rem', fontWeight: 700 }}
              onClick={handleLyricHelp}
              disabled={generatingLyrics}
            >
              {generatingLyrics ? 'Formulating Section...' : '✨ Autocomplete Next Section'}
            </button>
            
            {suggestedLyrics && (
              <div style={{ marginTop: '1.25rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>AI Suggested Section Draft:</label>
                <textarea
                  value={suggestedLyrics}
                  onChange={e => setSuggestedLyrics(e.target.value)}
                  style={{
                    width: '100%',
                    whiteSpace: 'pre-wrap',
                    background: 'rgba(7,8,14,0.6)',
                    padding: '0.85rem',
                    borderRadius: '10px',
                    border: '1px dashed var(--color-secondary)',
                    fontSize: '0.85rem',
                    minHeight: '120px',
                    resize: 'vertical',
                    marginBottom: '0.75rem',
                    color: 'white',
                    fontFamily: 'monospace',
                    outline: 'none',
                    lineHeight: '1.5'
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      setLyrics(prev => prev + '\n\n' + suggestedLyrics);
                      setSuggestedLyrics('');
                    }}
                  >
                    Append to Workspace
                  </button>
                  <button 
                    className="btn-secondary" 
                    style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', color: 'var(--color-accent)', borderColor: 'rgba(255,0,127,0.2)' }}
                    onClick={() => setSuggestedLyrics('')}
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suno Generation Section */}
      <div className="glass-card" style={{ marginTop: '2.5rem', position: 'relative', overflow: 'hidden' }}>
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            cursor: 'pointer',
            borderBottom: showMusicGen ? '1px solid rgba(255,255,255,0.05)' : 'none', 
            paddingBottom: showMusicGen ? '0.75rem' : '0'
          }} 
          onClick={() => setShowMusicGen(!showMusicGen)}
        >
          <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.3rem', color: 'var(--color-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '22px', height: '22px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 0v15m0-15l-10.5 3m10.5-3V3m-10.5 6v12m0 0a3 3 0 11-6 0 3 3 0 016 0zm10.5 3a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Suno AI Synth Engine
          </h3>
          <button
            className="btn-secondary"
            style={{
              padding: '0.4rem 0.9rem',
              fontSize: '0.75rem',
              borderColor: showMusicGen ? 'var(--color-secondary)' : 'rgba(255,255,255,0.12)',
              color: showMusicGen ? 'var(--color-secondary)' : 'var(--text-secondary)'
            }}
          >
            {showMusicGen ? 'Hide Controls' : 'Open Synth Panel'}
          </button>
        </div>
        
        {showMusicGen && (
          <div style={{ marginTop: '1.5rem' }}>
            <div className="grid-suno-generation" style={{ gap: '1.25rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'block', marginBottom: '0.4rem' }}>Composition Title</label>
                <input 
                  type="text" 
                  value={songTitle} 
                  onChange={e => setSongTitle(e.target.value)} 
                  placeholder="e.g. Skyline Signal"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'block', marginBottom: '0.4rem' }}>Suno Core Model</label>
                <select 
                  value={sunoModel} 
                  onChange={e => setSunoModel(e.target.value)}
                  style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.75rem', fontSize: '0.9rem', width: '100%', height: '42px', outline: 'none' }}
                >
                  <option value="chirp-v3-5">Chirp v3.5 (Highly Melodic)</option>
                  <option value="chirp-v4-5">Chirp v4.5 (High Fidelity)</option>
                  <option value="chirp-v5">Chirp v5 (Cinema Studio)</option>
                  <option value="chirp-v5-5">Chirp v5.5 (Pro Master)</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', height: '42px', gap: '0.5rem', paddingBottom: '0.2rem' }}>
                <input 
                  type="checkbox" 
                  id="instrumental-check"
                  checked={makeInstrumental} 
                  onChange={e => setMakeInstrumental(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-secondary)' }}
                />
                <label htmlFor="instrumental-check" style={{ cursor: 'pointer', fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>Instrumental Master</label>
              </div>
            </div>

            <button 
              className="btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: 700, marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={handleGenerateSong}
              disabled={generatingSong}
            >
              {generatingSong ? (
                <>
                  <span className="spinner-mini" />
                  Spinning Up Audio Tracks (Can take up to 2 min)...
                </>
              ) : (
                <>
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 0v15m0-15l-10.5 3m10.5-3V3m-10.5 6v12m0 0a3 3 0 11-6 0 3 3 0 016 0zm10.5 3a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Render Song with Suno AI
                </>
              )}
            </button>

            {/* Active Generations List */}
            {generations.length > 0 && (
              <div style={{ marginTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '16px', height: '16px', color: 'var(--color-secondary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                  </svg>
                  Synthesized Sound Waves
                </h4>
                <div className="grid-active-generations" style={{ gap: '1.25rem' }}>
                  {generations.map((clip: any) => (
                    <div key={clip.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', gap: '1.25rem', background: 'rgba(7, 8, 14, 0.5)', margin: 0 }}>
                      {clip.image_url ? (
                        <img src={clip.image_url} alt={clip.title} style={{ width: '90px', height: '90px', borderRadius: '12px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.06)' }} />
                      ) : (
                        <div style={{ width: '90px', height: '90px', borderRadius: '12px', background: 'rgba(138,43,226,0.1)', border: '1px dashed rgba(138,43,226,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>🎵</div>
                      )}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clip.title || 'Untitled Signal'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            Status:
                            <span style={{
                              color: clip.status === 'complete' || clip.status === 'streaming' ? 'var(--color-secondary)' : 'orange',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              background: clip.status === 'complete' || clip.status === 'streaming' ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 165, 0, 0.08)',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem'
                            }}>
                              {clip.status}
                            </span>
                          </div>
                        </div>
                        
                        {clip.audio_url ? (
                          <audio controls src={clip.audio_url} style={{ width: '100%', height: '32px', marginTop: '0.75rem' }} />
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="spinner-mini" style={{ width: '12px', height: '12px', borderWidth: '1.5px' }} />
                            Polishing wave components...
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Multi-Section Song Generator Modal */}
      {showFullSongModal && (
        <div className="modal-backdrop" onClick={() => setShowFullSongModal(false)}>
          <div className="song-gen-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.3rem', margin: 0, color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.982-11.761a1 1 0 00-.018-1.282L15 4l-9.813 11.904z" />
                </svg>
                Lyric Arrangement Engine
              </h3>
              <button 
                onClick={() => setShowFullSongModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.25rem', padding: '0.2rem' }}
                title="Close dialog"
              >
                ✕
              </button>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
              Generate structured lyrics (Intro, Verses, Chorus, Bridge, Outro) customized to your musical concept and meter.
            </p>

            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', marginBottom: '0.35rem', display: 'block', color: 'white' }}>Arrangement Blueprint</label>
              <select 
                value={fullSongStructure} 
                onChange={e => setFullSongStructure(e.target.value)}
                style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.6rem', fontSize: '0.9rem', width: '100%' }}
              >
                <option value="Pop/Rock">Pop / Rock ([Intro - V1 - PC - Chorus - V2 - PC - Chorus - Bridge - Chorus - Outro])</option>
                <option value="Hip-Hop/Rap">Hip-Hop / Rap ([Intro - V1 - Chorus - V2 - Chorus - Fast Flow - Outro])</option>
                <option value="Synthwave Ballad">Synthwave Ballad ([Intro - V1 - Chorus - V2 - Solo - Outro])</option>
                <option value="EDM Anthem">EDM Drop Anthem ([Intro - Build - Drop - V1 - Build - Drop - Outro])</option>
                <option value="Acoustic Indie">Acoustic / Indie Folk ([Intro - V1 - Refrain - V2 - Refrain - Outro])</option>
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', marginBottom: '0.35rem', display: 'block', color: 'white' }}>Arrangement Theme & Plot</label>
              <textarea 
                value={fullSongTopic} 
                onChange={e => setFullSongTopic(e.target.value)}
                placeholder="e.g. A dystopian cyberpunk runner sprinting across neon-soaked rooftops to deliver a key data core."
                rows={3}
                style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.6rem', fontSize: '0.85rem', width: '100%', resize: 'vertical' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'white' }}>Target Cadence (Syllables per line)</label>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-secondary)', fontWeight: 700 }}>{fullSongSyllables} syllables</span>
              </div>
              <input 
                type="range" 
                min={6} 
                max={14} 
                value={fullSongSyllables} 
                onChange={e => setFullSongSyllables(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-secondary)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
              <button 
                className="btn-primary" 
                style={{ flex: 1, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={handleGenerateFullSong}
                disabled={generatingFullSong}
              >
                {generatingFullSong ? (
                  <>
                    <span className="spinner-mini" />
                    Writing Lyrics...
                  </>
                ) : (
                  <>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.59 2.118a14.975 14.975 0 0 0-6.16 12.122 14.98 14.98 0 0 0 12.16 6.161z" />
                    </svg>
                    Synthesize Album Blueprint
                  </>
                )}
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => setShowFullSongModal(false)}
                style={{ padding: '0.75rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
