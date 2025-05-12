// This file is only used for local development
import debug from "debug";
import { Bot, InputFile } from "grammy";
import { downloadTiktok, getBufferFromURL, filterVideo, filterAudio } from "./download-tiktok";

const debugLog = debug("bot:dev");

// Initialize the bot
const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is unset");

// Create bot instance
const bot = new Bot(token);

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
    loadingMsg = await ctx.reply("⏳ Завантажую відео...");

    // Extract the link from the message text
    const link = text.match(tiktokPattern)?.[0];

    if (!link) {
      if (loadingMsg) {
        await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
      }
      return;
    }

    // Get video info using our custom implementation
    const videoInfo = await downloadTiktok(link);

    // Check if we have proper response structure
    if (videoInfo.error) {
      throw new Error(videoInfo.error);
    }

    if (!videoInfo.medias || !Array.isArray(videoInfo.medias) || videoInfo.medias.length === 0) {
      throw new Error("Invalid response format or no media available");
    }

    // Filter for videos with audio
    const videos = filterVideo(videoInfo.medias);

    // Filter for images (look for media with "image" in the quality field)
    const images = videoInfo.medias.filter(m =>
      m.quality.startsWith('image-') ||
      (!m.videoAvailable && !m.audioAvailable)
    );

    // Filter for audio-only media
    const audios = filterAudio(videoInfo.medias);

    // Try to find non-watermarked video (higher quality)
    const nonWatermarkedVideos = videos.filter(v => v.quality === "hd");
    const bestVideo = nonWatermarkedVideos.length > 0 ? nonWatermarkedVideos[0] : videos[0];

    // Check if we have a slideshow of images
    if (images.length > 0) {
      try {
        // Download up to 10 images (Telegram media group limit)
        const imagePromises = images.slice(0, 10).map(async (image, idx) => {
          const buffer = await getBufferFromURL(image.url);
          return new InputFile(buffer);
        });

        const imageFiles = await Promise.all(imagePromises);

        // Create a media group of photos
        const mediaGroup = imageFiles.map((file, index) => ({
          type: "photo" as const,
          media: file,
          caption: index === 0 ? `🖼 ${videoInfo.title}` : undefined
        }));

        await ctx.replyWithMediaGroup(mediaGroup);

        // If there's audio, send it separately
        if (audios.length > 0) {
          const audioBuffer = await getBufferFromURL(audios[0].url);
          await ctx.replyWithAudio(new InputFile(audioBuffer), {
            title: videoInfo.title,
          });
        }
      } catch (mediaError) {
        console.error("Error processing image slideshow:", mediaError);
        // Fallback to sending just the first image if media group fails
        if (images.length > 0) {
          const buffer = await getBufferFromURL(images[0].url);
          await ctx.replyWithPhoto(new InputFile(buffer), {
            caption: `🖼 ${videoInfo.title}`
          });

          // If there's audio, still try to send it
          if (audios.length > 0) {
            const audioBuffer = await getBufferFromURL(audios[0].url);
            await ctx.replyWithAudio(new InputFile(audioBuffer), {
              title: videoInfo.title,
            });
          }
        } else {
          throw new Error("Failed to process image slideshow");
        }
      }
    } else if (videos.length > 0 && bestVideo) {
      // Get the video buffer
      const videoBuffer = await getBufferFromURL(bestVideo.url);

      await ctx.replyWithVideo(new InputFile(videoBuffer), {
        caption: `🎥 ${videoInfo.title}`,
      });
    } else if (audios.length > 0) {
      // Get the audio buffer
      const audioBuffer = await getBufferFromURL(audios[0].url);

      await ctx.replyWithAudio(new InputFile(audioBuffer), {
        title: videoInfo.title,
      });
    } else {
      throw new Error("No suitable media found");
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

// Start the bot
debugLog("Bot is starting in development mode...");
bot.start({
  onStart: (botInfo) => {
    debugLog(`Bot @${botInfo.username} started in development mode!`);
  },
});

// Setup graceful stop
process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());
