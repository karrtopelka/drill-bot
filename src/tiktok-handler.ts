import { Context } from "grammy";
import { downloadTiktok, getBufferFromURL, filterVideo, filterAudio } from "./download-tiktok";
import { InputFile } from "grammy";
import { initialReplyMarkup, SPINNER_EMOJIS } from './constants';

let spinnerIndex = 0;

const getNextSpinnerEmoji = () => {
  const emoji = SPINNER_EMOJIS[spinnerIndex];
  spinnerIndex = (spinnerIndex + 1) % SPINNER_EMOJIS.length;
  return emoji;
}


export async function handleTiktokDownload(ctx: Context, link: string, loadingMsg: any) {
  try {
    // Get video info using our custom implementation
    const videoInfo = await downloadTiktok(link);
    await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, `📓 Отримання метаданих... (20%)\n${getNextSpinnerEmoji()}⬜️⬜️⬜️⬜️`);

    // Check if we have proper response structure
    if (videoInfo.error) {
      throw new Error(videoInfo.error);
    }

    if (!videoInfo.medias || !Array.isArray(videoInfo.medias) || videoInfo.medias.length === 0) {
      throw new Error("Invalid response format or no media available");
    }
    await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, `🔍 Пошук найкращого відеопотоку... (40%)\n🟩🟩${getNextSpinnerEmoji()}⬜️⬜️`);

    // Filter for videos with audio
    const videos = filterVideo(videoInfo.medias);
    await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, `📥 Завантаження відеофайлу... (60%)\n🟩🟩🟩${getNextSpinnerEmoji()}⬜️`);

    // Filter for images (look for media with "image" in the quality field)
    const images = videoInfo.medias.filter(m =>
      m.quality.startsWith('image-') ||
      (!m.videoAvailable && !m.audioAvailable)
    );
    await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, `🎨 Перевірка на слайдшоу... (80%)\n🟩🟩🟩🟩${getNextSpinnerEmoji()}⬜️`);

    // Filter for audio-only media
    const audios = filterAudio(videoInfo.medias);
    await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, `🎉 Відео завантажено! (100%). Готую до відправки...\n🟩🟩🟩🟩🟩`);

    // Try to find non-watermarked video (higher quality)
    const nonWatermarkedVideos = videos.filter(v => v.quality === "hd");
    const bestVideo = nonWatermarkedVideos.length > 0 ? nonWatermarkedVideos[0] : videos[0];

    // Get user info and message text for caption
    const user = ctx.from;
    const messageText = ctx.message?.text || "";

    // Check if message contains only the TikTok link
    const isOnlyLink = messageText.trim().match(/^(https?:\/\/)?(www\.)?(vm\.tiktok\.com|tiktok\.com)\/\S+$/i);

    let caption;
    if (isOnlyLink) {
      // If only link, just show username and TikTok
      caption = user
        ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}: [TikTok](${link})`
        : `[TikTok](${link})`;
    } else {
      // If there's additional text, keep it as is but replace the link with TikTok
      const cleanMessageText = messageText
        .replace(/(https?:\/\/)?(www\.)?(vm\.tiktok\.com|tiktok\.com)\/\S+/i, `[TikTok](${link})`)
        .trim();
      caption = user
        ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}: ${cleanMessageText}`
        : cleanMessageText;
    }

    // Check if we have a slideshow of images
    if (images.length > 0) {
      await handleImageSlideshow(ctx, images, audios, caption);
    } else if (videos.length > 0 && bestVideo) {
      await handleVideo(ctx, bestVideo, caption);
    } else if (audios.length > 0) {
      await handleAudio(ctx, audios[0], caption);
    } else {
      throw new Error("No suitable media found");
    }

    // Delete original message
    if (ctx.message?.message_id) {
      await ctx.api.deleteMessage(ctx.chat!.id, ctx.message.message_id);
    }

    // Cleanup loading message
    if (loadingMsg) {
      await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
    }
  } catch (error) {
    console.error("Error downloading TikTok video:", error);
    if (loadingMsg) {
      await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
    }
    const errorMsg = await ctx.reply("❌ Помилка при завантаженні відео", {
      link_preview_options: { is_disabled: true }
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await ctx.api.deleteMessage(ctx.chat!.id, errorMsg.message_id);
  }
}

async function handleImageSlideshow(ctx: Context, images: any[], audios: any[], caption: string) {
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
    }));

    await ctx.replyWithMediaGroup(mediaGroup);

    // Send caption as a separate message
    await ctx.reply(caption, {
      parse_mode: "MarkdownV2",
      reply_markup: initialReplyMarkup,
      link_preview_options: { is_disabled: true }
    });

    // If there's audio, send it separately
    if (audios.length > 0) {
      const audioBuffer = await getBufferFromURL(audios[0].url);
      await ctx.replyWithAudio(new InputFile(audioBuffer), {
        title: 'Звук'
      });
    }
  } catch (mediaError) {
    console.error("Error processing image slideshow:", mediaError);
    // Fallback to sending just the first image if media group fails
    if (images.length > 0) {
      const buffer = await getBufferFromURL(images[0].url);
      await ctx.replyWithPhoto(new InputFile(buffer));
      // Send caption and fallback message as a separate message
      await ctx.reply(caption + '\n(Не вийшло завантажити всі зображення, тикайте на лінку)', {
        parse_mode: "MarkdownV2",
        reply_markup: initialReplyMarkup,
        link_preview_options: { is_disabled: true }
      });

      // If there's audio, still try to send it
      if (audios.length > 0) {
        const audioBuffer = await getBufferFromURL(audios[0].url);
        await ctx.replyWithAudio(new InputFile(audioBuffer), {
          title: 'Звук',
          parse_mode: "MarkdownV2"
        });
      }
    } else {
      throw new Error("Failed to process image slideshow");
    }
  }
}

async function handleVideo(ctx: Context, video: any, caption: string) {
  const videoBuffer = await getBufferFromURL(video.url);
  await ctx.replyWithVideo(new InputFile(videoBuffer), {
    caption: caption,
    parse_mode: "MarkdownV2",
    reply_markup: initialReplyMarkup,
  });
}

async function handleAudio(ctx: Context, audio: any, caption: string) {
  const audioBuffer = await getBufferFromURL(audio.url);
  await ctx.replyWithAudio(new InputFile(audioBuffer), {
    title: 'Звук',
    parse_mode: "MarkdownV2",
    reply_markup: initialReplyMarkup
  });
}
