import { config } from 'dotenv';
config();

import { bot } from './bot';
import debug from 'debug';

const debugLog = debug('bot:production');

// Start the bot in long-polling mode
debugLog('Bot is starting in production mode (polling)...');
bot.start({
  onStart: (botInfo) => {
    debugLog(`Bot @${botInfo.username} started in production mode!`);
  },
});

// Setup graceful stop
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
