/**
 * Utility functions for text processing and formatting
 */

/**
 * Truncate text to word limit while preserving sentence integrity
 */
export function truncateToWordLimit(
  text: string,
  maxWords: number = 35
): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;

  let truncated = words.slice(0, maxWords).join(" ");

  // Context-aware sentence detection
  const sentencePattern = /[.!?]["\']?(?=\s+[A-Z]|$)(?<!\b[A-Z][.!?])/g;
  const matches = Array.from(truncated.matchAll(sentencePattern));

  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const endPos = lastMatch.index! + lastMatch[0].length;
    truncated = truncated.substring(0, endPos).trim();
  }

  return truncated;
}

/**
 * Capitalize words in a string
 */
export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Extract context around a term in text
 */
export function extractContext(
  term: string,
  text: string,
  contextLength: number = 50
): string {
  const termIndex = text.toLowerCase().indexOf(term.toLowerCase());
  if (termIndex === -1)
    return text.substring(0, Math.min(contextLength * 2, text.length));

  const contextStart = Math.max(0, termIndex - contextLength);
  const contextEnd = Math.min(
    text.length,
    termIndex + term.length + contextLength
  );

  return text.substring(contextStart, contextEnd).trim();
}

/**
 * Clean and normalize text for processing
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Check if text contains academic language patterns
 */
export function containsAcademicLanguage(text: string): boolean {
  const academicPatterns = [
    /\b(therefore|however|furthermore|moreover|consequently|thus|hence)\b/i,
    /\b(is defined as|refers to|means that|can be described as|is characterized by)\b/i,
    /\b(theory|principle|concept|methodology|paradigm|framework)\b/i,
    /\b(analysis|synthesis|evaluation|comparison|contrast)\b/i,
    /\b(significant|substantial|considerable|notable|remarkable)\b/i,
  ];

  return academicPatterns.some((pattern) => pattern.test(text));
}

/**
 * Extract sentences from text
 */
export function extractSentences(text: string): string[] {
  // Simple sentence splitting - could be enhanced with more sophisticated NLP
  const sentences = text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  return sentences;
}

/**
 * Calculate text similarity score (simple implementation)
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(normalizeText(text1).split(/\s+/));
  const words2 = new Set(normalizeText(text2).split(/\s+/));

  const intersection = new Set([...words1].filter((word) => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Find the best match for a string from a list of targets
 * Replacement for string-similarity package
 */
export function findBestMatch(
  mainString: string,
  targetStrings: string[]
): {
  bestMatch: { target: string; rating: number };
  ratings: Array<{ target: string; rating: number }>;
} {
  const ratings = targetStrings.map((target) => ({
    target,
    rating: calculateTextSimilarity(mainString, target),
  }));

  const bestMatch = ratings.reduce(
    (best, current) => (current.rating > best.rating ? current : best),
    { target: "", rating: 0 }
  );

  return { bestMatch, ratings };
}

/**
 * Format duration in seconds to human-readable format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Generate a simple hash for text (for caching/comparison)
 */
export function generateTextHash(text: string): string {
  let hash = 0;
  if (text.length === 0) return hash.toString();

  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Check if text is likely to be filler/noise
 */
export function isFillerText(text: string): boolean {
  const fillerPatterns = [
    /^(um|uh|er|ah|well|so|like|you know|okay|right)$/i,
    /^(and|but|or|the|a|an|is|are|was|were)$/i,
    /^\s*$/,
  ];

  const normalizedText = text.trim().toLowerCase();

  // Check if it's just filler words
  if (fillerPatterns.some((pattern) => pattern.test(normalizedText))) {
    return true;
  }

  // Check if it's too short to be meaningful
  if (normalizedText.length < 3) {
    return true;
  }

  return false;
}
