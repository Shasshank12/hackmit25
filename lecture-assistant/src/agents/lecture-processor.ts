import {
  Action,
  AgentType,
  type Conversation,
  type AgentResponse,
  type TranscriptSegment,
} from "../types";
import { KEY_TERMS_HISTORY_LENGTH, TRANSCRIPT_BUFFER_LENGTH } from "../config";

/**
 * Main lecture processing agent that coordinates transcript analysis
 */
export class LectureProcessor {
  private conversation: Conversation = [];

  /**
   * Process a new transcript segment
   */
  async processTranscript(
    text: string,
    timestamp: number
  ): Promise<AgentResponse> {
    // Add transcript to conversation
    const transcriptSegment: TranscriptSegment = {
      type: "transcript",
      text,
      timestamp,
    };

    this.conversation.push(transcriptSegment);

    // Analyze if we should extract key terms from this segment
    const shouldExtractKeyTerms = this.shouldExtractKeyTerms(text);

    if (shouldExtractKeyTerms) {
      return {
        type: Action.PROCESS,
        reasoning:
          "Transcript contains academic content that should be analyzed for key terms",
        timestamp,
        payload: {
          transcript: text,
          extractKeyTerms: true,
        },
      };
    }

    // Check if we should show live captions
    if (this.shouldShowCaptions(text)) {
      return {
        type: Action.SHOW_CAPTION,
        reasoning: "Showing live captions for ongoing lecture",
        timestamp,
        output: this.formatCaptionText(text),
        metadata: {
          agentType: AgentType.CaptionManager,
        },
      };
    }

    return {
      type: Action.SILENT,
      reasoning: "No action needed for this transcript segment",
      timestamp,
    };
  }

  /**
   * Determine if transcript should be analyzed for key terms
   */
  private shouldExtractKeyTerms(text: string): boolean {
    // Look for academic indicators
    const academicIndicators = [
      // Technical terms
      /\b(algorithm|function|variable|class|method|interface)\b/i,
      // Academic language
      /\b(therefore|however|furthermore|moreover|consequently)\b/i,
      // Definitions
      /\b(is defined as|refers to|means that|can be described as)\b/i,
      // Complex concepts
      /\b(machine learning|artificial intelligence|neural network|deep learning)\b/i,
      // Mathematical terms
      /\b(equation|formula|calculate|derivative|integral|matrix)\b/i,
    ];

    return academicIndicators.some((pattern) => pattern.test(text));
  }

  /**
   * Determine if we should show live captions
   */
  private shouldShowCaptions(text: string): boolean {
    // Show captions for substantial content (more than just filler words)
    const fillerWords = /^(um|uh|er|ah|well|so|like|you know)$/i;
    const words = text.trim().split(/\s+/);

    // Don't show captions for single filler words
    if (words.length === 1 && fillerWords.test(words[0])) {
      return false;
    }

    // Show captions for meaningful content
    return text.trim().length > 10;
  }

  /**
   * Format text for caption display
   */
  private formatCaptionText(text: string): string {
    // Get recent transcript context (last 50 words)
    const recentTranscripts = this.conversation
      .filter((item) => item.type === "transcript")
      .slice(-5); // Last 5 segments

    const contextText = recentTranscripts
      .map((segment) => (segment as TranscriptSegment).text)
      .join(" ");

    const words = contextText.split(/\s+/);
    const recentWords = words.slice(-50).join(" ");

    return recentWords;
  }

  /**
   * Get current conversation for debugging
   */
  getConversation(): Conversation {
    return [...this.conversation];
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.conversation = [];
  }

  /**
   * Trim conversation to prevent memory issues
   */
  private trimConversation(): void {
    const maxLength = TRANSCRIPT_BUFFER_LENGTH + KEY_TERMS_HISTORY_LENGTH;
    if (this.conversation.length > maxLength) {
      this.conversation = this.conversation.slice(-maxLength);
    }
  }
}
