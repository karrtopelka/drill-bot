# Drill Bot - Telegram Bot for TikTok Videos and Polls

A Telegram bot for downloading TikTok videos with social reaction features and AI-powered poll generation.

## Features

### TikTok Download System

- Detects TikTok links in messages
- Downloads videos, image slideshows, and audio
- Supports both watermarked and HD quality
- Progress tracking with animated spinner
- Automatic message cleanup

### Social Reactions

- Like/dislike system with inline keyboards
- User-specific emoji mapping
- Memory-efficient reaction storage
- Real-time reaction updates

### AI-Powered Poll Generation

- `/poll` command generates "would you rather" style polls
- AI integration ready (placeholder implementation included)
- Automatic English to Ukrainian translation
- SQLite database storage to prevent duplicates
- Interactive voting with user emoji display
- Progress tracking during generation

## Commands

- `/about` - Bot information
- `/ping` - Mentions all configured users
- `/poll` - Generate a new AI-powered poll

## Setup

### Environment Variables

```bash
BOT_TOKEN=your_telegram_bot_token
DOMAIN=your_webhook_domain  # for production
SECRET_PATH=your_webhook_path  # for production
OLLAMA_URL=http://localhost:11434  # for AI service
AI_MODEL=neuraldaredevil-8b-abliterated  # AI model name
```

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm run dev
```

### Production

```bash
pnpm run build
pnpm start
```

## Architecture

### File Structure

```
src/
├── bot.ts              # Main bot logic & handlers
├── tiktok-handler.ts   # TikTok download workflow
├── download-tiktok.ts  # Core download functions
├── constants.ts        # User config & reaction/poll storage
├── utils.ts           # Reaction and poll management utilities
├── server.ts          # Express webhook server
├── production.ts      # Production polling mode
└── services/
    ├── database.ts    # SQLite database operations
    ├── ai-service.ts  # AI integration (Ollama)
    └── translator.ts  # Google Translate integration
```

### Database Schema

```sql
CREATE TABLE polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  option1 TEXT NOT NULL,
  option2 TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  hash TEXT UNIQUE NOT NULL
);
```

## Poll Generation Workflow

1. **Fetch History** - Load existing polls from SQLite database
2. **AI Generation** - Generate new poll using AI model (avoiding duplicates)
3. **Translation** - Translate from English to Ukrainian using Google Translate
4. **Storage** - Save to database with duplicate prevention
5. **Delivery** - Send interactive poll with voting buttons

## Voting System

- Interactive buttons (🅰️/🅱️) for poll options
- Real-time vote counts and user emoji display
- Vote switching and un-voting supported
- Separate storage from TikTok reaction system

## AI Integration

The bot is ready for AI integration with:

- Ollama API interface prepared
- Placeholder implementation with sample polls
- Prompt engineering framework in place
- Error handling and fallbacks

To activate AI:

1. Install and run Ollama
2. Pull the model: `ollama pull neuraldaredevil-8b-abliterated`
3. Uncomment AI call in `ai-service.ts`

## Translation

Uses `@vitalets/google-translate-api` for:

- English to Ukrainian translation
- Parallel translation of poll components
- Fallback to original text on errors
- Character-based Ukrainian detection

## Deployment

**Development:** Long-polling mode
**Production:** Webhook-based (Vercel ready)

The bot supports both deployment strategies and automatically detects the environment.
