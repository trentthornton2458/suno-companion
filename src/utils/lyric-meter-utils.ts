export interface LineAnalysis {
  lineIndex: number;
  text: string;
  isTag: boolean;
  syllables: number;
  endWord: string;
  rhymeKey: string;
  rhymeGroup: string; // e.g. 'A', 'B', 'C', 'D' or ''
  rhymeColor: string; // CSS variable or class
  isImbalanced: boolean; // Flag if line syllable count deviates significantly from average
}

export interface SongMeterAnalysis {
  lines: LineAnalysis[];
  totalSyllables: number;
  totalLines: number;
  avgSyllablesPerLine: number;
  rhymeSchemeSummary: string; // e.g. "AABB / ABAB"
}

// Color palette for rhyming pairs/groups
const RHYME_COLORS = [
  '#00f0ff', // A: Neon Cyan
  '#ff007f', // B: Neon Pink
  '#a855f7', // C: Neon Purple
  '#10b981', // D: Emerald Green
  '#f59e0b', // E: Amber Gold
  '#3b82f6', // F: Bright Blue
  '#ec4899', // G: Rose Pink
  '#8b5cf6', // H: Violet
];

/**
 * Heuristic syllable counter for English words
 */
export function countSyllablesInWord(word: string): number {
  const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!cleanWord) return 0;
  if (cleanWord.length <= 3) return 1;

  let count = 0;
  const processed = cleanWord
    .replace(/(?:|c|s)hes$/g, '')
    .replace(/(?:|c|s)hed$/g, '')
    .replace(/([^t|d])ed$/g, '$1')
    .replace(/e$/g, '');

  const matches = processed.match(/[aeiouy]{1,2}/g);
  count = matches ? matches.length : 1;

  // Adjustments for common silent or extra vowel patterns
  if (cleanWord.endsWith('le') && cleanWord.length > 2 && !/[aeiou]le$/.test(cleanWord)) {
    count++;
  }
  if (cleanWord.endsWith('ia') || cleanWord.endsWith('io') || cleanWord.endsWith('eo')) {
    count++;
  }

  return Math.max(1, count);
}

/**
 * Counts total syllables in a line of lyrics, excluding bracketed Suno tags
 */
export function countLineSyllables(line: string): number {
  // Strip out bracketed tags like [Verse], [Chorus], [Whispered], (Synth Intro)
  const cleanLine = line.replace(/\[.*?\]|\(.*?\)/g, '').trim();
  if (!cleanLine) return 0;

  const words = cleanLine.split(/\s+/);
  return words.reduce((total, word) => total + countSyllablesInWord(word), 0);
}

/**
 * Extracts phonetic ending key for rhyme matching
 */
export function extractEndRhymeKey(line: string): string {
  const cleanLine = line.replace(/\[.*?\]|\(.*?\)/g, '').trim();
  if (!cleanLine) return '';

  const words = cleanLine.split(/\s+/).filter(w => w.replace(/[^a-zA-Z]/g, '').length > 0);
  if (words.length === 0) return '';

  const lastWord = words[words.length - 1].toLowerCase().replace(/[^a-z]/g, '');
  if (!lastWord) return '';

  // Extract trailing sound pattern (last 2-3 chars or vowel-consonant tail)
  const match = lastWord.match(/[aeiouy][a-z]*$/);
  if (match) {
    return match[0];
  }
  return lastWord.slice(-3);
}

/**
 * Analyzes full lyric text line by line for syllables, rhyming schemes, and cadence balance
 */
export function analyzeLyricMeter(lyrics: string): SongMeterAnalysis {
  const rawLines = lyrics.split('\n');
  const lineAnalyses: LineAnalysis[] = [];

  let totalSyllables = 0;
  let nonTagCount = 0;

  // First pass: compute line stats and gather rhyme keys
  rawLines.forEach((text, index) => {
    const trimmed = text.trim();
    const isTag = trimmed.startsWith('[') && trimmed.endsWith(']') && !trimmed.includes(' ');
    const isComment = trimmed.startsWith('(') && trimmed.endsWith(')');

    if (!trimmed || isTag || isComment) {
      lineAnalyses.push({
        lineIndex: index,
        text,
        isTag: true,
        syllables: 0,
        endWord: '',
        rhymeKey: '',
        rhymeGroup: '',
        rhymeColor: 'transparent',
        isImbalanced: false,
      });
      return;
    }

    const syllables = countLineSyllables(text);
    const rhymeKey = extractEndRhymeKey(text);
    const words = text.replace(/\[.*?\]|\(.*?\)/g, '').trim().split(/\s+/);
    const endWord = words.length > 0 ? words[words.length - 1].replace(/[^a-zA-Z]/g, '') : '';

    totalSyllables += syllables;
    nonTagCount++;

    lineAnalyses.push({
      lineIndex: index,
      text,
      isTag: false,
      syllables,
      endWord,
      rhymeKey,
      rhymeGroup: '',
      rhymeColor: 'transparent',
      isImbalanced: false,
    });
  });

  const avgSyllablesPerLine = nonTagCount > 0 ? Math.round(totalSyllables / nonTagCount) : 0;

  // Second pass: group end-rhymes into scheme letters (A, B, C, D...)
  const rhymeKeyToGroup: Record<string, { letter: string; color: string }> = {};
  let groupCounter = 0;

  lineAnalyses.forEach(item => {
    if (item.isTag || !item.rhymeKey) return;

    if (!rhymeKeyToGroup[item.rhymeKey]) {
      const letter = String.fromCharCode(65 + (groupCounter % 26)); // A, B, C...
      const color = RHYME_COLORS[groupCounter % RHYME_COLORS.length];
      rhymeKeyToGroup[item.rhymeKey] = { letter, color };
      groupCounter++;
    }

    const match = rhymeKeyToGroup[item.rhymeKey];
    item.rhymeGroup = match.letter;
    item.rhymeColor = match.color;

    // Check for rhythm imbalance (>35% deviation from section average)
    if (avgSyllablesPerLine > 0) {
      const diffRatio = Math.abs(item.syllables - avgSyllablesPerLine) / avgSyllablesPerLine;
      if (diffRatio > 0.35 && item.syllables > 4) {
        item.isImbalanced = true;
      }
    }
  });

  // Calculate Rhyme Scheme Summary
  const nonTagLetters = lineAnalyses.filter(l => !l.isTag && l.rhymeGroup).map(l => l.rhymeGroup);
  const rhymeSchemeSummary = nonTagLetters.slice(0, 8).join('') || 'Free Verse';

  return {
    lines: lineAnalyses,
    totalSyllables,
    totalLines: nonTagCount,
    avgSyllablesPerLine,
    rhymeSchemeSummary,
  };
}
