import { MAX_REACTION_ENTRIES,messageReactions } from './constants';

export function getReactions(messageId: number) {
  return messageReactions.get(messageId);
}

export function ensureMessageReactionEntry(messageId: number): { likes: Set<string>, dislikes: Set<string> } {
  if (!messageReactions.has(messageId)) {
    if (messageReactions.size >= MAX_REACTION_ENTRIES) {
      const oldestKey = messageReactions.keys().next().value;
      if (oldestKey !== undefined) {
        messageReactions.delete(oldestKey);
      }
    }
    messageReactions.set(messageId, { likes: new Set(), dislikes: new Set() });
  }
  return messageReactions.get(messageId)!;
}
