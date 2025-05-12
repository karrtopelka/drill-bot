import {
  Downloader,
} from '@tobyg74/tiktok-api-dl';
import { Buffer } from 'buffer';
import { TiktokDownloaderResponse, TiktokAPIResponse, SSSTikResponse, MusicalDownResponse } from './types';

// Helper to detect Vercel environment
function isVercelEnvironment(): boolean {
return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

// Standardized logging functions
function logDebug(message: string): void {
const prefix = isVercelEnvironment() ? '[VERCEL]' : '[LOCAL]';
console.log(`${prefix} ${message}`);
}

function logError(message: string, details?: any): void {
const prefix = isVercelEnvironment() ? '[VERCEL ERROR]' : '[LOCAL ERROR]';
console.error(`${prefix} ${message}`);
if (details) {
  const detailString = details instanceof Error ?
    `Details: ${details.message}${details.stack ? `\nStack: ${details.stack}` : ''}` :
    `Details: ${typeof details === 'object' ? JSON.stringify(details) : String(details)}`;
  console.error(`${prefix} ${detailString}`);
}
}

export interface Media {
url: string;
quality: string;
extension: string;
size: number;
formattedSize: string; // You might need a utility to format bytes to MB/KB
videoAvailable: boolean;
audioAvailable: boolean;
isWatermarked?: boolean; // Added to differentiate
}

export interface TiktokVideo {
error?: string | null;
url: string; // Original TikTok URL
id?: string; // Video ID from API
title: string;
authorNickname?: string;
thumbnail: string;
duration?: number; // in seconds
sourceApiVersion?: "v1" | "v2" | "v3";
medias: Media[];
}

const TIKTOK_API_PROXY_URL = process.env.TIKTOK_API_PROXY_URL || undefined; // For Downloader
const MEDIA_PROXY_URL_TEMPLATE = process.env.MEDIA_PROXY_URL_TEMPLATE || 'https://api.allorigins.win/raw?url={URL}'; // For getBufferFromURL, e.g., 'https://yourproxy.com/fetch?url={URL}' or 'https://api.allorigins.win/raw?url={URL}'

/**
* Downloads TikTok video information using a fallback mechanism through different API versions.
* @param {string} videoUrl - The URL of the TikTok video.
* @returns {Promise<TiktokVideo>} - A promise that resolves to the TikTok video data.
*/
export async function downloadTiktok(originalUrl: string): Promise<TiktokVideo> {
const versionsToTry = ["v1", "v2", "v3"] as const;
let lastError: any = "All API versions failed.";
let authorNickname: string | undefined = undefined; // To store across different response types

for (const version of versionsToTry) {
  logDebug(`Attempting to fetch TikTok data for ${originalUrl} using API ${version}`);
  try {
    const options: { version: typeof version; proxy?: string; showOriginalResponse?: boolean } = {
      version: version,
      showOriginalResponse: false // Set to true for deeper debugging if needed
    };
    if (TIKTOK_API_PROXY_URL) {
      options.proxy = TIKTOK_API_PROXY_URL;
      logDebug(`Using proxy ${TIKTOK_API_PROXY_URL} for API ${version}`);
    }

    const response = await Downloader(originalUrl, options);

    if (response && response.status === "success" && response.result) {
      logDebug(`Successfully fetched data using API ${version}`);
      const medias: Media[] = [];
      let title = "Unknown Title";
      let id: string | undefined = undefined;
      let thumbnail = "";
      let duration: number | undefined = undefined;

      // --- Response Mapping ---
      if (version === "v1") { // TiktokAPIResponse
        const resultData = response.result as TiktokAPIResponse['result'];
        const result = resultData!;
        title = result.description || title;
        id = result.id;
        authorNickname = result.author?.nickname;
        thumbnail = result.cover?.[0] || result.video?.cover?.[0] || "";
        duration = result.video?.duration;

        if (result.video) {
          if (result.video.playAddr?.[0]) {
            medias.push({
              url: result.video.playAddr[0],
              quality: result.video.ratio || "hd_v1_no_watermark",
              extension: "mp4", videoAvailable: true, audioAvailable: true, size: 0, formattedSize: "N/A", isWatermarked: false,
            });
          }
          if (result.video.downloadAddr?.[0]) {
            medias.push({
              url: result.video.downloadAddr[0],
              quality: "v1_watermark",
              extension: "mp4", videoAvailable: true, audioAvailable: true, size: 0, formattedSize: "N/A", isWatermarked: true,
            });
          }
        }
        if (result.images?.length) {
          result.images.forEach((imgUrl, i) => medias.push({
            url: imgUrl, quality: `image_${i + 1}_v1`, extension: "jpeg", videoAvailable: false, audioAvailable: false, size: 0, formattedSize: "N/A"
          }));
        }
        if (result.music?.playUrl?.[0]) {
          medias.push({
            url: result.music.playUrl[0], quality: "audio_v1", extension: "mp3", videoAvailable: false, audioAvailable: true, size: 0, formattedSize: "N/A"
          });
        }
      } else if (version === "v2" && response.result) { // SSSTikResponse
        const resultData = response.result as SSSTikResponse['result'];
        const result = resultData!;
        title = result.desc || title;
        authorNickname = result.author?.nickname;
        thumbnail = result.author?.avatar || ""; // SSSTik uses author avatar as thumbnail

        // `result.direct` is often the non-watermarked video
        if (result.direct && result.type === "video") {
           medias.push({
              url: result.direct, quality: "hd_v2_direct", extension: "mp4", videoAvailable: true, audioAvailable: true, size: 0, formattedSize: "N/A", isWatermarked: false,
           });
        } else if (result.video && result.type === "video") { // Fallback to result.video if direct is not available
           medias.push({ // This might be watermarked, SSSTik doesn't clearly differentiate sometimes
              url: result.video, quality: "sd_v2_video", extension: "mp4", videoAvailable: true, audioAvailable: true, size: 0, formattedSize: "N/A", isWatermarked: undefined, // Unknown if watermarked
           });
        }
        if (result.images?.length) {
          result.images.forEach((imgUrl, i) => medias.push({
            url: imgUrl, quality: `image_${i + 1}_v2`, extension: "jpeg", videoAvailable: false, audioAvailable: false, size: 0, formattedSize: "N/A"
          }));
        }
        if (result.music && (result.type === "music" || result.type === "video" || result.type === "image")) { // Music can accompany video/images
          medias.push({
            url: result.music, quality: "audio_v2", extension: "mp3", videoAvailable: false, audioAvailable: true, size: 0, formattedSize: "N/A"
          });
        }
      } else if (version === "v3" && response.result) { // MusicalDownResponse
        const resultData = response.result as MusicalDownResponse['result'];
        const result = resultData!;
        title = result.desc || title;
        authorNickname = result.author?.nickname;
        thumbnail = result.author?.avatar || ""; // MusicalDown also uses author avatar

        if (result.videoHD) {
          medias.push({
            url: result.videoHD, quality: "hd_v3_no_watermark", extension: "mp4", videoAvailable: true, audioAvailable: true, size: 0, formattedSize: "N/A", isWatermarked: false
          });
        }
        if (result.videoWatermark) {
          medias.push({
            url: result.videoWatermark, quality: "v3_watermark", extension: "mp4", videoAvailable: true, audioAvailable: true, size: 0, formattedSize: "N/A", isWatermarked: true
          });
        }
        if (result.images?.length) {
          result.images.forEach((imgUrl, i) => medias.push({
            url: imgUrl, quality: `image_${i + 1}_v3`, extension: "jpeg", videoAvailable: false, audioAvailable: false, size: 0, formattedSize: "N/A"
          }));
        }
        if (result.music) {
          medias.push({
            url: result.music, quality: "audio_v3", extension: "mp3", videoAvailable: false, audioAvailable: true, size: 0, formattedSize: "N/A"
          });
        }
      }

      if (medias.length === 0) {
          logDebug(`API ${version} succeeded but no media items found for ${originalUrl}. Result: ${JSON.stringify(response.result)}`);
          lastError = `API ${version} provided no media items.`;
          continue; // Try next version
      }

      logDebug(`Successfully parsed ${medias.length} media items using API ${version}. Title: ${title}, Author: ${authorNickname}`);
      return {
        url: originalUrl,
        id,
        title,
        authorNickname,
        thumbnail,
        duration,
        sourceApiVersion: version,
        medias,
      };
    } else {
      logDebug(`API ${version} failed for ${originalUrl}. Status: ${response?.status}, Message: ${response?.message}`);
      lastError = response?.message || `API ${version} call returned no result or error status.`;
    }
  } catch (error) {
    logError(`Critical error when calling API ${version} for ${originalUrl}`, error);
    lastError = error;
  }
}

logError(`All API versions failed for ${originalUrl}. Last error:`, lastError);
return {
  error: typeof lastError === 'string' ? lastError : (lastError instanceof Error ? lastError.message : "Unknown error after trying all API versions."),
  url: originalUrl,
  title: "Error",
  thumbnail: "",
  medias: [],
};
}


/**
* Attempts to fetch a URL, using a proxy if direct access fails or if configured.
* @param {string} url - The URL to fetch.
* @param {RequestInit} [init] - Optional fetch initialization options.
* @param {boolean} forceProxy - Whether to force using the proxy from the start.
* @returns {Promise<Response>} The fetch response.
*/
async function fetchWithProxyFallback(url: string, init?: RequestInit, forceProxy = false): Promise<Response> {
  const fetchUrl = (useProxy: boolean): string => {
      if (useProxy) {
          logDebug(`[Media Fetch] Using proxy for: ${url.substring(0, 100)}`);
          return MEDIA_PROXY_URL_TEMPLATE.replace('{URL}', encodeURIComponent(url));
      }
      return url;
  };

  const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': 'https://www.tiktok.com/', // General referer, might need adjustment
      ...(init?.headers || {}),
  };

  const requestOptions: RequestInit = { ...init, headers };

  if (forceProxy || (isVercelEnvironment() && !TIKTOK_API_PROXY_URL)) { // If in Vercel & no specific API proxy, assume media might need proxy too.
      logDebug(`[Media Fetch] Attempting with proxy first for ${url.substring(0, 100)} (Vercel or forced)`);
      try {
          return await fetch(fetchUrl(true), requestOptions);
      } catch (proxyError) {
          logError(`[Media Fetch] Proxy attempt failed for ${url.substring(0, 100)}`, proxyError);
          // Fallback to direct if proxy fails (should not happen if proxy is primary choice)
          logDebug(`[Media Fetch] Falling back to direct fetch for ${url.substring(0, 100)} after proxy error.`);
          return fetch(fetchUrl(false), requestOptions);
      }
  }

  // Default: try direct, then proxy on failure
  try {
      logDebug(`[Media Fetch] Attempting direct fetch for ${url.substring(0, 100)}`);
      const response = await fetch(fetchUrl(false), requestOptions);
      if (!response.ok) {
          logDebug(`[Media Fetch] Direct fetch failed for ${url.substring(0,100)} with status ${response.status}. Retrying with proxy.`);
          throw new Error(`Direct fetch failed with status ${response.status}`);
      }
      return response;
  } catch (directError) {
      logError(`[Media Fetch] Direct fetch failed for ${url.substring(0, 100)}. Attempting with proxy.`, directError);
      return fetch(fetchUrl(true), requestOptions);
  }
}


