export enum USER_IDS {
  KARRTOPELKA = 'karrtopelka',
  DAR4YK = 'dar4yk',
  NODROGELO = 'nodrogelo',
  SPLASHESS = 'splashess',
  V_ULFF = 'V_Ulff'
}

export const USER_EMOJIS: Record<USER_IDS, string> = {
  [USER_IDS.KARRTOPELKA]: '🏳‍🌈',
  [USER_IDS.DAR4YK]: '🐒',
  [USER_IDS.NODROGELO]: '🗿',
  [USER_IDS.SPLASHESS]: '👨‍🦽',
  [USER_IDS.V_ULFF]: '🔳'
};

export const MAX_REACTION_ENTRIES = 500;
export const MAX_POLL_ENTRIES = 500;
export const MAX_DATABASE_POLLS = 500;

export const messageReactions = new Map<number, { likes: Set<string>, dislikes: Set<string> }>();
export const pollVotes = new Map<number, { optionA: Set<string>, optionB: Set<string> }>();

export const initialReplyMarkup = {
  inline_keyboard: [
    [
      { text: "❤️", callback_data: "react_like" },
      { text: "💔", callback_data: "react_dislike" },
    ],
  ],
};

export const SPINNER_EMOJIS = ['⢿', '⣻', '⣽', '⣾', '⣷', '⣯', '⣟', '⡿']
