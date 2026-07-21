import { useState, useRef, useEffect } from 'react';
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

  const meterAnalysis = analyzeLyricMeter(lyrics);

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

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  return (
    <div style={{ paddingBottom: '3rem' }}>
      <div className="page-header">
        <div>
          <h1>Songwriting Workspace</h1>
          <p className="subtitle">Tune prompts with the 6-step stacking wizard and compose verse-by-verse meta lyrics.</p>
        </div>
      </div>

      <div className="assistant-grid">
        {/* Wizard Container (Left Panel) */}
        {/* Style Formulator (Left Panel) */}
        <div className="glass-card wizard-container">
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Style Prompt Creator
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Describe what you want in plain text, and AI will curate it into an optimized 6-layer style prompt.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <textarea 
              value={rawDescription} 
              onChange={e => setRawDescription(e.target.value)} 
              placeholder="e.g., A nostalgic 80s synthwave track with soaring leads, heavy sidechain compression, whispered female vocals, wide stereo field..."
              style={{
                width: '100%',
                padding: '1rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.95rem',
                outline: 'none',
                fontFamily: 'inherit',
                minHeight: '120px',
                resize: 'vertical'
              }}
            />

            {/* BPM Slider */}
            <div className="bpm-container" style={{ margin: '0.5rem 0' }}>
              <div className="bpm-header">
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Target BPM (Optional)</span>
                <span className="bpm-value">{bpm} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>BPM</span></span>
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
              style={{ padding: '0.75rem', fontSize: '0.95rem', fontWeight: 600 }}
            >
              {curatingPrompt ? 'AI Curating Prompt...' : '✨ Curate 6-Layer Style Prompt'}
            </button>
          </div>

          {/* Prompt Preview */}
          <div className="prompt-preview-box" style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div className="preview-title" style={{ fontSize: '1rem' }}>Suno-API Style Prompt</div>
              <div style={{ 
                fontSize: '0.8rem', 
                color: (customPromptText.length > 120) ? 'var(--color-accent)' : 'var(--text-secondary)',
                fontWeight: 600 
              }}>
                {customPromptText.length} / 120 chars {(customPromptText.length > 120) && '(Warning: Exceeds Limit)'}
              </div>
            </div>

            <textarea
              value={customPromptText}
              onChange={e => setCustomPromptText(e.target.value)}
              placeholder="Curated prompt will appear here..."
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-light)',
                color: 'white',
                fontFamily: 'Space Grotesk, monospace',
                padding: '1rem',
                borderRadius: '10px',
                resize: 'vertical',
                fontSize: '0.95rem',
                minHeight: '80px'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1rem' }}>
              <button className="copy-btn" onClick={() => {
                navigator.clipboard.writeText(customPromptText);
                alert('Suno-compatible prompt copied to clipboard!');
              }}>
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5h.008v.008H6.75V7.5zm0 3h.008v.008H6.75v-.008zm0 3h.008v.008H6.75v-.008z" />
                </svg>
                Copy Style Prompt
              </button>
            </div>
          </div>
        </div>

        {/* Lyric Workspace (Right Panel) */}
        <div className="glass-card lyric-workspace">
          <div className="workspace-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.25rem', margin: 0 }}>Lyric Workspace</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Rhyme Scheme: <strong style={{ color: 'var(--color-secondary)' }}>{meterAnalysis.rhymeSchemeSummary}</strong> | Avg: <strong style={{ color: 'var(--color-secondary)' }}>{meterAnalysis.avgSyllablesPerLine} syl/line</strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="btn-secondary"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderColor: showMeterOverlay ? 'var(--color-secondary)' : 'var(--border-light)' }}
                onClick={() => setShowMeterOverlay(!showMeterOverlay)}
                title="Toggle Real-time Line-by-Line Meter Gutter"
              >
                {showMeterOverlay ? '📊 Meter ON' : '📊 Meter OFF'}
              </button>
              <button
                className="btn-primary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
                onClick={() => setShowFullSongModal(true)}
              >
                ✨ Generate Full Song
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Vocal Delivery Presets:</span>
            <button 
              style={{ fontSize: '0.75rem', color: 'var(--color-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => setShowTimingGuide(!showTimingGuide)}
            >
              {showTimingGuide ? 'Hide Timing Guide' : 'Suno Timing Cheat Sheet'}
            </button>
          </div>

          {showTimingGuide && (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
              lineHeight: '1.4'
            }}>
              <strong style={{ color: 'white', display: 'block', marginBottom: '0.4rem' }}>Punctuation for Timing & Pauses:</strong>
              <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <li><strong>Commas ( , )</strong>: Force a quick breath or short half-beat pause.</li>
                <li><strong>Periods ( . )</strong>: Create a clean definitive stop to finish a thought.</li>
                <li><strong>Ellipses ( ... )</strong>: Create a long dramatic/suspenseful pause (vocals trail off).</li>
                <li><strong>Hyphens ( - )</strong>: Connect syllables/words to force a fast, tight unbroken vocal flow.</li>
                <li><strong>Double Newlines</strong>: Creating empty lines between blocks forces a structural pause (changes flow).</li>
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

          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Punctuation Timing Helpers:</span>
          <div className="presets-row" style={{ marginBottom: '1rem' }}>
            <button className="preset-chip" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)' }} title="Quick breath / short pause" onClick={() => insertPresetCode(',')}>,</button>
            <button className="preset-chip" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)' }} title="Clean definitive stop" onClick={() => insertPresetCode('.')}>.</button>
            <button className="preset-chip" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)' }} title="Dramatic trail-off pause" onClick={() => insertPresetCode('...')}>...</button>
            <button className="preset-chip" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)' }} title="Connect words for fast flow" onClick={() => insertPresetCode('-')}>-</button>
            <button className="preset-chip" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)' }} title="Insert flow break pause" onClick={() => insertPresetCode('\n\n')}>\n\n (Pause)</button>
          </div>

          {showMeterOverlay && (
            <div className="meter-overlay-container" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem', marginBottom: '0.25rem' }}>
                <span>Line Breakdown & Rhyme Scheme</span>
                <span>Syllables & Cadence</span>
              </div>
              {meterAnalysis.lines.map((line, idx) => (
                <div key={idx} className={`meter-line-row ${line.isTag ? 'is-tag' : ''}`}>
                  <div className="meter-gutter">
                    {!line.isTag && line.syllables > 0 ? (
                      <>
                        <span className={`syllable-badge ${line.isImbalanced ? 'imbalanced' : ''}`} title={line.isImbalanced ? 'Line length deviates >35% from average' : ''}>
                          {line.syllables} syl
                        </span>
                        {line.rhymeGroup && (
                          <span className="rhyme-badge" style={{ backgroundColor: line.rhymeColor, color: '#000' }}>
                            {line.rhymeGroup}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-secondary)', fontWeight: 600 }}>Tag</span>
                    )}
                  </div>
                  <div className="meter-text-content" style={{ color: line.isTag ? 'var(--color-secondary)' : 'var(--text-primary)', fontWeight: line.isTag ? 700 : 400 }}>
                    {line.text || <span style={{ opacity: 0.3 }}>(empty line)</span>}
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
              placeholder="Start writing lyrics here..."
            />
            <div className="lyrics-stats" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <span>Lines: {stats.lines}</span>
                <span>Words: {stats.words}</span>
                <span>Chars: {stats.chars} / 3000 max</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', background: 'rgba(255,50,100,0.1)', color: '#ff3264', borderColor: 'rgba(255,50,100,0.2)' }}
                  onClick={handleMakeExplicit}
                  disabled={isMakingExplicit}
                >
                  {isMakingExplicit ? 'Making Explicit...' : '🔞 Make Explicit'}
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-secondary)' }}
                  onClick={handleAnalyzeLyrics}
                  disabled={isAnalyzingLyrics}
                >
                  {isAnalyzingLyrics ? 'Analyzing...' : '🔍 Analyze Lyrics'}
                </button>
              </div>
            </div>
          </div>

          {analysisResult && (
            <div style={{
              marginTop: '1rem',
              padding: '1.25rem',
              borderRadius: '12px',
              background: 'rgba(0, 240, 255, 0.03)',
              border: '1px solid rgba(0, 240, 255, 0.15)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1rem', margin: 0, color: 'var(--color-secondary)' }}>Lyric Analysis & Critique</h4>
                <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                  Explicitness: <span style={{ color: analysisResult.rating.toLowerCase().includes('clean') ? '#4caf50' : '#ff9800' }}>{analysisResult.rating}</span>
                </span>
              </div>
              
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '1.25rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                {analysisResult.critique}
              </p>

              <h5 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>3 Degrees of Recommendations:</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {analysisResult.recommendations.map((rec: any, idx: number) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <strong style={{ fontSize: '0.85rem', color: 'white' }}>{rec.degree}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rec.description}</div>
                      </div>
                      <button 
                        className="btn-primary" 
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          setLyrics(rec.revisedLyrics);
                          setAnalysisResult(null);
                        }}
                      >
                        Apply Version
                      </button>
                    </div>
                    <pre style={{
                      whiteSpace: 'pre-wrap',
                      background: 'rgba(0,0,0,0.15)',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      maxHeight: '100px',
                      overflowY: 'auto',
                      fontFamily: 'monospace',
                      margin: 0
                    }}>{rec.revisedLyrics}</pre>
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={() => setAnalysisResult(null)}
                >
                  Close Analysis
                </button>
              </div>
            </div>
          )}

            {/* AI Lyric Assistant Section */}
          <div style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-light)'
          }}>
            <h4 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--color-secondary)' }}>AI Lyric Assistant</h4>
            
            <div className="input-group" style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block', color: 'var(--color-secondary)' }}>Global Song Concept / Topic</label>
              <textarea 
                value={songTopic} 
                onChange={e => setSongTopic(e.target.value)}
                placeholder="e.g., A narrative about moving on, leaving a small town, finding self-worth, and embracing the unknown. Sets the theme for all sections."
                style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.4rem', fontSize: '0.85rem', width: '100%', minHeight: '60px', outline: 'none', resize: 'vertical' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }}>Section Topic / Instructions</label>
              <textarea 
                value={lyricSectionPrompt} 
                onChange={e => setLyricSectionPrompt(e.target.value)}
                placeholder="e.g., Write about the protagonist looking at an old photograph and realizing they need to move on. Keep the flow conversational."
                style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.4rem', fontSize: '0.85rem', width: '100%', minHeight: '60px', outline: 'none', resize: 'vertical' }}
              />
            </div>

            <div className="grid-2col-compact">
              <div className="input-group">
                <label style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }}>Target Section</label>
                <select 
                  value={lyricSection} 
                  onChange={e => setLyricSection(e.target.value)}
                  style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.4rem', fontSize: '0.85rem', width: '100%', height: '34px', outline: 'none' }}
                >
                  <option value="Intro">Intro</option>
                  <option value="Verse">Verse</option>
                  <option value="Chorus">Chorus</option>
                  <option value="Bridge">Bridge</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div className="input-group">
                <label style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }}>Vocal Delivery</label>
                <select 
                  value={lyricDelivery} 
                  onChange={e => setLyricDelivery(e.target.value)}
                  style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.4rem', fontSize: '0.85rem', width: '100%', height: '34px', outline: 'none' }}
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

            <div className="grid-explicit-control">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="assistant-explicit-mode"
                  checked={explicitMode} 
                  onChange={e => setExplicitMode(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="assistant-explicit-mode" style={{ cursor: 'pointer', fontSize: '0.85rem', margin: 0, color: 'var(--text-secondary)' }}>Explicit Mode 🔞</label>
              </div>
              
              {explicitMode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Explicitness Frequency</span>
                    <span style={{ color: 'var(--color-accent)' }}>{explicitFrequency}%</span>
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
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              onClick={handleLyricHelp}
              disabled={generatingLyrics}
            >
              {generatingLyrics ? 'Writing lyrics...' : '✨ Generate Next Lyrics'}
            </button>
            
            {suggestedLyrics && (
              <div style={{ marginTop: '1rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>AI Suggested Lyrics (Edit before appending):</label>
                <textarea
                  value={suggestedLyrics}
                  onChange={e => setSuggestedLyrics(e.target.value)}
                  style={{
                    width: '100%',
                    whiteSpace: 'pre-wrap',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px dashed var(--color-secondary)',
                    fontSize: '0.85rem',
                    minHeight: '120px',
                    resize: 'vertical',
                    marginBottom: '0.5rem',
                    color: 'white',
                    fontFamily: 'monospace'
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      setLyrics(prev => prev + '\n\n' + suggestedLyrics);
                      setSuggestedLyrics('');
                    }}
                  >
                    Append to Workspace
                  </button>
                  <button 
                    className="btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--color-accent)' }}
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
      <div className="glass-card" style={{ marginTop: '2rem' }}>
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            cursor: 'pointer',
            borderBottom: showMusicGen ? '1px solid rgba(255,255,255,0.05)' : 'none', 
            paddingBottom: showMusicGen ? '0.5rem' : '0'
          }} 
          onClick={() => setShowMusicGen(!showMusicGen)}
        >
          <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.25rem', color: 'var(--color-secondary)', margin: 0 }}>
            🎸 Suno AI Music Generation
          </h3>
          <button className="btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}>
            {showMusicGen ? 'Hide Generator 🔼' : 'Open Generator 🔽'}
          </button>
        </div>
        
        {showMusicGen && (
          <div style={{ marginTop: '1.5rem' }}>
            <div className="grid-suno-generation">
              <div className="input-group">
                <label style={{ display: 'block', marginBottom: '0.35rem' }}>Song Title</label>
                <input 
                  type="text" 
                  value={songTitle} 
                  onChange={e => setSongTitle(e.target.value)} 
                  placeholder="Enter song title (e.g. Neon Rain)"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', marginBottom: '0.35rem' }}>Suno Model</label>
                <select 
                  value={sunoModel} 
                  onChange={e => setSunoModel(e.target.value)}
                  style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem', width: '100%', height: '42px', outline: 'none' }}
                >
                  <option value="chirp-v3-5">Chirp v3.5</option>
                  <option value="chirp-v4-5">Chirp v4.5</option>
                  <option value="chirp-v5">Chirp v5</option>
                  <option value="chirp-v5-5">Chirp v5.5</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', height: '42px', gap: '0.5rem', paddingBottom: '0.2rem' }}>
                <input 
                  type="checkbox" 
                  id="instrumental-check"
                  checked={makeInstrumental} 
                  onChange={e => setMakeInstrumental(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="instrumental-check" style={{ cursor: 'pointer', fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)' }}>Instrumental Only</label>
              </div>
            </div>

            <button 
              className="btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: 600 }}
              onClick={handleGenerateSong}
              disabled={generatingSong}
            >
              {generatingSong ? 'Generating Song (This may take up to 2 minutes)...' : '🎸 Generate Custom Tracks with Suno'}
            </button>

            {/* Active Generations List */}
            {generations.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Generated Audio Clips</h4>
                <div className="grid-active-generations">
                  {generations.map((clip: any) => (
                    <div key={clip.id} className="glass-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                      {clip.image_url ? (
                        <img src={clip.image_url} alt={clip.title} style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '80px', height: '80px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🎵</div>
                      )}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{clip.title || 'Untitled Song'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: <span style={{ color: clip.status === 'complete' || clip.status === 'streaming' ? 'var(--color-secondary)' : 'orange', fontWeight: 'bold' }}>{clip.status.toUpperCase()}</span></div>
                        </div>
                        
                        {clip.audio_url ? (
                          <audio controls src={clip.audio_url} style={{ width: '100%', height: '32px', marginTop: '0.5rem' }} />
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Generating audio files...</div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.25rem', margin: 0, color: 'var(--color-secondary)' }}>
                ✨ Full Multi-Section Song Generator
              </h3>
              <button 
                onClick={() => setShowFullSongModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Generate complete structured lyrics (Intro, Verses, Pre-Chorus, Chorus, Bridge, Outro) with target line-meter and Suno timing punctuation.
            </p>

            <div className="input-group">
              <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: 'white' }}>Structure Preset</label>
              <select 
                value={fullSongStructure} 
                onChange={e => setFullSongStructure(e.target.value)}
                style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.5rem', fontSize: '0.9rem', width: '100%' }}
              >
                <option value="Pop/Rock">Pop / Rock Standard ([Intro - V1 - PC - Chorus - V2 - PC - Chorus - Bridge - Chorus - Outro])</option>
                <option value="Hip-Hop/Rap">Hip-Hop / Rap ([Intro - V1 - Chorus - V2 - Chorus - Fast Flow Bridge - Outro])</option>
                <option value="Synthwave Ballad">Synthwave / Melancholic Ballad ([Intro - V1 - Chorus - V2 - Solo - Outro])</option>
                <option value="EDM Anthem">EDM / Dance Anthem ([Intro - Build - Drop - V1 - Build - Drop - Outro])</option>
                <option value="Acoustic Indie">Acoustic / Indie Folk ([Intro - V1 - Refrain - V2 - Refrain - Outro])</option>
              </select>
            </div>

            <div className="input-group">
              <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: 'white' }}>Song Theme / Story Concept</label>
              <textarea 
                value={fullSongTopic} 
                onChange={e => setFullSongTopic(e.target.value)}
                placeholder="e.g. A high-energy cyberpunk story about escaping a digital simulation under city lights."
                rows={3}
                style={{ background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.5rem', fontSize: '0.85rem', width: '100%', resize: 'vertical' }}
              />
            </div>

            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'white' }}>Target Syllables Per Line</label>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-secondary)', fontWeight: 600 }}>{fullSongSyllables} syllables</span>
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

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button 
                className="btn-primary" 
                style={{ flex: 1, padding: '0.6rem' }}
                onClick={handleGenerateFullSong}
                disabled={generatingFullSong}
              >
                {generatingFullSong ? 'Generating Full Song...' : '🚀 Generate Complete Song'}
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => setShowFullSongModal(false)}
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
