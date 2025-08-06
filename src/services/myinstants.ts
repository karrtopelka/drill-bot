import decodeAudio from 'audio-decode';
import debug from 'debug';

const debugLog = debug('bot:myinstants');

export interface MyInstantsSound {
  name: string;
  url: string;
  playUrl: string;
  oggUrl?: string; // Will contain the converted OGG URL
  duration?: number; // Duration in seconds
}

class MyInstantsService {
  private readonly baseUrl = 'https://www.myinstants.com';
  private readonly userAgent = 'DrillBot/1.0';

  async searchSounds(query: string): Promise<MyInstantsSound[]> {
    try {
      debugLog(`Searching MyInstants for: ${query}`);

      const searchUrl = `${this.baseUrl}/en/search/?name=${encodeURIComponent(query)}`;
      debugLog(`Search URL: ${searchUrl}`);

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        // Add timeout to fetch request
        signal: AbortSignal.timeout(2500) // 2.5 second timeout
      });

      if (!response.ok) {
        throw new Error(`MyInstants HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      debugLog(`Received HTML response, length: ${html.length}`);

      return this.parseSearchResults(html);
    } catch (error) {
      console.error('MyInstants search error:', error);
      debugLog(`Search failed for query: ${query}`);
      return [];
    }
  }

    private parseSearchResults(html: string): MyInstantsSound[] {
    const sounds: MyInstantsSound[] = [];

    try {
      // Look for the actual pattern used by MyInstants
      // Pattern: <button class="small-button" onclick="play('/media/sounds/file.mp3', ...)" title="Play SOUND_NAME sound" ...></button>
      const buttonRegex = /<button[^>]*class="small-button"[^>]*onclick="play\('([^']+)'[^>]*title="Play ([^"]*?) sound"[^>]*><\/button>/gi;

      let match;
      const seen = new Set<string>();

      while ((match = buttonRegex.exec(html)) !== null && sounds.length < 10) {
        const soundPath = match[1];
        const soundName = match[2];

        if (!soundPath || seen.has(soundPath)) continue;
        seen.add(soundPath);

        // Clean up the sound name
        const cleanName = soundName.trim();

        if (cleanName && cleanName.length > 0) {
          // Construct full URLs
          const fullSoundUrl = soundPath.startsWith('http')
            ? soundPath
            : `${this.baseUrl}${soundPath.startsWith('/') ? soundPath : '/' + soundPath}`;

          sounds.push({
            name: cleanName,
            url: `${this.baseUrl}/instant/${encodeURIComponent(cleanName.toLowerCase().replace(/\s+/g, '-'))}/`,
            playUrl: fullSoundUrl
          });
        }
      }

      // Alternative parsing - look for instant link names if button parsing fails
      if (sounds.length === 0) {
        debugLog('Button parsing failed, trying link-based parsing');

        // Pattern: <a href="/en/instant/..." class="instant-link link-secondary">SOUND_NAME</a>
        const linkRegex = /<a[^>]*href="[^"]*\/instant\/[^"]*"[^>]*class="instant-link[^"]*">([^<]+)<\/a>/gi;
        let linkMatch;

        while ((linkMatch = linkRegex.exec(html)) !== null && sounds.length < 10) {
          const soundName = linkMatch[1].trim();

          if (soundName && soundName.length > 0 && !seen.has(soundName)) {
            seen.add(soundName);

            // Try to find the corresponding play() call for this sound
            const playPattern = new RegExp(`onclick="play\\('([^']+)'[^>]*title="[^"]*${soundName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"`, 'i');
            const playMatch = html.match(playPattern);

            if (playMatch) {
              const soundPath = playMatch[1];
              const fullSoundUrl = soundPath.startsWith('http')
                ? soundPath
                : `${this.baseUrl}${soundPath.startsWith('/') ? soundPath : '/' + soundPath}`;

              sounds.push({
                name: soundName,
                url: `${this.baseUrl}/instant/${encodeURIComponent(soundName.toLowerCase().replace(/\s+/g, '-'))}/`,
                playUrl: fullSoundUrl
              });
            }
          }
        }
      }

      // Final fallback - extract play() calls and match with nearby text
      if (sounds.length === 0) {
        debugLog('Link parsing failed, trying fallback method');

        // Find all play() calls
        const playRegex = /onclick="play\('([^']+)'/g;
        const playMatches = [...html.matchAll(playRegex)];

        for (const playMatch of playMatches) {
          if (sounds.length >= 10) break;

          const soundPath = playMatch[1];
          if (seen.has(soundPath)) continue;

          // Look for title attribute near this play call
          const contextStart = Math.max(0, playMatch.index! - 200);
          const contextEnd = Math.min(html.length, playMatch.index! + 200);
          const context = html.substring(contextStart, contextEnd);

          const titleMatch = context.match(/title="Play ([^"]*?) sound"/i);
          if (titleMatch) {
            const soundName = titleMatch[1].trim();
            if (soundName && soundName.length > 0) {
              seen.add(soundPath);

              const fullSoundUrl = soundPath.startsWith('http')
                ? soundPath
                : `${this.baseUrl}${soundPath.startsWith('/') ? soundPath : '/' + soundPath}`;

              sounds.push({
                name: soundName,
                url: `${this.baseUrl}/instant/${encodeURIComponent(soundName.toLowerCase().replace(/\s+/g, '-'))}/`,
                playUrl: fullSoundUrl
              });
            }
          }
        }
      }

      debugLog(`Parsed ${sounds.length} sounds from HTML`);
      return sounds;

    } catch (error) {
      console.error('Error parsing MyInstants HTML:', error);
      debugLog('HTML parsing failed');
      return [];
    }
  }



  async getSoundBuffer(soundUrl: string): Promise<Buffer> {
    try {
      debugLog(`Downloading sound from: ${soundUrl}`);

      const response = await fetch(soundUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Referer': this.baseUrl
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download sound: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      debugLog(`Downloaded sound buffer, size: ${buffer.length} bytes`);
      return buffer;

    } catch (error) {
      console.error('Error downloading sound:', error);
      throw error;
    }
  }

  async getSoundAsVoice(soundUrl: string): Promise<{ buffer: Buffer; duration: number }> {
    try {
      debugLog(`Downloading sound for voice message: ${soundUrl}`);

      // Download the original audio
      const originalBuffer = await this.getSoundBuffer(soundUrl);

      // Decode audio to get real duration
      let realDuration = 1; // Default fallback
      try {
        debugLog('Decoding audio to get duration...');
        const audioBuffer = await decodeAudio(originalBuffer);
        realDuration = Math.ceil(audioBuffer.duration) || 1;
        debugLog(`Real audio duration: ${realDuration}s`);
      } catch (decodeError) {
        debugLog('Failed to decode audio, using fallback estimation');
        // Fallback to rough estimation if decode fails
        realDuration = Math.ceil(originalBuffer.length / 16000) || 1;
      }

      debugLog(`Final duration: ${realDuration}s`);
      return {
        buffer: originalBuffer,
        duration: realDuration
      };

    } catch (error) {
      console.error('Error preparing sound as voice:', error);
      throw error;
    }
  }

  // Helper method to get file extension from URL
  getFileExtension(url: string): string {
    try {
      const urlPath = new URL(url).pathname;
      const extension = urlPath.split('.').pop()?.toLowerCase();
      return extension && ['mp3', 'wav', 'ogg', 'mp4', 'm4a'].includes(extension) ? extension : 'mp3';
    } catch {
      return 'mp3';
    }
  }
}

export const myInstantsService = new MyInstantsService();
