import debug from "debug";
import { Bot } from "grammy";
import { USER_EMOJIS, USER_IDS } from './constants';
import { databaseService } from './services/database';
import { handleTiktokDownload } from "./tiktok-handler";
import { ensureMessageReactionEntry, ensurePollVoteEntry } from './utils';

const debugLog = debug("bot:dev");

// Initialize the bot
const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is unset");

// Create bot instance
export const bot = new Bot(token);

// Initialize database
databaseService.init().catch(err => {
  console.error('Failed to initialize database:', err);
});

// About command
bot.command("about", async (ctx) => {
  const message = `*DRILL BOT*`;
  debugLog(`Triggered "about" command with message \n${message}`);
  await ctx.reply(message, { parse_mode: "MarkdownV2" });
});

// Ping all users command.
bot.command("ping", async (ctx) => {
  const userMentions = Object.values(USER_IDS).map(userId => `@${userId}`).join(" ");
  const message = `${userMentions}`;
  debugLog(`Triggered "ping" command with message \n${message}`);
  await ctx.reply(message);
});

// Poll generation command, TODO: uncomment when ready to release.
// bot.command("poll", handlePollCommand);

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
  const callbackData = ctx.callbackQuery.data;
  const userId = ctx.callbackQuery.from.username!;
  const messageId = ctx.callbackQuery.message?.message_id;

  if (!messageId) {
    await ctx.answerCallbackQuery();
    return;
  }

  // Handle poll voting
  if (callbackData === "poll_option_a" || callbackData === "poll_option_b") {
    const currentVotes = ensurePollVoteEntry(messageId);

    // Update vote state
    if (callbackData === "poll_option_a") {
      if (currentVotes.optionA.has(userId)) {
        currentVotes.optionA.delete(userId); // Un-vote
      } else {
        currentVotes.optionA.add(userId);
        currentVotes.optionB.delete(userId); // Remove from other option if switching
      }
    } else if (callbackData === "poll_option_b") {
      if (currentVotes.optionB.has(userId)) {
        currentVotes.optionB.delete(userId); // Un-vote
      } else {
        currentVotes.optionB.add(userId);
        currentVotes.optionA.delete(userId); // Remove from other option if switching
      }
    }

    // Generate new button texts with user emojis (like reactions)
    const optionAText = "🅰️" + (currentVotes.optionA.size > 0 ? ": " : "") +
                        [...currentVotes.optionA].map(id => USER_EMOJIS[id as USER_IDS] || '❓').join("");
    const optionBText = "🅱️" + (currentVotes.optionB.size > 0 ? ": " : "") +
                        [...currentVotes.optionB].map(id => USER_EMOJIS[id as USER_IDS] || '❓').join("");

    // Update the keyboard
    try {
      await ctx.editMessageReplyMarkup({
        reply_markup: {
          inline_keyboard: [
            [
              { text: optionAText, callback_data: "poll_option_a" },
              { text: optionBText, callback_data: "poll_option_b" }
            ]
          ]
        }
      });
    } catch (error) {
      console.error("Error editing poll reply markup:", error);
    }

    await ctx.answerCallbackQuery();
    return;
  }

  // Handle reactions (existing functionality)
  if (callbackData === "react_like" || callbackData === "react_dislike") {
    const currentReactions = ensureMessageReactionEntry(messageId);

    // Update reaction state
    if (callbackData === "react_like") {
      if (currentReactions.likes.has(userId)) {
        currentReactions.likes.delete(userId); // Unlike
      } else {
        currentReactions.likes.add(userId);
        currentReactions.dislikes.delete(userId); // Remove from dislikes if switching
      }
    } else if (callbackData === "react_dislike") {
      if (currentReactions.dislikes.has(userId)) {
        currentReactions.dislikes.delete(userId); // Un-dislike
      } else {
        currentReactions.dislikes.add(userId);
        currentReactions.likes.delete(userId); // Remove from likes if switching
      }
    }

    // Generate new button texts
    const likesText = "❤️" + (currentReactions.likes.size > 0 ? ": " : "") +
                      [...currentReactions.likes].map(id => USER_EMOJIS[id as USER_IDS] || '❓').join("");
    const dislikesText = "💔" + (currentReactions.dislikes.size > 0 ? ": " : "") +
                         [...currentReactions.dislikes].map(id => USER_EMOJIS[id as USER_IDS] || '❓').join("");

    // Update the keyboard
    try {
      await ctx.editMessageReplyMarkup({
        reply_markup: {
          inline_keyboard: [
            [
              { text: likesText, callback_data: "react_like" },
              { text: dislikesText, callback_data: "react_dislike" }
            ]
          ]
        }
      });
    } catch (error) {
      console.error("Error editing message reply markup:", error);
    }

    await ctx.answerCallbackQuery();
    return;
  }

  // Unknown callback data
  await ctx.answerCallbackQuery();
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
