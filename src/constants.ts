export const USER_EMOJIS: Record<string, string> = {
  'karrtopelka': '🦄',
  'dar4yk': '🐒',
  'ohordon': '🐳',
  'splashess': '👾',
  'V_Ulff': '🧌'
};

export const MAX_REACTION_ENTRIES = 500;

export const messageReactions = new Map<number, { likes: Set<string>, dislikes: Set<string> }>();

export const initialReplyMarkup = {
  inline_keyboard: [
    [
      { text: "❤️", callback_data: "react_like" },
      { text: "💔", callback_data: "react_dislike" },
    ],
  ],
};
