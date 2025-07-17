import { MAX_POLL_ENTRIES, MAX_REACTION_ENTRIES, messageReactions, pollVotes } from './constants';

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

export function getPollVotes(messageId: number) {
  return pollVotes.get(messageId);
}

export function ensurePollVoteEntry(messageId: number): { optionA: Set<string>, optionB: Set<string> } {
  if (!pollVotes.has(messageId)) {
    if (pollVotes.size >= MAX_POLL_ENTRIES) {
      const oldestKey = pollVotes.keys().next().value;
      if (oldestKey !== undefined) {
        pollVotes.delete(oldestKey);
      }
    }
    pollVotes.set(messageId, { optionA: new Set(), optionB: new Set() });
  }
  return pollVotes.get(messageId)!;
}
