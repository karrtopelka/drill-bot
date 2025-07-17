// Load env variables first
require('dotenv').config();

import { bot } from './bot';

// Start the bot in long-polling mode
console.log('🤖 Bot is starting in production mode (polling)...');
bot.start({
  onStart: (botInfo) => {
    console.log(`✅ Bot @${botInfo.username} started in production mode!`);
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  },
});

// Setup graceful stop
process.once('SIGINT', () => {
  console.log('🛑 Received SIGINT, stopping bot...');
  bot.stop();
});
process.once('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, stopping bot...');
  bot.stop();
});
