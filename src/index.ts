import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { about } from './commands';
import { greeting, handleTikTokLink } from './text';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, production } from './core';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';

const bot = new Telegraf(BOT_TOKEN);

bot.command('about', about());
bot.on(message('text'), handleTikTokLink());
// bot.on(message('text'), greeting());

//prod mode (Vercel)
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};
//dev mode
ENVIRONMENT !== 'production' && development(bot);
