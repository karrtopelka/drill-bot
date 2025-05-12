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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.tiktok.com/',
        'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        ...(init?.headers || {})
      };

      return fetch(url, { ...init, headers });
    };

    global.fetch = customFetch as typeof fetch;

    let response;
    let errors = [];
    let resultAny = null;

    // Method 1: Try using the library
    try {
      // Try different API versions if one fails
      // Try v1 first
      try {
        logDebug("Trying TikTok API v1");
        response = await Downloader(videoUrl, {
          version: "v1",
          showOriginalResponse: false
        });
        if (response.status === "success" && response.result) {
          logDebug("TikTok API v1 succeeded");
          resultAny = response.result as any;
        } else {
          errors.push(`v1: ${response.message || "Unknown error"}`);
          throw new Error("v1 failed");
        }
      } catch (error) {
        // Try v2 if v1 fails
        logDebug("TikTok API v1 failed, trying v2");
        try {
          response = await Downloader(videoUrl, {
            version: "v2",
            showOriginalResponse: false
          });

          if (response.status === "success" && response.result) {
            logDebug("TikTok API v2 succeeded");
            resultAny = response.result as any;
          } else {
            errors.push(`v2: ${response.message || "Unknown error"}`);
            throw new Error("v2 failed");
          }
        } catch (error) {
          // Try v3 as last resort
          logDebug("TikTok API v2 failed, trying v3");
          try {
            response = await Downloader(videoUrl, {
              version: "v3",
              showOriginalResponse: false
            });

            if (response.status === "success" && response.result) {
              logDebug("TikTok API v3 succeeded");
              resultAny = response.result as any;
            } else {
              errors.push(`v3: ${response.message || "Unknown error"}`);
              throw new Error("All API versions failed");
            }
          } catch (error) {
            // All library versions failed
            throw new Error(`All TikTok API versions failed: ${errors.join(", ")}`);
          }
        }
      }
    } catch (libraryError) {
      // Method 2: Try direct approach if library method failed
      logDebug("All library methods failed, trying direct approach");
      try {
        // Try to get the HTML directly and extract the video URL
        const directResult = await extractTikTokDirectLink(videoUrl);
        if (directResult) {
          logDebug("Direct approach succeeded");
          resultAny = directResult;
        } else {
          throw new Error("Could not extract video information directly");
        }
      } catch (directError) {
        // If both methods fail, throw the original library error
        throw libraryError;
      }
    }

    if (!resultAny) {
      return {
        error: "Failed to extract any video information",
        url: videoUrl,
        title: "Unknown Title",
        thumbnail: "",
        duration: "",
        source: "tiktok",
        medias: []
      };
    }

    // Map the response to our TiktokVideo interface
    const media: Media[] = [];

    // We need to use type assertions due to different API versions having different response formats
    // First, add video content
    if (resultAny.video) {
      // Handle v1 format
      const playAddr = Array.isArray(resultAny.video.playAddr)
        ? resultAny.video.playAddr[0]
        : resultAny.video.playAddr || "";

      if (playAddr) {
        media.push({
          url: playAddr,
          quality: "hd",
          extension: "mp4",
          size: 0,
          formattedSize: "Unknown",
          videoAvailable: true,
          audioAvailable: true,
          chunked: false,
          cached: false
        });
      }

      // Add watermarked version if available
      if (resultAny.video.downloadAddr && Array.isArray(resultAny.video.downloadAddr) && resultAny.video.downloadAddr[0]) {
        media.push({
          url: resultAny.video.downloadAddr[0],
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
    } else if (resultAny.videoHD || resultAny.videoWatermark) {
      // Handle v2/v3 format
      if (resultAny.videoHD) {
        media.push({
          url: resultAny.videoHD,
          quality: "hd",
          extension: "mp4",
          size: 0,
          formattedSize: "Unknown",
          videoAvailable: true,
          audioAvailable: true,
          chunked: false,
          cached: false
        });
      }

      if (resultAny.videoWatermark) {
        media.push({
          url: resultAny.videoWatermark,
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
    } else if (resultAny.directUrl) {
      // Handle our direct extraction method
      media.push({
        url: resultAny.directUrl,
        quality: "hd",
        extension: "mp4",
        size: 0,
        formattedSize: "Unknown",
        videoAvailable: true,
        audioAvailable: true,
        chunked: false,
        cached: false
      });
    }

    // Add images if available
    if (resultAny.images && Array.isArray(resultAny.images) && resultAny.images.length > 0) {
      resultAny.images.forEach((image: string, index: number) => {
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
    if (resultAny.music) {
      let musicUrl = null;

      if (typeof resultAny.music === 'string') {
        musicUrl = resultAny.music;
      } else if (resultAny.music.playUrl) {
        if (Array.isArray(resultAny.music.playUrl) && resultAny.music.playUrl.length > 0) {
          musicUrl = resultAny.music.playUrl[0];
        } else {
          musicUrl = resultAny.music.playUrl;
        }
      }

      if (musicUrl) {
        media.push({
          url: musicUrl,
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
    }

    // Get title from the appropriate field based on API version
    const title = resultAny.description || resultAny.desc || resultAny.title || "Unknown Title";

    // Get thumbnail from the appropriate field
    let thumbnail = resultAny.thumbnail || "";
    if (!thumbnail) {
      if (Array.isArray(resultAny.cover) && resultAny.cover.length > 0) {
        thumbnail = resultAny.cover[0];
      } else if (resultAny.video && resultAny.video.cover) {
        if (Array.isArray(resultAny.video.cover) && resultAny.video.cover.length > 0) {
          thumbnail = resultAny.video.cover[0];
        } else {
          thumbnail = resultAny.video.cover;
        }
      }
    }

    // Get duration
    const duration = resultAny.duration || (resultAny.video && resultAny.video.duration
      ? String(resultAny.video.duration)
      : "0");

    return {
      url: videoUrl,
      title,
      thumbnail,
      duration,
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
 * Attempts to extract a direct no-watermark link from a TikTok URL
 * @param videoUrl The TikTok video URL
 * @returns Promise with the extracted information or null if failed
 */
async function extractTikTokDirectLink(videoUrl: string): Promise<any | null> {
  try {
    logDebug(`Attempting direct extraction for: ${videoUrl}`);

    // Custom headers that mimic a real browser
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Upgrade-Insecure-Requests': '1'
    };

    // First get the HTML content
    const response = await fetch(videoUrl, { headers });
    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Try to extract the video URL from the HTML
    let directUrl = null;
    let title = null;
    let thumbnail = null;

    // Look for the JSON data in the HTML
    const dataMatch = html.match(/<script id="SIGI_STATE" type="application\/json">(.*?)<\/script>/s);
    if (dataMatch && dataMatch[1]) {
      try {
        const jsonData = JSON.parse(dataMatch[1]);

        // Extract video data from various possible locations in the JSON
        if (jsonData.ItemModule) {
          const itemKey = Object.keys(jsonData.ItemModule)[0];
          if (itemKey) {
            const item = jsonData.ItemModule[itemKey];

            // Extract title
            title = item.desc || "";

            // Extract thumbnail
            if (item.video && item.video.cover) {
              thumbnail = item.video.cover;
            }

            // Extract video URL
            if (item.video && item.video.playAddr) {
              directUrl = item.video.playAddr;
            }
          }
        }

        // Try alternate paths if first method didn't work
        if (!directUrl && jsonData.ItemList && jsonData.ItemList.video) {
          directUrl = jsonData.ItemList.video.playAddr;
        }

        if (!directUrl && jsonData.videoData && jsonData.videoData.itemInfos) {
          const video = jsonData.videoData.itemInfos.video;
          if (video && video.urls && video.urls.length > 0) {
            directUrl = video.urls[0];
          }
        }
      } catch (e) {
        logDebug(`Error parsing JSON data: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (!directUrl) {
      // Try regex extraction as fallback
      const urlMatch = html.match(/video":\{"url":"([^"]+)"/);
      if (urlMatch && urlMatch[1]) {
        directUrl = urlMatch[1].replace(/\\u002F/g, '/');
      }
    }

    if (directUrl) {
      logDebug(`Successfully extracted direct URL: ${directUrl.substring(0, 50)}...`);
      return {
        directUrl,
        title,
        thumbnail
      };
    }

    return null;
  } catch (error) {
    logDebug(`Error during direct extraction: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Try to download from a TikTok URL through a specialized TikTok proxy
 * @param url The TikTok URL to fetch
 * @returns Response from the proxy
 */
async function fetchThroughTikTokProxy(url: string): Promise<Response> {
  // List of TikTok proxy services to try
  const proxyServices = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://proxy.snigdhaos.org/?url=${encodeURIComponent(url)}`
  ];

  // Try each proxy service until one works
  let lastError: Error | null = null;

  for (const proxyUrl of proxyServices) {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'video/webm,video/mp4,video/*;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      };

      logDebug(`Trying proxy: ${proxyUrl.substring(0, 50)}...`);
      const response = await fetch(proxyUrl, { headers });

      if (response.ok) {
        logDebug(`Successfully fetched through proxy: ${proxyUrl.substring(0, 50)}...`);
        return response;
      }

      lastError = new Error(`Proxy ${proxyUrl.substring(0, 30)}... responded with ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('All TikTok proxies failed');
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
  let useTikTokProxy = false;

  const isTikTokMediaUrl = fileUrl.includes('tiktokcdn.com') ||
                          fileUrl.includes('tiktok.com') ||
                          fileUrl.includes('muscdn.com') ||
                          fileUrl.includes('musical.ly');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Add a small delay between retries, except for first attempt
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));

        // Try with simple proxy on second attempt
        if (attempt === 1) {
          useProxy = true;
        }

        // Try with TikTok-specific proxy on third attempt
        if (attempt === 2 && isTikTokMediaUrl) {
          useTikTokProxy = true;
        }
      }

      let response;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'video/webm,video/mp4,video/*;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.tiktok.com/',
        'Origin': 'https://www.tiktok.com'
      };

      if (useTikTokProxy) {
        logDebug(`Attempting fetch via TikTok proxy for: ${fileUrl.substring(0, 50)}...`);
        response = await fetchThroughTikTokProxy(fileUrl);
      } else if (useProxy) {
        logDebug(`Attempting fetch via general proxy for: ${fileUrl.substring(0, 50)}...`);
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(fileUrl)}`;
        response = await fetch(proxyUrl, {
          headers: {
            ...headers,
            'Origin': 'https://allorigins.win',
            'Referer': 'https://allorigins.win/'
          }
        });
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
          logDebug(`Retry attempt ${attempt + 1}/${retries} for URL: ${fileUrl.substring(0, 50)}... - Error: ${error.message}`);
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
