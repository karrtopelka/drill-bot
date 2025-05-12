import { Context } from 'telegraf';
import createDebug from 'debug';


const debug = createDebug('bot:about_command');

const about = () => async (ctx: Context) => {
  const message = `*DRILL BOT*`;
  debug(`Triggered "about" command with message \n${message}`);
  await ctx.replyWithMarkdownV2(message, { parse_mode: 'Markdown' });
};

export { about };