/**
* Get the buffer from a media URL with retries and proxy fallback.
* @param {string} fileUrl - The URL to fetch the buffer from.
* @param {number} [retries=1] - Number of retry attempts for the request (total 2 attempts with initial one).
* @param {number} [delay=1000] - Delay between retries in milliseconds.
* @returns {Promise<Buffer>} - A promise that resolves to the buffer of the file.
*/
export async function getBufferFromURL(fileUrl: string, retries = 1, delay = 1000): Promise<Buffer> {
let lastError: Error | null = null;

for (let attempt = 0; attempt <= retries; attempt++) {
  const controller = new AbortController();
  const timeoutDuration = 20000; // 20 seconds timeout for media downloads
  const timeoutId = setTimeout(() => {
      logDebug(`[Media Buffer] Fetch for ${fileUrl.substring(0,100)} timed out on attempt ${attempt + 1}`);
      controller.abort();
  }, timeoutDuration);

  try {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
      logDebug(`[Media Buffer] Retrying (${attempt}/${retries}) fetch for: ${fileUrl.substring(0, 100)}`);
    }

    // Use fetchWithProxyFallback. Force proxy on Vercel for subsequent attempts or if globally preferred.
    // The first attempt (attempt === 0) might try direct first depending on fetchWithProxyFallback's internal logic.
    const forceProxyForMedia = isVercelEnvironment() && attempt > 0;
    logDebug(`[Media Buffer] Attempt ${attempt + 1} for ${fileUrl.substring(0, 100)}. Force proxy: ${forceProxyForMedia}`);

    const response = await fetchWithProxyFallback(fileUrl, { signal: controller.signal }, forceProxyForMedia);
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBodyText = `Status: ${response.status} ${response.statusText}`;
      try {
        const body = await response.text();
        errorBodyText += ` - Body: ${body.substring(0, 200)}`;
      } catch (textError) {/* Ignore */}
      throw new Error(`Failed to fetch media buffer. ${errorBodyText}`);
    }

    const arrayBuffer: ArrayBuffer = await response.arrayBuffer();
    logDebug(`[Media Buffer] Successfully fetched buffer for ${fileUrl.substring(0, 100)}`);
    return Buffer.from(arrayBuffer);

  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      lastError = error;
      logError(`[Media Buffer] Attempt ${attempt + 1} failed for ${fileUrl.substring(0,100)}`, error.message + (error.name === 'AbortError' ? ' (Timeout)' : ''));
    } else {
      lastError = new Error(String(error));
      logError(`[Media Buffer] Attempt ${attempt + 1} failed for ${fileUrl.substring(0,100)} with unknown error`, String(error));
    }
  }
}

