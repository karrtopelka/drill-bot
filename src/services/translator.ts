import debug from 'debug';

const debugLog = debug('bot:translator');

export interface TranslationResult {
  text: string;
  from: string;
  to: string;
}

interface LibreTranslateResponse {
  translatedText: string;
}

interface MyMemoryResponse {
  responseData: {
    translatedText: string;
  };
}

class TranslationService {
  private readonly libreTranslateUrl = 'https://libretranslate.de/translate';
  private readonly myMemoryUrl = 'https://api.mymemory.translated.net/get';

  private async translateWithLibreTranslate(text: string, from: string, to: string): Promise<string> {
    try {
      const response = await fetch(this.libreTranslateUrl, {
        method: 'POST',
        body: JSON.stringify({
          q: text,
          source: from,
          target: to,
          format: 'text'
        }),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DrillBot/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`LibreTranslate HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const htmlText = await response.text();
        debugLog(`LibreTranslate returned HTML instead of JSON: ${htmlText.substring(0, 100)}`);
        throw new Error('LibreTranslate returned HTML instead of JSON - likely rate limited');
      }

      const result: LibreTranslateResponse = await response.json();
      return result.translatedText;
    } catch (error) {
      debugLog('LibreTranslate failed:', error);
      throw error;
    }
  }

  private async translateWithMyMemory(text: string, from: string, to: string): Promise<string> {
    try {
      const url = `${this.myMemoryUrl}?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DrillBot/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`MyMemory HTTP ${response.status}: ${response.statusText}`);
      }

      const result: MyMemoryResponse = await response.json();
      return result.responseData.translatedText;
    } catch (error) {
      debugLog('MyMemory failed:', error);
      throw error;
    }
  }

  private async translateText(text: string, from: string, to: string): Promise<string> {
    // Try LibreTranslate first
    try {
      debugLog('Trying LibreTranslate...');
      return await this.translateWithLibreTranslate(text, from, to);
    } catch (error) {
      debugLog('LibreTranslate failed, trying MyMemory fallback...');

      // Fallback to MyMemory
      try {
        return await this.translateWithMyMemory(text, from, to);
      } catch (fallbackError) {
        debugLog('Both translation services failed');
        throw new Error(`Translation failed: LibreTranslate and MyMemory both unavailable`);
      }
    }
  }

  async translateToUkrainian(text: string): Promise<string> {
    try {
      debugLog(`Translating text: ${text.substring(0, 50)}...`);

      const translatedText = await this.translateText(text, 'en', 'uk');

      debugLog(`Translation successful: ${translatedText.substring(0, 50)}...`);
      return translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      debugLog(`Translation failed for text: ${text}`);

      // Return original text if translation fails
      return text;
    }
  }

  async translatePoll(question: string, option1: string, option2: string): Promise<{
    question: string;
    option1: string;
    option2: string;
  }> {
    try {
      debugLog('Translating poll to Ukrainian');

      // Translate all parts simultaneously for efficiency
      const [translatedQuestion, translatedOption1, translatedOption2] = await Promise.all([
        this.translateToUkrainian(question),
        this.translateToUkrainian(option1),
        this.translateToUkrainian(option2)
      ]);

      return {
        question: translatedQuestion,
        option1: translatedOption1,
        option2: translatedOption2
      };
    } catch (error) {
      console.error('Poll translation error:', error);
      debugLog('Poll translation failed, returning original text');

      // Return original text if translation fails
      return {
        question,
        option1,
        option2
      };
    }
  }

  async isTextInUkrainian(text: string): Promise<boolean> {
    try {
      // Simple check for Ukrainian characters
      const ukrainianPattern = /[\u0400-\u04FF]/;
      return ukrainianPattern.test(text);
    } catch (error) {
      debugLog('Language detection failed:', error);
      return false;
    }
  }
}

export const translationService = new TranslationService();
