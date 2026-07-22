import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { SunoClient } from './sunoClient.js'; // Use .js extension since we are in ES modules

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3005;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer for memory upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Settings file path
const settingsPath = path.join(__dirname, 'settings.json');

// Initialize settings
let settings = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  sunoCookie: process.env.SUNO_COOKIE || '',
};

// Load settings from disk if they exist
const loadSettings = () => {
  try {
    if (fs.existsSync(settingsPath)) {
      const fileData = fs.readFileSync(settingsPath, 'utf8');
      const loaded = JSON.parse(fileData);
      settings = { ...settings, ...loaded };
      console.log('Settings loaded successfully from settings.json');
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
};
loadSettings();

// Save settings to disk
const saveSettings = (newSettings: typeof settings) => {
  try {
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), 'utf8');
    settings = newSettings;
    console.log('Settings saved to disk');
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
};

// Helper to get effective Gemini Key from header, body, or settings
const getEffectiveGeminiKey = (req: express.Request): string => {
  const headerKey = req.headers['x-gemini-api-key'] as string;
  const bodyKey = req.body?.geminiApiKey as string;
  const effectiveKey = headerKey || bodyKey || settings.geminiApiKey || process.env.GEMINI_API_KEY || '';
  if (effectiveKey && effectiveKey !== settings.geminiApiKey) {
    saveSettings({
      geminiApiKey: effectiveKey,
      sunoCookie: settings.sunoCookie,
    });
  }
  return effectiveKey;
};

// Helper to get effective Suno Cookie from header, body, or settings
const getEffectiveSunoCookie = (req: express.Request): string => {
  const headerCookie = req.headers['x-suno-cookie'] as string;
  const bodyCookie = req.body?.sunoCookie as string;
  const effectiveCookie = headerCookie || bodyCookie || settings.sunoCookie || process.env.SUNO_COOKIE || '';
  if (effectiveCookie && effectiveCookie !== settings.sunoCookie) {
    saveSettings({
      geminiApiKey: settings.geminiApiKey,
      sunoCookie: effectiveCookie,
    });
  }
  return effectiveCookie;
};

// Helper to get initialized SunoClient
const getSunoClient = async (req?: express.Request) => {
  const cookieToUse = req ? getEffectiveSunoCookie(req) : settings.sunoCookie;
  if (!cookieToUse) {
    throw new Error('Suno Session Cookie is not configured in settings.');
  }
  const client = new SunoClient({ cookieString: cookieToUse });
  await client.init();
  return client;
};

// -------------------------------------------------------------
// Settings APIs
// -------------------------------------------------------------

app.get('/api/settings', (req, res) => {
  const effectiveGemini = getEffectiveGeminiKey(req);
  const effectiveSuno = getEffectiveSunoCookie(req);
  res.json({
    geminiApiKey: effectiveGemini,
    sunoCookie: effectiveSuno,
  });
});

app.post('/api/settings', (req, res) => {
  const { geminiApiKey, sunoCookie } = req.body;
  const success = saveSettings({
    geminiApiKey: geminiApiKey || '',
    sunoCookie: sunoCookie || '',
  });

  if (success) {
    res.json({ message: 'Settings saved successfully', settings });
  } else {
    res.status(500).json({ error: 'Failed to save settings to disk' });
  }
});

// -------------------------------------------------------------
// -------------------------------------------------------------
// Gemini APIs & Model Cascade
// -------------------------------------------------------------

const DEFAULT_MODEL_CASCADE = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
];

// Helper function to normalize audio mime types for Gemini API inlineData
function normalizeAudioMimeType(mimetype: string, originalname: string): string {
  const lowerMime = (mimetype || '').toLowerCase();
  const lowerName = (originalname || '').toLowerCase();

  if (lowerMime.includes('wav') || lowerName.endsWith('.wav')) return 'audio/wav';
  if (lowerMime.includes('mp3') || lowerMime.includes('mpeg') || lowerName.endsWith('.mp3')) return 'audio/mp3';
  if (lowerMime.includes('m4a') || lowerMime.includes('mp4') || lowerName.endsWith('.m4a') || lowerName.endsWith('.mp4')) return 'audio/mp4';
  if (lowerMime.includes('aac') || lowerName.endsWith('.aac')) return 'audio/aac';
  if (lowerMime.includes('ogg') || lowerName.endsWith('.ogg')) return 'audio/ogg';
  if (lowerMime.includes('flac') || lowerName.endsWith('.flac')) return 'audio/flac';

  return 'audio/mp3';
}