const finalMessage = `Failed to get media buffer from ${fileUrl.substring(0,100)} after ${retries + 1} attempts.`;
logError(finalMessage, lastError);
throw lastError || new Error(finalMessage + " An unknown error occurred.");
}


// --- Utility Filters (kept as they are useful for processing media arrays) ---

/**
* Finds the best quality media file that is not watermarked.
* If limitedSizeBytes is provided, it also respects the size limit.
* @param {Media[]} medias - An array of media files.
* @param {number} [limitedSizeBytes] - Optional maximum allowed size in bytes.
* @returns {Media | null} - The best non-watermarked media file, or null.
*/
export function getBestVideoNoWatermark(medias: Media[], limitedSizeBytes?: number): Media | null {
const suitableMedias = medias
  .filter(media => media.videoAvailable && !media.isWatermarked && media.url && (!limitedSizeBytes || media.size <= limitedSizeBytes))
  .sort((a, b) => { // Basic sort: prefer "hd" qualities, then by general quality string length (longer often means more specific/better)
      if (a.quality.includes("hd") && !b.quality.includes("hd")) return -1;
      if (!a.quality.includes("hd") && b.quality.includes("hd")) return 1;
      if (limitedSizeBytes) return b.size - a.size; // If size matters, biggest under limit
      return b.quality.length - a.quality.length;
  });
return suitableMedias[0] || null;
}

/**
* Filters for image media files.
* @param {Media[]} medias - An array of media files.
* @returns {Media[]} - An array of image media files.
*/
export function filterImages(medias: Media[]): Media[] {
return medias.filter(media => media.extension === "jpeg" || media.quality.startsWith("image"));
}

/**
* Filters for the primary audio file (e.g., background music of a slideshow or main audio track).
* @param {Media[]} medias - An array of media files.
* @returns {Media | null} - The main audio track, or null.
*/
export function getAudioTrack(medias: Media[]): Media | null {
// Prioritize audio tracks derived from v1/v2/v3 music properties
const audio = medias.find(media => media.audioAvailable && !media.videoAvailable && media.quality.startsWith("audio_"));
return audio || medias.find(media => media.audioAvailable && !media.videoAvailable) || null; // Broader fallback
}
