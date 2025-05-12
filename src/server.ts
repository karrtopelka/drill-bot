import express, { Request, Response } from 'express';
import { webhookCallback } from 'grammy';
import debug from 'debug';
import { bot } from './bot';  // Import the bot instance from bot.ts

const debugLog = debug('bot:server');

// Environment variables
const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is unset');

const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || 'https://example.com';
const SECRET_PATH = process.env.SECRET_PATH || '';

// Create express app
const app = express();

// Parse JSON body
app.use(express.json());

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.send('Bot server is running!');
});

// Handle webhook requests
app.use(`/${SECRET_PATH}`, webhookCallback(bot, 'express'));

// Start the server
app.listen(PORT, () => {
  debugLog(`Server running on port ${PORT}`);

  // Set webhook
  bot.api.setWebhook(`${DOMAIN}/${SECRET_PATH}`).then(() => {
    debugLog(`Webhook set to ${DOMAIN}/${SECRET_PATH}`);
  }).catch(err => {
    debugLog('Failed to set webhook:', err);
  });
});

// Setup graceful stop
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
