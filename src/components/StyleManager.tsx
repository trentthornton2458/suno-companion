import React, { useState, useEffect } from 'react';

export interface StylePreset {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  prompt: string;
  tags: string[];
}

const DEFAULT_STYLES: StylePreset[] = [
  {
    id: '1',
    name: 'Cyberpunk Synthwave',
    genre: 'Electronic',
    bpm: 110,
    prompt: '80s analog synth | heavy modular bassline | gated reverb drums | retro neon cyberpunk',
    tags: ['synth', 'retrowave', 'cyberpunk', '110bpm']
  },
  {
    id: '2',
    name: 'Ethereal Dream-Pop',
    genre: 'Dream-Pop',
    bpm: 88,
    prompt: 'lush shimmering guitars | whispering female vocals | tape delay | warm analog vinyl crackle',
    tags: ['dreamy', 'acoustic', 'female-vox', 'ambient']
  },
  {
    id: '3',
    name: 'Neon Jazz Fusion',
    genre: 'Jazz',
    bpm: 125,
    prompt: 'electric rhodes piano | fretless bass | complex polyrhythms | high-energy brass stabs',
    tags: ['instrumental', 'groove', 'brass', 'rhodes']
  },
  {
    id: '4',
    name: 'Prog-Metal Symphony',
    genre: 'Metal',
    bpm: 140,
    prompt: 'heavy 8-string djent riffs | symphonic strings | blast beats | cinematic breakdown',
    tags: ['heavy', 'strings', 'djent', 'epic']
  },
  {
    id: '5',
    name: 'Lofi Chillhop Beats',
    genre: 'Lofi Hip Hop',
    bpm: 78,
    prompt: 'jazz piano loop | dusty drum break | sub bass | vinyl static | nostalgic mellow mood',
    tags: ['chill', 'lofi', 'beats', 'relaxing']
  },
  {
    id: '6',
    name: 'Future Bass Rush',
    genre: 'Future Bass',
    bpm: 150,
    prompt: 'supersaw synth chords | vocal chops | sub drops | high-tempo energetic drops',
    tags: ['electronic', 'hype', 'supersaws', 'melodic']
  }
];

interface StyleManagerProps {
  onSelectStyle?: (style: StylePreset) => void;
}

