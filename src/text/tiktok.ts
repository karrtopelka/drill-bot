/// <reference path="../types/ruhend-scraper.d.ts" />
import { ttdl } from 'ruhend-scraper';
import { Context, Input } from 'telegraf';
import { message } from 'telegraf/filters';
import createDebug from 'debug';

const debug = createDebug('bot:tiktok');

const isAudio = async (url: string) => {
  const response = await fetch(url);
  const contentType = response.headers.get('content-type');
  return contentType?.includes('audio');
};

export const handleTikTokLink = () => async (ctx: Context) => {
  if (!ctx.has(message('text'))) return;

  const text = ctx.message.text;

  // Check if message contains TikTok link
  if (!text.includes('vm.tiktok.com')) return;

  debug('Detected TikTok link');

  let loadingMsg;
  try {
    // Send loading message
    loadingMsg = await ctx.reply('⏳ Завантажую відео...');

    // if message contains more than link, like other text, we have to extract
    // the link
    const link = text.match(/https?:\/\/vm\.tiktok\.com\/\w+/)?.[0];

    if (!link) {
      if (loadingMsg) {
        await ctx.deleteMessage(loadingMsg.message_id);
      }
      return;
    }

    // Get video info and download URL
    const videoInfo = await ttdl(link);

    if (!videoInfo || !videoInfo.video) {
      throw new Error('Could not get download URL');
    }

    const isAudioFile = await isAudio(videoInfo.video);

    if (isAudioFile) {
      await ctx.replyWithAudio(Input.fromURL(videoInfo.video), {
        title: videoInfo.title,
        performer: videoInfo.author,
      });
    } else {
      await ctx.replyWithVideo(Input.fromURL(videoInfo.video), {
        caption: `🎥 ${videoInfo.title} | ${videoInfo.author}`,
      });
    }

    // Cleanup
    if (loadingMsg) {
      await ctx.deleteMessage(loadingMsg.message_id);
    }
  } catch (error) {
    console.error('Error downloading TikTok video:', error);
    if (loadingMsg) {
      await ctx.deleteMessage(loadingMsg.message_id);
    }
    const errorMsg = await ctx.reply('❌ Помилка при завантаженні відео');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await ctx.deleteMessage(errorMsg.message_id);
  }
};