// Helper function to call generateContent with automatic model failover cascade (3.6-flash -> 3.5-flash -> 2.5-flash -> 1.5-flash)
async function generateContentWithFallback(ai: any, options: any) {
  let modelsToTry = [...DEFAULT_MODEL_CASCADE];

  if (options.model && !modelsToTry.includes(options.model)) {
    modelsToTry.unshift(options.model);
  } else if (options.model && options.model !== modelsToTry[0]) {
    modelsToTry = [options.model, ...modelsToTry.filter(m => m !== options.model)];
  }

  let lastError: any = null;

  for (const model of modelsToTry) {
    console.log(`[Gemini Cascade] Attempting generation with model: ${model}`);

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const payload = {
          ...options,
          model: model,
        };
        const response = await ai.models.generateContent(payload);
        console.log(`[Gemini Cascade] Success with model: ${model}`);
        return response;
      } catch (error: any) {
        lastError = error;
        const errorMsg = (error.message || '').toLowerCase();
        const status = error.status || error.statusCode;

        console.warn(`[Gemini Cascade] Model ${model} (Attempt ${attempt}/2) failed: ${error.message || error}`);

        const isNonRetryable = 
          errorMsg.includes('not found') || 
          errorMsg.includes('not supported') || 
          errorMsg.includes('invalid') || 
          errorMsg.includes('quota') ||
          status === 404 || 
          status === 400 || 
          status === 403;

        if (isNonRetryable || attempt === 2) {
          console.log(`[Gemini Cascade] Failing over from ${model} to next model in cascade...`);
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  console.error(`[Gemini Cascade] All model fallbacks failed: ${modelsToTry.join(' -> ')}`);
  throw lastError || new Error(`Gemini generation failed on all models (${modelsToTry.join(' -> ')}).`);
}

// 1. Curate prompt endpoint
app.post('/api/gemini/curate-prompt', async (req, res) => {
  const {
    genre,
    mood,
    instrumentation,
    vocalDirection,
    modifiers,
    mixCues,
    bpm,
    rawDescription,
  } = req.body;

  const apiKey = getEffectiveGeminiKey(req);
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API Key is not configured. Please add it in settings.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are an expert AI prompt engineer specializing in Suno AI Music Generation. 
Suno accepts a "Style box" prompt that is strictly limited to 200 characters. 
Your goal is to curate a highly optimized, high-density style prompt using the inputs provided.

Follow these strict rules:
1. FRONT-LOAD the genre/style in position 1.
2. Separate distinct elements/layers using pipe character " | " or commas.
3. Keep the total output length under 200 characters. Do not output anything other than the final prompt.
4. Convert descriptors into effective musical tags (e.g. use "raw vocals" or "acoustic recording" instead of "natural vocals" to avoid robotic tones).
5. Include a specific numeric BPM tag if provided (e.g. "120 BPM").
6. The standard structure is: [Genre] | [Mood] | [Instrumentation] | [Vocal Direction] | [Modifiers] | [BPM]`;

    const userMessage = `Please curate a style prompt with these details:
- Genre: ${genre || 'N/A'}
- Mood: ${mood || 'N/A'}
- Instrumentation: ${instrumentation || 'N/A'}
- Vocal Direction: ${vocalDirection || 'N/A'}
- Modifiers/Vibe: ${modifiers || 'N/A'}
- Mix Cues: ${mixCues || 'N/A'}
- BPM: ${bpm ? bpm + ' BPM' : 'N/A'}
- Raw Description: ${rawDescription || 'N/A'}`;

    const response = await generateContentWithFallback(ai, {
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            { text: userMessage },
          ],
        },
      ],
    });

    const curatedPrompt = response.text ? response.text.trim() : '';
    res.json({ curatedPrompt });
  } catch (error: any) {
    console.error('Error in curate-prompt:', error);
    res.status(500).json({ error: error.message || 'Gemini prompt curation failed.' });
  }
});

// 2. Lyric Helper endpoint
app.post('/api/gemini/lyric-helper', async (req, res) => {
  const { prompt, previousLyrics, section, deliveryCue, sectionPrompt, stylePrompt, explicitMode, explicitFrequency } = req.body;

  const apiKey = getEffectiveGeminiKey(req);
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API Key is not configured. Please add it in settings.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a world-class professional lyricist and recording artist collaborating on a Suno AI track. Your lyrics are sharp, authentic, and emotionally grounded. You write like a veteran — not like someone trying to sound like a songwriter.

==========================
STYLE CONTEXT
==========================
You will be given a Suno-style "style prompt" (e.g., "synthwave | melancholic | belted female vocals | 110 BPM"). Use this to inform:
- The TONE of the words (raw, intimate, aggressive, cinematic, etc.)
- The VOCABULARY complexity (street-level vs. literary vs. casual)
- The PACING and RHYTHM (short punchy lines for fast rap; longer breaths for slow ballads)
- The ATTITUDE (is the singer bragging, grieving, reflecting, haunting?)

==========================
WHAT MAKES LYRICS CORNY — AVOID ALL OF THIS
==========================
NEVER use tired, overheard clichés. These phrases are completely BANNED:
- "cold as ice," "cuts like a knife," "soar like an eagle," "down on my knees begging please"
- "weight of the world," "dance with the devil," "ghost in the machine"
- Hollow filler like "things aren't always what they seem"
- Lazy rhyme pairs: fire/desire, heart/apart/start, pain/rain/vain, make up/break up
- Overusing "Baby" as a meaningless filler word.

NEVER use "Yoda Speak" — do NOT reverse natural word order to land a rhyme:
- BAD: "That morning when I woke at dawn / My heart she broke to find her gone"
- GOOD: "It broke my heart that morning when I woke / to find her gone without a word"

NEVER misplace syllable emphasis to force a melody:
- BAD: "No more worryING" / "I'm through lov-ING you"
- GOOD: "No more WORrying" / "I'm through LOVing you"

NEVER just tell the listener what to feel. SHOW them a scene instead:
- BAD: "I miss you so much, it hurts every day"
- GOOD: "I still reach for my phone at 2 AM / then remember you won't answer"

NEVER use unanswered rhetorical questions as emotional filler:
- BAD: "Why did you leave me?" or "Why can't you see?"
- GOOD: Paint the specific scene. Let the image carry the weight.

NEVER go melodramatic without grounding it in mundane detail:
- BAD: "You cut me like a knife, I'm bleeding out, shadows in my mind keep haunting me..."
- GOOD: "I ran into your mom at the grocery store. She forgot I existed." (Noah Kahan-style specificity)

NEVER tack on filler words ("tonight," "right now," "all my life") for syllable count.

NEVER recount shared events to someone who was there:
- BAD: "Last night I took you home at ten and kissed you in the moonlight"
- GOOD: "Last night when I took you home... I knew it was forever" (share internal state, not facts)

NEVER use the Triathlon-of-Love (I'd walk/climb/swim for you). It's archaic and hollow.

NEVER force complex poetry or "big words" when the premise is conversational.

==========================
WHAT MAKES LYRICS GREAT — DO ALL OF THIS
==========================
1. SPECIFIC, SENSORY DETAILS
   - Not "I was sad" but "cold tiles against my knees at 3am"
   - Not "everything changed" but "she moved the furniture and I stood in the doorway"

2. CONVERSATIONAL RHYTHM
   - Every line must pass the "Speak it" test: read it aloud. Does it sound like real speech? Good. Does it feel forced? Rewrite it.

3. FRESH, UNEXPECTED METAPHORS
   - Not "she was my baby" but "she was a fast machine" (AC/DC)
   - Not "cold as ice" but "cold as a razor blade" (Roger Waters)
   - Not "I'm broken" but "Smash all the pictures where I am in the frame" (Bruno Major)

4. MATCH STRESSED SYLLABLES TO STRONG BEATS
   - Nouns, verbs, adjectives carry natural stress. Filler words (the, and, of, to) are weak.
   - NEVER open a phrase on a weak grammatical word on a strong downbeat.

5. INTERNAL EMOTIONAL HONESTY
   - What does the singer know that nobody else does? Write THAT.
   - The lyric should feel like a confession pulled out under pressure, not a performance.

6. EARNED AMBIGUITY
   - Don't over-explain. Let a strong image or line carry multiple meanings.
   - Trust the listener.

7. SECTIONAL INTENT
   - [Verse]: Specific, ground-level storytelling. A stable vocal pocket. Images and details.
   - [Pre-Chorus]: Stakes rise. Tension builds. Emotions start cracking at the seams.
   - [Chorus]: The payoff. Broad, universal, high-energy hook.
   - [Bridge]: Texture reset. New angle. A genuine turn — emotional, harmonic, or vocal.
   - [Outro]: Resolution or deliberately unresolved tension. Let it breathe.

8. SUNO TIMING AND PUNCTUATION CONTROL
   - Commas (,): Force a quick, natural breath or a short half-beat pause in the middle of a line.
   - Periods (.): Create a clean, definitive stop, signaling the AI to reset for the next line.
   - Ellipses (...): Create a long, dramatic, or suspenseful pause, making the vocal trail off.
   - Hyphens (-): Connect syllables or words to force a fast, tight, unbroken vocal flow (e.g., "to-night", "let-me-go").
   - Double line breaks: Use two line breaks between lines to create pauses, slow down sections, or signal flow transitions.

9. SUNO META-TAGS
   - Use [Whispered], [Belted], [Screamed], [Fast flow], [Music Pause], [Build], [Drop] to direct vocal delivery.
   - Only use them when the lyric's emotion demands it — don't over-tag.

==========================
OUTPUT RULES
==========================
- Output ONLY the raw lyrics and structural tags. Zero explanation. Zero preamble. Zero commentary.
- Use section markers like [Verse], [Chorus], [Bridge] exactly once at the top of each section.
- Generate ONLY the requested section. Do not add extra sections unless asked.`;

    const userMessage = `Generate lyrics for this track:

Style Box (use this to shape tone, vocabulary, pacing, and attitude of the lyrics):
${stylePrompt || 'Not specified — use your best judgment'}

Global Theme / Song Concept:
${prompt || 'Write a song'}

Section to write: ${section || 'Verse'}

Specific topic / instructions for THIS section:
${sectionPrompt || 'Follow the global theme. Be emotionally honest and specific.'}

Vocal delivery preference: ${deliveryCue || 'Match organically to the mood'}

Explicit Mode (Toggle): ${explicitMode ? 'ON' : 'OFF'}
Explicitness Frequency/Intensity (10% to 100%): ${explicitMode ? explicitFrequency + '%' : 'N/A'}
${explicitMode ? `CRITICAL: You MUST write explicit lyrics with raw emotion, grit, and profanity. The frequency and intensity of swear words, intense themes, and raw language should be scaled to ${explicitFrequency}% (10% is mild edge/light swearing, 50% is standard explicit, and 100% is fully uncensored, intense, and profane expression).` : 'Ensure the lyrics are clean and professional, matching the style without forced explicitness.'}

Previous lyrics (your section must flow from this — match the established rhythm and rhyme feel):
${previousLyrics || 'None — this is the first section.'}`;

    const response = await generateContentWithFallback(ai, {
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            { text: userMessage },
          ],
        },
      ],
    });

    const lyrics = response.text ? response.text.trim() : '';
    res.json({ lyrics });
  } catch (error: any) {
    console.error('Error in lyric-helper:', error);
    res.status(500).json({ error: error.message || 'Gemini lyrics helper failed.' });
  }
});

