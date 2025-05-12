import { Bot, Context, webhookCallback, InputFile } from "grammy";
import { downloadTiktok, getBufferFromURL, filterVideo, filterAudio } from "./download-tiktok";
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

    // Filter for videos with audio
    const videos = filterVideo(videoInfo.medias);

    // Filter for images (look for media with "image" in the quality field)
    const images = videoInfo.medias.filter(m =>
      m.quality.startsWith('image-') ||
      (!m.videoAvailable && !m.audioAvailable)
    );

    // Filter for audio-only media
    const audios = filterAudio(videoInfo.medias);

    logInfo(`Media breakdown - Videos: ${videos.length}, Images: ${images.length}, Audio: ${audios.length}`);

    // Try to find non-watermarked video (higher quality)
    const nonWatermarkedVideos = videos.filter(v => v.quality === "hd");
    const bestVideo = nonWatermarkedVideos.length > 0 ? nonWatermarkedVideos[0] : videos[0];

    // Check if we have a slideshow of images
    if (images.length > 0) {
      try {
        logInfo(`Processing ${images.length} images from TikTok`);
        // Download up to 10 images (Telegram media group limit)
        const imagePromises = images.slice(0, 10).map(async (image, idx) => {
          logInfo(`Downloading image ${idx + 1} from: ${image.url.substring(0, 100)}...`);
          const buffer = await getBufferFromURL(image.url);
          return new InputFile(buffer);
        });

        const imageFiles = await Promise.all(imagePromises);
        logInfo(`Successfully downloaded ${imageFiles.length} images`);

        // Create a media group of photos
        const mediaGroup = imageFiles.map((file, index) => ({
          type: "photo" as const,
          media: file,
          caption: index === 0 ? `🖼 ${videoInfo.title}` : undefined
        }));

        await ctx.replyWithMediaGroup(mediaGroup);
        logInfo("Successfully sent image media group");

        // If there's audio, send it separately
        if (audios.length > 0) {
          logInfo(`Downloading audio from: ${audios[0].url.substring(0, 100)}...`);
          const audioBuffer = await getBufferFromURL(audios[0].url);
          await ctx.replyWithAudio(new InputFile(audioBuffer), {
            title: videoInfo.title,
          });
          logInfo("Successfully sent audio");
        }
      } catch (mediaError) {
        logError("Error processing image slideshow", mediaError);
        // Fallback to sending just the first image if media group fails
        if (images.length > 0) {
          logInfo("Falling back to single image mode");
          const buffer = await getBufferFromURL(images[0].url);
          await ctx.replyWithPhoto(new InputFile(buffer), {
            caption: `🖼 ${videoInfo.title}`
          });
          logInfo("Successfully sent fallback image");

          // If there's audio, still try to send it
          if (audios.length > 0) {
            logInfo("Attempting to send audio after fallback image");
            const audioBuffer = await getBufferFromURL(audios[0].url);
            await ctx.replyWithAudio(new InputFile(audioBuffer), {
              title: videoInfo.title,
            });
            logInfo("Successfully sent audio after fallback");
          }
        } else {
          throw new Error("Failed to process image slideshow");
        }
      }
    } else if (videos.length > 0 && bestVideo) {
      logInfo(`Downloading video from: ${bestVideo.url.substring(0, 100)}...`);
      // Get the video buffer
      const videoBuffer = await getBufferFromURL(bestVideo.url);
      logInfo("Successfully downloaded video");

      await ctx.replyWithVideo(new InputFile(videoBuffer), {
        caption: `🎥 ${videoInfo.title}`,
      });
      logInfo("Successfully sent video");
    } else if (audios.length > 0) {
      logInfo(`Downloading audio from: ${audios[0].url.substring(0, 100)}...`);
      // Get the audio buffer
      const audioBuffer = await getBufferFromURL(audios[0].url);
      logInfo("Successfully downloaded audio");

      await ctx.replyWithAudio(new InputFile(audioBuffer), {
        title: videoInfo.title,
      });
      logInfo("Successfully sent audio");
    } else {
      throw new Error("No suitable media found");
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
