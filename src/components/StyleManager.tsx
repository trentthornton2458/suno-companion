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
    if (window.confirm('Delete this style preset?')) {
      const updated = styles.filter(s => s.id !== id);
      saveStylesToStorage(updated);
    }
  };

  const handleCopy = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    alert('Prompt copied to clipboard!');
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
          <h1>Style Manager</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>Browse, design, and organize your prompt style presets.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'View Styles' : 'Create Custom Style'}
        </button>
      </div>

      {showAddForm ? (
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.25rem', marginBottom: '1.5rem' }}>
            New Style Preset
          </h2>
          <form onSubmit={handleAddStyle} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group">
              <label>Style Name</label>
              <input
                type="text"
                required
                value={newStyle.name}
                onChange={e => setNewStyle({ ...newStyle, name: e.target.value })}
                placeholder="e.g., Cyberpunk Industrial"
              />
            </div>
            <div className="grid-style-form-row">
              <div className="input-group">
                <label>Genre</label>
                <input
                  type="text"
                  value={newStyle.genre}
                  onChange={e => setNewStyle({ ...newStyle, genre: e.target.value })}
                  placeholder="e.g., Synthwave"
                />
              </div>
              <div className="input-group">
                <label>BPM</label>
                <input
                  type="number"
                  value={newStyle.bpm}
                  onChange={e => setNewStyle({ ...newStyle, bpm: Number(e.target.value) })}
                  placeholder="120"
                />
              </div>
            </div>
            <div className="input-group">
              <label>Prompt Tags (Pipe Separated or Comma Separated)</label>
              <textarea
                rows={3}
                required
                value={newStyle.prompt}
                onChange={e => setNewStyle({ ...newStyle, prompt: e.target.value })}
                placeholder="e.g., modular synthesizer | cinematic strings | dramatic breakbeat"
              />
            </div>
            <div className="input-group">
              <label>Filter Tags (Comma separated)</label>
              <input
                type="text"
                value={newStyle.tagsString}
                onChange={e => setNewStyle({ ...newStyle, tagsString: e.target.value })}
                placeholder="e.g., sci-fi, dark, energetic"
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save Preset</button>
              <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div className="glass-card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search styles by name, tags, genres, or keywords..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                  width: '100%',
                }}
              />
            </div>
          </div>

          <div className="style-grid">
            {filteredStyles.map(style => (
              <div key={style.id} className="style-card">
                <div className="style-card-header">
                  <span className="style-tag">{style.genre}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{style.bpm} BPM</span>
                </div>
                <div className="style-name">{style.name}</div>
                <div className="style-prompt">"{style.prompt}"</div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {style.tags.map((tag, idx) => (
                    <span key={idx} style={{
                      fontSize: '0.75rem',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '4px',
                      color: 'var(--text-secondary)'
                    }}>
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="style-actions">
                  <button className="style-btn" onClick={() => handleCopy(style.prompt)}>Copy</button>
                  {onSelectStyle && (
                    <button className="style-btn use-btn" onClick={() => onSelectStyle(style)}>Apply</button>
                  )}
                  <button className="style-btn" style={{ color: 'var(--color-accent)' }} onClick={() => handleDelete(style.id)}>Delete</button>
                </div>
              </div>
            ))}
            {filteredStyles.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No styles matched your search query.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