// 2b. Generate Full Song endpoint
app.post('/api/gemini/generate-full-song', async (req, res) => {
  const { structure, topic, stylePrompt, targetSyllables, explicitMode, explicitFrequency } = req.body;

  const apiKey = getEffectiveGeminiKey(req);
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API Key is not configured. Please add it in settings.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a world-class songwriting engine specializing in creating complete, multi-section song lyrics for Suno AI.

STRUCTURE PRESET: ${structure || 'Pop/Rock'}
TARGET SYLLABLE COUNT PER LINE: ~${targetSyllables || 8} syllables per line. Maintain consistent rhythm and flow!

SUNO AI TIMING & PUNCTUATION RULES:
- Commas (,): Force a quick breath / short half-beat pause in the line.
- Periods (.): Create a clean definitive stop.
- Ellipses (...): Create a long dramatic pause (vocals trail off).
- Hyphens (-): Connect syllables or words to force a fast unbroken vocal flow (e.g. "to-night").
- Double newlines: Create clear section separations.
- Meta-tags: Use bracketed tags like [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Outro], and vocal delivery cues like [Belted], [Whispered], [Drop] where appropriate.

ANTI-CORNY RULES:
- Zero clichés (banned: cold as ice, cuts like a knife, fire/desire, heart/apart).
- No Yoda speak or forced word order to make rhymes.
- Show specific sensory scenes rather than telling raw melodrama.

EXPLICIT MODE: ${explicitMode ? `ON (${explicitFrequency}% intensity - use raw, gritty profanity)` : 'OFF (Keep clean)'}

OUTPUT RULES:
- Output ONLY the raw complete lyrics with structural tags.
- Do NOT output any preambles, explanations, or commentary.`;

    const userMessage = `Write a complete structured song with these details:
Song Theme / Narrative: ${topic || 'An uplifting story about overcoming obstacles'}
Style Box Context: ${stylePrompt || 'Modern synthwave pop'}`;

    const response = await generateContentWithFallback(ai, {
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            { text: userMessage },
          ],
        },
      ],
    });

    const lyrics = response.text ? response.text.trim() : '';
    res.json({ lyrics });
  } catch (error: any) {
    console.error('Error in generate-full-song:', error);
    res.status(500).json({ error: error.message || 'Full song generation failed.' });
  }
});

// 3. Analyze Song endpoint (audio diagnostics using Gemini audio inputs)
app.post('/api/gemini/analyze-song', upload.single('audio'), async (req, res) => {
  const apiKey = getEffectiveGeminiKey(req);
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API Key is not configured. Please add it in settings.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded for analysis.' });
  }

  if (req.file.size > 18 * 1024 * 1024) {
    return res.status(400).json({ error: 'Audio file exceeds the 18MB size limit for inline AI analysis. Please upload a shorter clip or compressed MP3/M4A.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const mimeType = normalizeAudioMimeType(req.file.mimetype, req.file.originalname);

    const promptText = `You are an elite, multi-platinum music producer, veteran audio engineer, and ruthless music critic. 
Analyze this uploaded audio track (a song, demo, or vocal cut) with professional scrutiny. 

You must evaluate both the musical production/sonic quality and the lyricism/songwriting.
Analyze the lyrics you hear in the audio for:
- Corniness, clichés, or amateur writing tropes.
- Rhyme scheme quality (e.g., lazy rhymes like fire/desire).
- Cadence, rhythmic pocket, flow schemes, and vocal phrasing.
- Syllable stress and alignment to the musical beat.

Evaluate the target audience appeal and market potential (does this sound like a hit, or does it sound like generic filler?).

Calculate a "Production Score" from 0 to 100 representing how "market-ready" or "radio-ready" this song is. Be honest and critical; do not hand out high scores easily.

You MUST structure your response EXACTLY matching this markdown template. Do not deviate from these section names or headers:

# 🎵 SONG ANALYSIS & DIAGNOSTICS REPORT

## 📝 Executive Summary
[Write a summary of the song, analyzing its style, genre, overall artistic direction, estimated BPM, and key. Critique the track like an experienced music editor or A&R executive.]

## 🚀 What the Song Does Well
- **[Strength 1]**: [Detail why this works from a producer/critic perspective.]
- **[Strength 2]**: [Detail why this works.]

## 🛠️ Areas of Improvement
- **[Weakness 1]**: [Detail what needs to change in the arrangement, mix, or vocals.]
- **[Weakness 2]**: [Detail what needs to change.]

## 🎯 Audience Appeal & Market Potential
[Provide a deep analysis of whether this song has commercial or indie appeal, who the target demographic is, and if it has the potential to grab listeners in the current streaming landscape.]

## ✍️ Lyric & Phrasing Critique
[Examine the lyric writing style, checking for clichés, flow issues, cadence misalignment, corniness, or awkward stresses. Be specific about what lines or styles feel weak.]

## 🎛️ Audio Engineering & Mix Diagnostics
[Analyze the technical mix quality: check for robotic vocals, frequency masking, muddy bass, harsh highs, dynamic range compression issues, and style drift.]

## 📊 Production Score: [SCORE]/100
**Market Readiness Justification**: [Give a detailed professional reasoning for why you gave the track this score, and what the single biggest bottleneck is preventing it from being 100/100.]`;

    const response = await generateContentWithFallback(ai, {
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            {
              inlineData: {
                data: req.file.buffer.toString('base64'),
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
    });

    const diagnostics = response.text ? response.text.trim() : '';
    res.json({ diagnostics });
  } catch (error: any) {
    console.error('Error in analyze-song:', error);
    res.status(500).json({ error: error.message || 'Gemini audio analysis failed.' });
  }
});

// 4. Adjust From Analysis endpoint (AI Song Fixer)
app.post('/api/gemini/adjust-from-analysis', async (req, res) => {
  const { diagnostics, currentLyrics, currentStylePrompt } = req.body;

  const apiKey = getEffectiveGeminiKey(req);
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API Key is not configured. Please add it in settings.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a professional songwriter and music producer.
You have been provided with diagnostics from an audio analysis of a Suno AI generated song.
Your task is to adjust the current lyrics and style prompt to fix the issues identified in the diagnostics.

Consider these professional songwriting principles:
- Fix any robotic vocals or unnatural phrasing by adjusting syllables or adding conversational flow.
- Add vocal delivery cues or structural tags (e.g. [Music Pause], [Build], [Drop]) to address structural issues or style drift.
- Optimize the style prompt (keep under 200 chars) to fix mixing/style issues mentioned in the diagnostics.

Return ONLY a JSON object with this exact format (no markdown code blocks, just raw JSON string):
{
  "revisedLyrics": "the new lyrics with adjustments",
  "revisedStylePrompt": "the updated 120-char style prompt"
}`;

    const userMessage = `Diagnostics:
${diagnostics || 'No diagnostics provided.'}

Current Lyrics:
${currentLyrics || 'None'}

Current Style Prompt:
${currentStylePrompt || 'None'}`;

    const response = await generateContentWithFallback(ai, {
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            { text: userMessage },
          ],
        },
      ],
    });

    let rawText = response.text ? response.text.trim() : '';
    if (rawText.startsWith('\`\`\`json')) {
      rawText = rawText.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
    } else if (rawText.startsWith('\`\`\`')) {
      rawText = rawText.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
    }
    
    const result = JSON.parse(rawText);
    res.json(result);
  } catch (error: any) {
    console.error('Error in adjust-from-analysis:', error);
    res.status(500).json({ error: error.message || 'Gemini adjust from analysis failed.' });
  }
});

