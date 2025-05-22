import debug from "debug";
import { Bot } from "grammy";
import { handleTiktokDownload } from "./tiktok-handler";

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
