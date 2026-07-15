# SUNO Companion

AI-powered songwriting companion for Suno AI music generation.

## Features

- **Songwriting Assistant** — AI-curated style prompts and lyric generation via Gemini
- **Style Manager** — Save and manage reusable style presets
- **Song Analyzer** — Upload audio for AI-powered production diagnostics
- **Suno Integration** — Direct song generation, extension, and stem separation

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js (Firebase Cloud Functions)
- **AI**: Google Gemini API
- **Hosting**: Firebase Hosting + Cloud Functions

## Local Development

```bash
npm install
npm run dev
```

This starts both the Vite dev server (port 5173) and the Express backend (port 3005).

## Deployment

```bash
npm run deploy
```

Or deploy individually:

```bash
npm run deploy:hosting    # Frontend only
npm run deploy:functions  # Backend only
```

## Configuration

Set your API keys in the Settings tab of the app:
- **Gemini API Key** — from [Google AI Studio](https://aistudio.google.com/)
- **Suno Cookie** — session cookie from suno.com

## License

MIT