// 5. Make Explicit endpoint
app.post('/api/gemini/make-explicit', async (req, res) => {
  const { lyrics, stylePrompt } = req.body;

  const apiKey = getEffectiveGeminiKey(req);
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API Key is not configured. Please add it in settings.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a professional songwriting assistant. Your task is to take the provided lyrics and make them EXPLICIT.
Add profanity, grit, raw emotional energy, and mature themes where appropriate. Do not make it cartoonish or silly; make it sound authentic, gritty, and raw.
Preserve the original song structure (e.g., [Verse], [Chorus], and any existing delivery tags) and keep the original narrative/theme.

PUNCTUATION AND TIMING RULES FOR SUNO AI:
- Commas (,): Force a quick, natural breath or a short half-beat pause in the middle of a line.
- Periods (.): Create a clean, definitive stop, signaling the AI to reset for the next line.
- Ellipses (...): Create a long, dramatic, or suspenseful pause, making the vocal trail off.
- Hyphens (-): Connect syllables or words to force a fast, tight, unbroken vocal flow (e.g., "to-night").
- Double line breaks: Use two line breaks to create pauses, slow down sections, or signal flow transitions.

Keep the style context in mind:
Style: ${stylePrompt || 'Not specified'}

Output ONLY the revised explicit lyrics. Do not include any explanations, preamble, or markdown code blocks.`;

    const userMessage = `Current Lyrics:\n${lyrics}`;

    const response = await generateContentWithFallback(ai, {
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            { text: userMessage },
          ],
        },
      ],
    });

    const explicitLyrics = response.text ? response.text.trim() : '';
    res.json({ explicitLyrics });
  } catch (error: any) {
    console.error('Error in make-explicit:', error);
    res.status(500).json({ error: error.message || 'Gemini make explicit failed.' });
  }
});

// 6. Analyze Lyrics endpoint
app.post('/api/gemini/analyze-lyrics', async (req, res) => {
  const { lyrics, stylePrompt } = req.body;

  const apiKey = getEffectiveGeminiKey(req);
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API Key is not configured. Please add it in settings.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a professional lyric analyst and songwriting coach.
Analyze the provided lyrics against the style prompt and the anti-corny guidelines:
- Avoid lazy rhymes (fire/desire, pain/rain) and tired clichés (cold as ice, cuts like a knife).
- Avoid Yoda speak (reversing word order to rhyme) and misplaced syllable emphasis.
- Focus on "showing" emotions with specific details instead of "telling" abstract melodrama.
- Share internal feelings rather than recounting the obvious.
- Ensure natural conversational phrasing and prosody.
- Evaluate the timing/punctuation structure (Suno timing punctuation: commas for short breaths, periods for resets, ellipses for long dramatic fades, hyphens for fast connected flow, and double newlines for transitions). Suggest adding these punctuation timing controls to improve rhythm.

Evaluate the explicitness level (Clean, Semi-Explicit, or Explicit).
Identify areas of concern (e.g. corny lines, poor rhythm, lack of timing punctuation) and provide a concise critique.
Generate 3 variations/recommendations of the lyrics at varying degrees:
1. Option 1: Clean & Grounded (polished, clean, professional, absolutely zero clichés, with optimized Suno timing punctuation)
2. Option 2: Gritty & Raw (adds moderate edge, mild swearing, gritty emotion, with optimized Suno timing punctuation)
3. Option 3: Full Explicit (adds intense uncensored language, raw truth, explicit themes, with optimized Suno timing punctuation)

For all options, maintain the general song structure and core theme, but rewrite the specific lines that feel corny, weak, or need explicitness/timing adjustments. Ensure you use proper Suno punctuation timing: commas (,), periods (.), ellipses (...), hyphens (-), and double line breaks.

Return ONLY a JSON object in this exact format (no markdown code blocks, just raw JSON string):
{
  "rating": "Clean / Semi-Explicit / Explicit",
  "critique": "A brief overview pointing out any clichés, corny phrasing, or prosody issues.",
  "recommendations": [
    {
      "degree": "Clean & Grounded",
      "description": "Polished to eliminate clichés while remaining fully clean.",
      "revisedLyrics": "the complete revised clean lyrics..."
    },
    {
      "degree": "Gritty & Raw",
      "description": "Gritty flow with mild profanity and more intense imagery.",
      "revisedLyrics": "the complete revised gritty lyrics..."
    },
    {
      "degree": "Uncensored Explicit",
      "description": "Raw, unfiltered explicit version with intense language.",
      "revisedLyrics": "the complete revised uncensored lyrics..."
    }
  ]
}`;

    const userMessage = `Lyrics to analyze:\n${lyrics}\n\nStyle Context: ${stylePrompt || 'Not specified'}`;

    const response = await generateContentWithFallback(ai, {
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            { text: userMessage },
          ],
        },
      ],
    });

    let rawText = response.text ? response.text.trim() : '';
    if (rawText.startsWith('\`\`\`json')) {
      rawText = rawText.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
    } else if (rawText.startsWith('\`\`\`')) {
      rawText = rawText.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
    }

    const result = JSON.parse(rawText);
    res.json(result);
  } catch (error: any) {
    console.error('Error in analyze-lyrics:', error);
    res.status(500).json({ error: error.message || 'Gemini lyric analysis failed.' });
  }
});

