import { Downloader } from '@tobyg74/tiktok-api-dl';
import { Buffer } from 'buffer';

/**
 * Detect if running in Vercel environment
 * @returns {boolean} True if running in Vercel
 */
function isVercelEnvironment(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

/**
 * Logs with prefix based on environment
 * @param {string} message - Message to log
 */
function logDebug(message: string): void {
  const prefix = isVercelEnvironment() ? '[VERCEL]' : '[LOCAL]';
  console.log(`${prefix} ${message}`);
}

/**
 * Represents a media file.
 */
export interface Media {
  /** The URL of the media file. */
  url: string;
  /** The quality of the media file (e.g., "hd", "sd", "watermark", "128kbps"). */
  quality: string;
  /** The file extension of the media file (e.g., "mp4", "mp3"). */
  extension: string;
  /** The size of the media file in bytes. */
  size: number;
  /** The formatted size of the media file (e.g., "8.62 MB", "242.57 KB"). */
  formattedSize: string;
  /** Whether the media file contains video. */
  videoAvailable: boolean;
  /** Whether the media file contains audio. */
  audioAvailable: boolean;
  /** Whether the media file is chunked. */
  chunked: boolean;
  /** Whether the media file is cached. */
  cached: boolean;
}

/**
 * Represents the structure of a TikTok video data response.
 */
export interface TiktokVideo {
  /** The error message, if any. Can be null. */
  error?: string | null;
  /** The URL of the video. */
  url: string;
  /** The title of the video. */
  title: string;
  /** The URL of the video thumbnail. */
  thumbnail: string;
  /** The duration of the video (e.g., "00:15"). */
  duration: string;
  /** The source of the video (e.g., "tiktok"). */
  source: string;
  /** An array of media files associated with the video. */
  medias: Media[];
  /** The session ID associated with the video. Can be null. */
  sid?: string | null;
}

/**
 * Downloads TikTok video information from the API.
 * @public
 * @example
 * // Receives a response from the server
 * const result = await downloadTiktok(url);
 * @param {string} videoUrl - The URL of the TikTok video.
 * @returns {Promise<TiktokVideo>} - A promise that resolves to the TikTok video data.
 * @throws {Error} - If an error occurs during the API request or processing.
 */
export async function downloadTiktok(videoUrl: string): Promise<TiktokVideo> {
  // Replace global fetch temporarily
  const originalFetch = global.fetch;

  try {
    // Add a custom fetch implementation with headers
    const customFetch = async (url: string, init?: RequestInit) => {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.tiktok.com/',
        'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        ...(init?.headers || {})
      };

      return fetch(url, { ...init, headers });
    };

    global.fetch = customFetch as typeof fetch;

    const response = await Downloader(videoUrl, {
      version: "v1",
      showOriginalResponse: false
    });

    if (response.status !== "success" || !response.result) {
      return {
        error: response.message || "Download failed",
        url: videoUrl,
        title: "Unknown Title",
        thumbnail: "",
        duration: "",
        source: "tiktok",
        medias: []
      };
    }

    // Map the response to our TiktokVideo interface
    const result = response.result;
    const media: Media[] = [];

    // Add video
    if (result.video) {
      media.push({
        url: Array.isArray(result.video.playAddr) ? result.video.playAddr[0] : result.video.playAddr || "",
        quality: "hd",
        extension: "mp4",
        size: 0,
        formattedSize: "Unknown",
        videoAvailable: true,
        audioAvailable: true,
        chunked: false,
        cached: false
      });

      // Add watermarked version if available
      if (result.video.downloadAddr && result.video.downloadAddr[0]) {
        media.push({
          url: result.video.downloadAddr[0],
          quality: "watermark",
          extension: "mp4",
          size: 0,
          formattedSize: "Unknown",
          videoAvailable: true,
          audioAvailable: true,
          chunked: false,
          cached: false
        });
      }
    }

    // Add images if available
    if (result.images && result.images.length > 0) {
      result.images.forEach((image, index) => {
        media.push({
          url: image,
          quality: `image-${index + 1}`,
          extension: "jpeg",
          size: 0,
          formattedSize: "Unknown",
          videoAvailable: false,
          audioAvailable: false,
          chunked: false,
          cached: false
        });
      });
    }

    // Add music
    if (result.music && result.music.playUrl && result.music.playUrl.length > 0) {
      media.push({
        url: result.music.playUrl[0],
        quality: "128kbps",
        extension: "mp3",
        size: 0,
        formattedSize: "Unknown",
        videoAvailable: false,
        audioAvailable: true,
        chunked: false,
        cached: false
      });
    }

    return {
      url: videoUrl,
      title: result.description || "Unknown Title",
      thumbnail: result.cover?.[0] || result.video?.cover?.[0] || "",
      duration: result.video?.duration ? String(result.video.duration) : "0",
      source: "tiktok",
      medias: media
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        error: `An error occurred in downloadTiktok: ${error.message}`,
        url: videoUrl,
        title: "Error",
        thumbnail: "",
        duration: "",
        source: "tiktok",
        medias: []
      };
    }
    return {
      error: `An unknown error occurred in downloadTiktok: ${String(error)}`,
      url: videoUrl,
      title: "Error",
      thumbnail: "",
      duration: "",
      source: "tiktok",
      medias: []
    };
  } finally {
    // Always restore original fetch even if there's an error
    global.fetch = originalFetch;
  }
}

