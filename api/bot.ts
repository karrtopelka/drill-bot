import { Bot, Context, webhookCallback } from "grammy";
// <reference path="../src/types/ruhend-scraper.d.ts" />
import { ttdl } from "ruhend-scraper";
import debug from "debug";

const debugLog = debug("bot:main");

// Initialize the bot
const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is unset");

// Create bot instance
const bot = new Bot(token);

// Check if a URL is audio
const isAudio = async (url: string) => {
  const response = await fetch(url);
  const contentType = response.headers.get("content-type");
  return contentType?.includes("audio");
};

// About command
bot.command("about", async (ctx: Context) => {
  const message = `*DRILL BOT*`;
  debugLog(`Triggered "about" command with message \n${message}`);
  await ctx.reply(message, { parse_mode: "MarkdownV2" });
});

// Handle TikTok links in messages
bot.on("message:text", async (ctx: Context) => {
  const text = ctx.message?.text;
  if (!text) return;

  // Check if message contains TikTok link
  if (!text.includes("vm.tiktok.com")) return;

  debugLog("Detected TikTok link");

  let loadingMsg;
  try {
    // Send loading message
    loadingMsg = await ctx.reply("⏳ Завантажую відео...");

    // Extract the link from the message text
    const link = text.match(/https?:\/\/vm\.tiktok\.com\/\w+/)?.[0];

    if (!link) {
      if (loadingMsg) {
        await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
      }
      return;
    }

    // Get video info and download URL
    const videoInfo = await ttdl(link);

    if (!videoInfo || !videoInfo.video) {
      throw new Error("Could not get download URL");
    }

    const isAudioFile = await isAudio(videoInfo.video);

    if (isAudioFile) {
      await ctx.replyWithAudio(videoInfo.video, {
        title: videoInfo.title,
        performer: videoInfo.author,
      });
    } else {
      await ctx.replyWithVideo(videoInfo.video, {
        caption: `🎥 ${videoInfo.title} | ${videoInfo.author}`,
      });
    }

    // Cleanup
    if (loadingMsg) {
      await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
    }
  } catch (error) {
    console.error("Error downloading TikTok video:", error);
    if (loadingMsg) {
      await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
    }
    const errorMsg = await ctx.reply("❌ Помилка при завантаженні відео");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await ctx.api.deleteMessage(ctx.chat!.id, errorMsg.message_id);
  }
});

// We need to handle development mode differently
if (process.env.NODE_ENV !== "production") {
  debugLog("Bot is running in development mode");

  // Start the bot using long polling for development
  bot.start().then(() => {
    debugLog("Bot started in development mode");
  }).catch((err: Error) => {
    console.error("Failed to start bot:", err);
  });
}

// Export the webhook handler for Vercel
export default webhookCallback(bot, "https");