// -------------------------------------------------------------
// Suno Proxy APIs
// -------------------------------------------------------------

// 1. Generate endpoint
app.post('/api/suno/generate', async (req, res) => {
  const { prompt, make_instrumental, model } = req.body;
  try {
    const client = await getSunoClient(req);
    const clips = await client.generate(prompt, !!make_instrumental, model);
    res.json(clips);
  } catch (error: any) {
    console.error('Suno Proxy Generate Error:', error);
    res.status(500).json({ error: error.message || 'Suno generation proxy failed' });
  }
});

// 2. Custom Generate endpoint
app.post('/api/suno/custom_generate', async (req, res) => {
  const { prompt, tags, title, make_instrumental, model, negative_tags } = req.body;
  try {
    const client = await getSunoClient(req);
    const clips = await client.customGenerate({
      prompt: prompt || '',
      tags: tags || '',
      title: title || '',
      makeInstrumental: !!make_instrumental,
      model,
      negativeTags: negative_tags,
    });
    res.json(clips);
  } catch (error: any) {
    console.error('Suno Proxy Custom Generate Error:', error);
    res.status(500).json({ error: error.message || 'Suno custom generation proxy failed' });
  }
});

// 3. Extend Audio endpoint
app.post('/api/suno/extend_audio', async (req, res) => {
  const { clip_id, continue_at, prompt, tags, title, negative_tags, make_instrumental, model } = req.body;
  try {
    const client = await getSunoClient(req);
    const clips = await client.extendAudio({
      clipId: clip_id,
      continueAt: Number(continue_at),
      prompt,
      tags,
      title,
      negativeTags: negative_tags,
      makeInstrumental: !!make_instrumental,
      model,
    });
    res.json(clips);
  } catch (error: any) {
    console.error('Suno Proxy Extend Audio Error:', error);
    res.status(500).json({ error: error.message || 'Suno extend audio proxy failed' });
  }
});

