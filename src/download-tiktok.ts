import { Downloader } from '@tobyg74/tiktok-api-dl';
import { Buffer } from 'buffer';

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
  try {
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
      title: result.desc || "Unknown Title",
      thumbnail: result.video?.cover?.[0] || result.music?.coverLarge?.[0] || "",
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
  }
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
 * @returns {Promise<Buffer>} - A promise that resolves to the buffer of the file.
 * @throws {Error} - If an error occurs during fetching or buffer conversion.
 */
export async function getBufferFromURL(fileUrl: string): Promise<Buffer> {
  try {
    const response = await fetch(fileUrl);

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
      throw new Error(`An error occurred in getBufferFromURL: ${error.message}`);
    }
    throw new Error(`An unknown error occurred in getBufferFromURL: ${String(error)}`);
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
