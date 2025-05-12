import { Bot, Context, webhookCallback, InputFile } from "grammy";
import { downloadTiktok, filterImages, getAudioTrack, getBestVideoNoWatermark, getBufferFromURL } from "./download-tiktok";
import debug from "debug";

const debugLog = debug("bot:main");

// Helper function to detect if running in Vercel environment
function isVercelEnvironment(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

// Custom logger with environment prefix
function logInfo(message: string): void {
  const prefix = isVercelEnvironment() ? '[VERCEL]' : '[LOCAL]';
  console.log(`${prefix} ${message}`);
  debugLog(message);
}

function logError(message: string, error?: unknown): void {
  const prefix = isVercelEnvironment() ? '[VERCEL ERROR]' : '[LOCAL ERROR]';
  console.error(`${prefix} ${message}`);

  if (error) {
    if (error instanceof Error) {
      console.error(`${prefix} Details: ${error.message}`);
      if (error.stack) {
        console.error(`${prefix} Stack: ${error.stack}`);
      }
    } else {
      console.error(`${prefix} Unknown error details:`, error);
    }
  }

  debugLog(`ERROR: ${message}`);
}

// Initialize the bot
const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is unset");

// Create bot instance
const bot = new Bot(token);

// About command
bot.command("about", async (ctx: Context) => {
  const message = `*DRILL BOT*`;
  logInfo(`Triggered "about" command with message \n${message}`);
  await ctx.reply(message, { parse_mode: "MarkdownV2" });
});

// Handle TikTok links in messages
bot.on("message:text", async (ctx: Context) => {
  const text = ctx.message?.text;
  if (!text) return;

  // Check if message contains TikTok link
  const tiktokPattern = /(https?:\/\/)?(www\.)?(vm\.tiktok\.com|tiktok\.com)\/\S+/i;
  if (!tiktokPattern.test(text)) return;

  logInfo("Detected TikTok link: " + text);

  let loadingMsg;
  try {
    // Send loading message
    loadingMsg = await ctx.reply("⏳ Завантажую відео...");

    // Extract the link from the message text
    const link = text.match(tiktokPattern)?.[0];

    if (!link) {
      if (loadingMsg) {
        await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
      }
      return;
    }

    logInfo(`Processing TikTok link: ${link}`);

    // Get video info using our custom implementation
    const videoInfo = await downloadTiktok(link);

    // Check if we have proper response structure
    if (videoInfo.error) {
      throw new Error(videoInfo.error);
    }

    if (!videoInfo.medias || !Array.isArray(videoInfo.medias) || videoInfo.medias.length === 0) {
      throw new Error("Invalid response format or no media available");
    }

    logInfo(`Successfully fetched TikTok data with ${videoInfo.medias.length} media items`);

    const caption = `${videoInfo.title || '📷'} | @${videoInfo.authorNickname || 'Хтось'}`;

    // Filter for images (look for media with "image" in the quality field)
    const images = filterImages(videoInfo.medias);
    const audioTrack = getAudioTrack(videoInfo.medias);

    if (images.length > 0 && audioTrack) {
      // This is likely a slideshow
      debugLog(`Handling as slideshow: ${images.length} images, audio found.`);
      // 1. Download all image buffers
      const imageBuffers = await Promise.all(images.map(img => getBufferFromURL(img.url)));
      // 2. Download audio buffer
      const audioBuffer = await getBufferFromURL(audioTrack.url);
      // 3. Send images as a media group with caption
      const imageFiles = imageBuffers.map(imageBuffer => new InputFile(imageBuffer))
      const mediaGroup = imageFiles.map((file, index) => ({
        type: "photo" as const,
        media: file,
        caption: index === 0 ? caption : undefined
      }));
      await ctx.replyWithMediaGroup(mediaGroup);
      // 4. Send audio separately with caption (or try to attach to media group
      //    if API allows)
      await ctx.replyWithAudio(new InputFile(audioBuffer), {
        title: videoInfo.title,
      });
    } else {
      // This is likely a video post
      const video = getBestVideoNoWatermark(videoInfo.medias);
      if (video) {
        debugLog(`Handling as video: ${video.url}`);
        const videoBuffer = await getBufferFromURL(video.url);
        // Send videoBuffer with caption
        await ctx.replyWithVideo(new InputFile(videoBuffer), {
          caption: caption,
        });
      } else {
        logError("No suitable non-watermarked video found, or no video at all.");
        // Potentially try sending the first available media if any, or an error.
        // This case might happen if only audio was returned (like your previous log)
        // or only watermarked video.
        if (audioTrack && videoInfo.medias.length === 1) { // If only audio was found.
          debugLog(`Handling as audio-only post: ${audioTrack.url}`);
          const audioBuffer = await getBufferFromURL(audioTrack.url);
          // Send audioBuffer with caption
          await ctx.replyWithAudio(new InputFile(audioBuffer), {
            title: videoInfo.title,
          });
        } else {
          throw new Error("No suitable media found");
        }
      }
    }

    // Cleanup
    if (loadingMsg) {
      await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
    }
  } catch (error) {
    logError("Error downloading TikTok video", error);
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
  logInfo("Bot is running in development mode");

  // Start the bot using long polling for development
  bot.start().then(() => {
    logInfo("Bot started in development mode");
  }).catch((err: Error) => {
    logError("Failed to start bot", err);
  });
}

// Export the webhook handler for Vercel
export default webhookCallback(bot, "https");
