import debug from "debug";
import { Bot } from "grammy";
import { handleTiktokDownload } from "./tiktok-handler";
import { USER_EMOJIS } from './constants';
import { ensureMessageReactionEntry } from './utils';

const debugLog = debug("bot:dev");

// Initialize the bot
const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is unset");

// Create bot instance
export const bot = new Bot(token);

// About command
bot.command("about", async (ctx) => {
  const message = `*DRILL BOT*`;
  debugLog(`Triggered "about" command with message \n${message}`);
  await ctx.reply(message, { parse_mode: "MarkdownV2" });
});

// Handle TikTok links in messages
bot.on("message:text", async (ctx) => {
  const text = ctx.message?.text;
  if (!text) return;

  // Check if message contains TikTok link
  const tiktokPattern = /(https?:\/\/)?(www\.)?(vm\.tiktok\.com|tiktok\.com)\/\S+/i;
  if (!tiktokPattern.test(text)) return;

  debugLog("Detected TikTok link");

  let loadingMsg;
  try {
    // Send loading message
    loadingMsg = await ctx.reply("⏳ Завантажую відео...\n⬜️⬜️⬜️⬜️⬜️");

    // Extract the link from the message text
    const link = text.match(tiktokPattern)?.[0];

    if (!link) {
      if (loadingMsg) {
        await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
      }
      return;
    }

    await handleTiktokDownload(ctx, link, loadingMsg);
  } catch (error) {
    console.error("Error in message handler:", error);
    if (loadingMsg) {
      await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
    }
  }
});

bot.on("callback_query:data", async (ctx) => {
  const reactionType = ctx.callbackQuery.data; // "react_like" or "react_dislike"
  const userId = ctx.callbackQuery.from.username!;
  const messageId = ctx.callbackQuery.message?.message_id;

  if (!messageId) {
    return;
  }

  // Use ensureMessageReactionEntry to get or create the entry
  const currentReactions = ensureMessageReactionEntry(messageId);

  // Update reaction state
  if (reactionType === "react_like") {
    if (currentReactions.likes.has(userId)) {
      currentReactions.likes.delete(userId); // Unlike
    } else {
      currentReactions.likes.add(userId);
      currentReactions.dislikes.delete(userId); // Remove from dislikes if switching
    }
  } else if (reactionType === "react_dislike") {
    if (currentReactions.dislikes.has(userId)) {
      currentReactions.dislikes.delete(userId); // Un-dislike
    } else {
      currentReactions.dislikes.add(userId);
      currentReactions.likes.delete(userId); // Remove from likes if switching
    }
  }

  // Generate new button texts
  const likesText = "❤️" + (currentReactions.likes.size > 0 ? ": " : "") +
                    [...currentReactions.likes].map(id => USER_EMOJIS[id] || '❓').join(" ");
  const dislikesText = "💔" + (currentReactions.dislikes.size > 0 ? ": " : "") +
                       [...currentReactions.dislikes].map(id => USER_EMOJIS[id] || '❓').join(" ");

  // Update the keyboard
  try {
    await ctx.editMessageReplyMarkup({
      reply_markup: {
        inline_keyboard: [
          [
            { text: likesText, callback_data: "react_like" },
            { text: dislikesText, callback_data: "react_dislike" },
          ],
        ],
      },
    });
  } catch (error) {
    // Handle potential errors, e.g., message not modified if keyboard is the same
    console.error("Error editing message reply markup:", error);
  }

  await ctx.answerCallbackQuery(); // Acknowledge the callback
});

// Start the bot (only in development mode)
if (process.env.NODE_ENV !== 'production') {
  debugLog("Bot is starting in development mode...");
  bot.start({
    onStart: (botInfo) => {
      debugLog(`Bot @${botInfo.username} started in development mode!`);
    },
  });
}

// Setup graceful stop
process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());
