import { Action, AgentType, type AgentResponse, type KeyTerm, type LectureTopic } from "../types";
import { KeywordGenerator } from "./keyword-generator";

/**
 * Agent responsible for detecting academic key terms in transcripts
 */
export class KeyTermDetector {
  private keywordGenerator: KeywordGenerator;
  private currentTopic: LectureTopic | null = null;
  private currentKeywords: string[] = [];
  private academicPatterns = [
    // Computer Science
    { pattern: /machine learning/gi, category: "AI/ML" },
    { pattern: /artificial intelligence/gi, category: "AI/ML" },
    { pattern: /neural network/gi, category: "AI/ML" },
    { pattern: /deep learning/gi, category: "AI/ML" },
    { pattern: /supervised learning/gi, category: "AI/ML" },
    { pattern: /unsupervised learning/gi, category: "AI/ML" },
    { pattern: /reinforcement learning/gi, category: "AI/ML" },
    { pattern: /gradient descent/gi, category: "AI/ML" },
    { pattern: /overfitting/gi, category: "AI/ML" },
    { pattern: /cross-validation/gi, category: "AI/ML" },

    // Programming
    { pattern: /algorithm/gi, category: "Programming" },
    { pattern: /data structure/gi, category: "Programming" },
    { pattern: /recursion/gi, category: "Programming" },
    { pattern: /polymorphism/gi, category: "Programming" },
    { pattern: /encapsulation/gi, category: "Programming" },
    { pattern: /inheritance/gi, category: "Programming" },

    // Mathematics
    { pattern: /calculus/gi, category: "Mathematics" },
    { pattern: /derivative/gi, category: "Mathematics" },
    { pattern: /integral/gi, category: "Mathematics" },
    { pattern: /linear algebra/gi, category: "Mathematics" },
    { pattern: /matrix/gi, category: "Mathematics" },
    { pattern: /eigenvalue/gi, category: "Mathematics" },

    // General Academic
    { pattern: /hypothesis/gi, category: "Academic" },
    { pattern: /methodology/gi, category: "Academic" },
    { pattern: /paradigm/gi, category: "Academic" },
    { pattern: /empirical/gi, category: "Academic" },
    { pattern: /theoretical/gi, category: "Academic" },
  ];

  constructor() {
    this.keywordGenerator = new KeywordGenerator();
  }

  /**
   * Set the current lecture topic and generate keywords
   */
  async setTopic(topic: LectureTopic): Promise<void> {
    this.currentTopic = topic;
    
    try {
      this.currentKeywords = await this.keywordGenerator.generateKeywords(topic);
      console.log(`Loaded ${this.currentKeywords.length} keywords for topic: ${topic.subject} - ${topic.subtopic}`);
    } catch (error) {
      console.error('Error loading keywords for topic:', error);
      this.currentKeywords = [];
    }
  }

  /**
   * Detect key terms in transcript text
   */
  async detectKeyTerms(text: string, timestamp: number): Promise<KeyTerm[]> {
    const detectedTerms: KeyTerm[] = [];

    // First, check for topic-specific keywords
    if (this.currentKeywords.length > 0) {
      const topicTerms = await this.detectTopicSpecificTerms(text, timestamp);
      detectedTerms.push(...topicTerms);
    }

    // Then, check for general academic patterns
    for (const { pattern, category } of this.academicPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const term = this.normalizeTermText(match);

          // Avoid duplicates
          if (
            !detectedTerms.some(
              (t) => t.term.toLowerCase() === term.toLowerCase()
            )
          ) {
            const keyTerm = await this.createKeyTerm(
              term,
              text,
              timestamp,
              category
            );
            if (keyTerm) {
              detectedTerms.push(keyTerm);
            }
          }
        }
      }
    }

    // Sort by confidence score
    return detectedTerms.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect topic-specific terms from generated keywords
   */
  private async detectTopicSpecificTerms(text: string, timestamp: number): Promise<KeyTerm[]> {
    const detectedTerms: KeyTerm[] = [];
    const normalizedText = text.toLowerCase();

    for (const keyword of this.currentKeywords) {
      // Check for exact matches
      if (normalizedText.includes(keyword.toLowerCase())) {
        const keyTerm = await this.createKeyTerm(
          keyword,
          text,
          timestamp,
          this.currentTopic ? `${this.currentTopic.subject} - ${this.currentTopic.subtopic}` : 'Topic-specific'
        );
        if (keyTerm) {
          detectedTerms.push(keyTerm);
        }
      } else {
        // Check for partial matches (for multi-word terms)
        const keywordWords = keyword.toLowerCase().split(/\s+/);
        if (keywordWords.length > 1) {
          const matchedWords = keywordWords.filter(word => normalizedText.includes(word));
          if (matchedWords.length >= Math.ceil(keywordWords.length * 0.7)) { // 70% word match
            const keyTerm = await this.createKeyTerm(
              keyword,
              text,
              timestamp,
              this.currentTopic ? `${this.currentTopic.subject} - ${this.currentTopic.subtopic}` : 'Topic-specific',
              0.7 // Lower confidence for partial matches
            );
            if (keyTerm) {
              detectedTerms.push(keyTerm);
            }
          }
        }
      }
    }

    return detectedTerms;
  }

  /**
   * Create a key term object with context
   */
  private async createKeyTerm(
    term: string,
    fullText: string,
    timestamp: number,
    category: string,
    baseConfidence?: number
  ): Promise<KeyTerm | null> {
    const context = this.extractContext(term, fullText);
    const confidence = baseConfidence || this.calculateConfidence(term, fullText, context);

    // Only return terms with sufficient confidence
    if (confidence < 0.6) {
      return null;
    }

    return {
      term: this.capitalizeWords(term),
      definition: "", // Will be filled by DefinitionProvider
      confidence,
      timestamp: new Date(timestamp),
      context,
      category,
    };
  }

  /**
   * Extract context around a term
   */
  private extractContext(term: string, text: string): string {
    const termIndex = text.toLowerCase().indexOf(term.toLowerCase());
    if (termIndex === -1) return text.substring(0, 100);

    const contextStart = Math.max(0, termIndex - 50);
    const contextEnd = Math.min(text.length, termIndex + term.length + 50);

    return text.substring(contextStart, contextEnd).trim();
  }

  /**
   * Calculate confidence score for a term
   */
  private calculateConfidence(
    term: string,
    text: string,
    context: string
  ): number {
    let confidence = 0.7; // Base confidence

    // Boost confidence if term appears in academic context
    const academicContext =
      /\b(define|definition|refers to|means|concept|theory|principle)\b/i;
    if (academicContext.test(context)) {
      confidence += 0.2;
    }

    // Boost confidence if term appears multiple times
    const termCount = (
      text.toLowerCase().match(new RegExp(term.toLowerCase(), "g")) || []
    ).length;
    if (termCount > 1) {
      confidence += Math.min(0.1 * (termCount - 1), 0.2);
    }

    // Boost confidence for longer, more specific terms
    if (term.split(" ").length > 1) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Normalize term text
   */
  private normalizeTermText(text: string): string {
    return text.toLowerCase().trim();
  }

  /**
   * Capitalize words for display
   */
  private capitalizeWords(str: string): string {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Check if a term should be highlighted based on current context
   */
  shouldHighlightTerm(term: string, recentTerms: KeyTerm[]): boolean {
    // Don't highlight if we've shown this term recently
    const recentTermNames = recentTerms.map((t) => t.term.toLowerCase());
    if (recentTermNames.includes(term.toLowerCase())) {
      return false;
    }

    return true;
  }
}