/**
 * Attempts to fetch a URL through a proxy service when direct access fails.
 * @param {string} url - The URL to fetch through proxy.
 * @param {RequestInit} [init] - Optional fetch initialization options.
 * @returns {Promise<Response>} The fetch response from the proxy.
 */
async function fetchThroughProxy(url: string, init?: RequestInit): Promise<Response> {
  // Use allOrigins as a proxy service
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

  // Combine original headers with proxy-specific ones
  const headers = {
    ...(init?.headers || {}),
    'Origin': 'https://allorigins.win',
    'Referer': 'https://allorigins.win/'
  };

  return fetch(proxyUrl, { ...init, headers });
}

/**
 * Get the buffer from a URL.
 * @public
 * @example
 * // Receives a response from the server
 * const result = await downloadTiktok(url);
 * // Get the buffer
 * const buffer = await getBufferFromURL(result.medias[0].url);
 * @param {string} fileUrl - The URL to fetch the buffer from.
 * @param {number} [retries=3] - Number of retry attempts for the request.
 * @param {number} [delay=1000] - Delay between retries in milliseconds.
 * @returns {Promise<Buffer>} - A promise that resolves to the buffer of the file.
 * @throws {Error} - If an error occurs during fetching or buffer conversion.
 */
export async function getBufferFromURL(fileUrl: string, retries = 3, delay = 1000): Promise<Buffer> {
  let lastError: Error | null = null;
  let useProxy = false;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Add a small delay between retries, except for first attempt
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));

        // Try with proxy on second attempt
        if (attempt === 1) {
          useProxy = true;
        }
      }

      let response;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'video/webm,video/mp4,video/*;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.tiktok.com/',
        'Origin': 'https://www.tiktok.com'
      };

      if (useProxy) {
        logDebug(`Attempting fetch via proxy for: ${fileUrl}`);
        response = await fetchThroughProxy(fileUrl, { headers });
      } else {
        response = await fetch(fileUrl, { headers });
      }

      if (!response.ok) {
        let errorBodyText = 'Unknown error structure';
        try {
          errorBodyText = await response.text();
        } catch (textError) {
          // Ignore if can't read body
        }
        throw new Error(`Failed to fetch buffer with status ${response.status}: ${errorBodyText}`);
      }

      const arrayBuffer: ArrayBuffer = await response.arrayBuffer();
      const buffer: Buffer = Buffer.from(arrayBuffer);

      return buffer;
    } catch (error: unknown) {
      if (error instanceof Error) {
        lastError = error;
        // Log retry attempt if not the last one
        if (attempt < retries) {
          logDebug(`Retry attempt ${attempt + 1}/${retries} for URL: ${fileUrl} - Error: ${error.message}`);
        }
      } else {
        lastError = new Error(`Unknown error: ${String(error)}`);
      }
    }
  }

  // If we got here, all retries failed
  if (lastError) {
    throw new Error(`Failed after ${retries} retries: ${lastError.message}`);
  } else {
    throw new Error(`Failed after ${retries} retries due to unknown error`);
  }
}

/**
 * Finds the best quality media file within a specified size limit.
 * "Best" is determined by the largest size that is still within the limit.
 * @public
 * @example
 * // Receives a response from the server
 * const result = await downloadTiktok(url);
 * // Get the best content in a limited size
 * // 50 * 1024 * 1024 is 52428800 bytes or 50 megabytes
 * const bestMedia = getBestMediaWithinLimit(result.medias, 50 * 1024 * 1024);
 * @param {Media[]} medias - An array of media files.
 * @param {number} limitedSizeBytes - The maximum allowed size in bytes.
 * @returns {Media | null} - The best media file, or null if no suitable media is found.
 */
export function getBestMediaWithinLimit(medias: Media[], limitedSizeBytes: number): Media | null {
  const suitableMedias = medias
    .filter(media => media.size <= limitedSizeBytes)
    .sort((a, b) => b.size - a.size); // Sort by size descending

  return suitableMedias[0] || null; // Return the largest one, or null if array is empty
}

/**
 * Filters out media files that contain a watermark.
 * @public
 * @example
 * // Receives a response from the server
 * const result = await downloadTiktok(url);
 * // Get videos without watermark
 * const noWatermarkMedias = filterNoWatermark(result.medias);
 * @param {Media[]} medias - An array of media files.
 * @returns {Media[]} - An array of media files without watermarks.
 */
export function filterNoWatermark(medias: Media[]): Media[] {
  return medias.filter(media => media.quality !== 'watermark');
}

/**
 * Filters for media files that contain both video and audio.
 * @public
 * @example
 * // Receives a response from the server
 * const result = await downloadTiktok(url);
 * // Get videos (with audio)
 * const videos = filterVideo(result.medias);
 * @param {Media[]} medias - An array of media files.
 * @returns {Media[]} - An array of media files that are videos with audio.
 */
export function filterVideo(medias: Media[]): Media[] {
  return medias.filter(media => media.videoAvailable && media.audioAvailable);
}

/**
 * Filters for media files that contain only audio.
 * @public
 * @example
 * // Receives a response from the server
 * const result = await downloadTiktok(url);
 * // Get audios
 * const audios = filterAudio(result.medias);
 * @param {Media[]} medias - An array of media files.
 * @returns {Media[]} - An array of media files that are audio-only.
 */
export function filterAudio(medias: Media[]): Media[] {
  return medias.filter(media => !media.videoAvailable && media.audioAvailable);
}
