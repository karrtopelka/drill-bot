import { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import createDebug from 'debug';

const debug = createDebug('bot:greeting_text');

const replyToMessage = (ctx: Context, messageId: number, string: string) =>
  ctx.reply(string, {
    reply_parameters: { message_id: messageId },
  });

const greeting = () => async (ctx: Context) => {
  debug('Triggered "greeting" text command');

  if (!ctx.has(message('text'))) return;

  const messageId = ctx.message.message_id;
  const userName = `${ctx.message.from.first_name} ${ctx.message.from.last_name}`;

  await replyToMessage(ctx, messageId, `Hello, ${userName}!`);
};

export { greeting };
