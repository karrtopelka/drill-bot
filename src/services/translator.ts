import { translate } from '@vitalets/google-translate-api';
import debug from 'debug';

const debugLog = debug('bot:translator');

export interface TranslationResult {
  text: string;
  from: string;
  to: string;
}

class TranslationService {
  async translateToUkrainian(text: string): Promise<string> {
    try {
      debugLog(`Translating text: ${text.substring(0, 50)}...`);

      const result = await translate(text, { from: 'en', to: 'uk' });

      debugLog(`Translation successful: ${result.text.substring(0, 50)}...`);
      return result.text;
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