export default function StyleManager({ onSelectStyle }: StyleManagerProps) {
  const [styles, setStyles] = useState<StylePreset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [newStyle, setNewStyle] = useState({
    name: '',
    genre: '',
    bpm: 120,
    prompt: '',
    tagsString: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem('suno_custom_styles');
    if (saved) {
      try {
        setStyles(JSON.parse(saved));
      } catch (e) {
        setStyles(DEFAULT_STYLES);
      }
    } else {
      setStyles(DEFAULT_STYLES);
      localStorage.setItem('suno_custom_styles', JSON.stringify(DEFAULT_STYLES));
    }
  }, []);

  const saveStylesToStorage = (updatedStyles: StylePreset[]) => {
    setStyles(updatedStyles);
    localStorage.setItem('suno_custom_styles', JSON.stringify(updatedStyles));
  };

  const handleAddStyle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStyle.name || !newStyle.prompt) return;

    const tags = newStyle.tagsString
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const added: StylePreset = {
      id: Date.now().toString(),
      name: newStyle.name,
      genre: newStyle.genre || 'Alternative',
      bpm: Number(newStyle.bpm) || 120,
      prompt: newStyle.prompt,
      tags: [...tags, `${newStyle.bpm}bpm`]
    };

    const updated = [added, ...styles];
    saveStylesToStorage(updated);

    setNewStyle({
      name: '',
      genre: '',
      bpm: 120,
      prompt: '',
      tagsString: ''
    });
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this style preset?')) {
      const updated = styles.filter(s => s.id !== id);
      saveStylesToStorage(updated);
    }
  };

  const handleCopy = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    alert('Style prompt copied to clipboard!');
  };

  const filteredStyles = styles.filter(s => {
    const query = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(query) ||
      s.genre.toLowerCase().includes(query) ||
      s.prompt.toLowerCase().includes(query) ||
      s.tags.some(t => t.toLowerCase().includes(query))
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Style Preset Library</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>Create, design, search, and apply your customized genre and style combinations.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {showAddForm ? (
            <>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
              Back to Preset Library
            </>
          ) : (
            <>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Style Preset
            </>
          )}
        </button>
      </div>

      {showAddForm ? (
        <div className="glass-card" style={{ maxWidth: '620px', margin: '1.5rem auto' }}>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.35rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem', color: 'white' }}>
            New Style Preset Design
          </h2>
          <form onSubmit={handleAddStyle} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group">
              <label>Preset Name</label>
              <input
                type="text"
                required
                value={newStyle.name}
                onChange={e => setNewStyle({ ...newStyle, name: e.target.value })}
                placeholder="e.g., Cyberpunk Industrial Master"
              />
            </div>
            <div className="grid-style-form-row">
              <div className="input-group">
                <label>Genre Profile</label>
                <input
                  type="text"
                  value={newStyle.genre}
                  onChange={e => setNewStyle({ ...newStyle, genre: e.target.value })}
                  placeholder="e.g., Synthwave / Metal"
                />
              </div>
              <div className="input-group">
                <label>Default Tempo (BPM)</label>
                <input
                  type="number"
                  value={newStyle.bpm}
                  onChange={e => setNewStyle({ ...newStyle, bpm: Number(e.target.value) })}
                  placeholder="120"
                />
              </div>
            </div>
            <div className="input-group">
              <label>Structured Prompt Tags (Suno Compatible)</label>
              <textarea
                rows={3}
                required
                value={newStyle.prompt}
                onChange={e => setNewStyle({ ...newStyle, prompt: e.target.value })}
                placeholder="e.g., modular synthesizer | cinematic strings | dramatic cyber punk beat"
                style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Separate descriptors with pipes (|) or commas (,) for best AI generation results.</span>
            </div>
            <div className="input-group">
              <label>Filter & Search Keywords (Comma separated)</label>
              <input
                type="text"
                value={newStyle.tagsString}
                onChange={e => setNewStyle({ ...newStyle, tagsString: e.target.value })}
                placeholder="e.g., sci-fi, dark, energetic, modular"
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save Preset Design</button>
              <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div
            className="glass-card"
            style={{
              padding: '1rem 1.5rem',
              marginBottom: '2rem',
              border: searchFocused ? '1px solid var(--color-secondary)' : '1px solid var(--border-light)',
              boxShadow: searchFocused ? '0 0 15px rgba(0, 240, 255, 0.15)' : 'var(--glass-shadow)',
              transition: 'var(--transition-smooth)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '22px', height: '22px', color: searchFocused ? 'var(--color-secondary)' : 'var(--text-muted)', transition: 'var(--transition-fast)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search styles by name, tags, genres, or prompts..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '1.05rem',
                  width: '100%',
                }}
              />
            </div>
          </div>

          <div className="style-grid">
            {filteredStyles.map(style => (
              <div key={style.id} className="style-card">
                <div className="style-card-header">
                  <span className="style-tag" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '12px', height: '12px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 0v15m0-15l-10.5 3m10.5-3V3m-10.5 6v12m0 0a3 3 0 11-6 0 3 3 0 016 0zm10.5 3a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {style.genre}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '13px', height: '13px', color: 'var(--color-secondary)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    {style.bpm} BPM
                  </span>
                </div>
                <div className="style-name">{style.name}</div>
                <div className="style-prompt">"{style.prompt}"</div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {style.tags.map((tag, idx) => (
                    <span key={idx} style={{
                      fontSize: '0.75rem',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}>
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '10px', height: '10px', color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122l9.37-9.37M9.53 16.122a3 3 0 1 0-4.242 4.243 3 3 0 0 0 4.242-4.243zm9.37-9.37a3 3 0 1 1-4.243-4.242 3 3 0 0 1 4.243 4.242z" />
                      </svg>
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="style-actions">
                  <button
                    className="style-btn"
                    onClick={() => handleCopy(style.prompt)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Copy prompt text"
                  >
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '14px', height: '14px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5h.008v.008H6.75V7.5zm0 3h.008v.008H6.75v-.008zm0 3h.008v.008H6.75v-.008z" />
                    </svg>
                    Copy
                  </button>
                  {onSelectStyle && (
                    <button
                      className="style-btn use-btn"
                      onClick={() => onSelectStyle(style)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '13px', height: '13px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.982-11.761a1 1 0 00-.018-1.282L15 4l-9.813 11.904z" />
                      </svg>
                      Apply
                    </button>
                  )}
                  <button
                    className="style-btn"
                    style={{ color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '3px' }}
                    onClick={() => handleDelete(style.id)}
                    title="Delete style preset"
                  >
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '13px', height: '13px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {filteredStyles.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '48px', height: '48px', color: 'var(--text-muted)', margin: '0 auto 1rem', display: 'block', opacity: 0.5 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
                </svg>
                <div style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>No style presets found</div>
                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Try adjusting your search terms or keywords.</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