// 4. Concatenate endpoint
app.post('/api/suno/concat', async (req, res) => {
  const { clip_id } = req.body;
  try {
    const client = await getSunoClient(req);
    const result = await client.concatenate(clip_id);
    res.json(result);
  } catch (error: any) {
    console.error('Suno Proxy Concat Error:', error);
    res.status(500).json({ error: error.message || 'Suno concat proxy failed' });
  }
});

// 5. Generate Stems endpoint
app.post('/api/suno/generate_stems', async (req, res) => {
  const { clip_id } = req.body;
  try {
    const client = await getSunoClient(req);
    const result = await client.generateStems(clip_id);
    res.json(result);
  } catch (error: any) {
    console.error('Suno Proxy Generate Stems Error:', error);
    res.status(500).json({ error: error.message || 'Suno generate stems proxy failed' });
  }
});

// 6. Quota check limit endpoint
app.get('/api/suno/get_limit', async (req, res) => {
  try {
    const client = await getSunoClient(req);
    const limit = await client.getLimit();
    res.json(limit);
  } catch (error: any) {
    console.error('Suno Proxy Limit Check Error:', error);
    res.status(500).json({ error: error.message || 'Suno quota check proxy failed' });
  }
});

// 7. Get feed clips list endpoint
app.get('/api/suno/get', async (req, res) => {
  const songIdsString = req.query.ids as string | undefined;
  const pageString = req.query.page as string | undefined;

  const songIds = songIdsString ? songIdsString.split(',') : undefined;
  const page = pageString ? Number(pageString) : undefined;

  try {
    const client = await getSunoClient(req);
    const clips = await client.getFeed(songIds, page);
    res.json(clips);
  } catch (error: any) {
    console.error('Suno Proxy Get Feed Error:', error);
    res.status(500).json({ error: error.message || 'Suno get feed proxy failed' });
  }
});

// 8. Get single clip details endpoint
app.get('/api/suno/clip/:id', async (req, res) => {
  const clipId = req.params.id;
  try {
    const client = await getSunoClient(req);
    const clip = await client.getClip(clipId);
    res.json(clip);
  } catch (error: any) {
    console.error('Suno Proxy Get Clip Error:', error);
    res.status(500).json({ error: error.message || 'Suno get clip proxy failed' });
  }
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Express server is running on http://localhost:${PORT}`);
});
