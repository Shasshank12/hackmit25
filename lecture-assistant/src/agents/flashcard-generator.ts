import Anthropic from '@anthropic-ai/sdk';
import { Flashcard, FlashcardSet, ProcessedNotes } from '../types';

/**
 * FlashcardGenerator creates flashcards from processed notes using Claude API
 */
export class FlashcardGenerator {
  private anthropic: Anthropic;

  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Generate flashcards from processed notes
   */
  async generateFlashcards(
    notes: ProcessedNotes,
    options: {
      maxCards?: number;
      difficulty?: 'basic' | 'intermediate' | 'advanced';
      includeDefinitions?: boolean;
      includeConceptualQuestions?: boolean;
    } = {}
  ): Promise<FlashcardSet> {
    const {
      maxCards = 20,
      difficulty = 'intermediate',
      includeDefinitions = true,
      includeConceptualQuestions = true,
    } = options;

    try {
      const prompt = this.buildFlashcardPrompt(
        notes,
        maxCards,
        difficulty,
        includeDefinitions,
        includeConceptualQuestions
      );

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        temperature: 0.4,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const response = message.content[0];
      if (response.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      return this.parseFlashcardResponse(response.text, notes);
    } catch (error) {
      throw new Error(`Failed to generate flashcards with Claude: ${error}`);
    }
  }

  /**
   * Generate flashcards directly from transcript text (alternative method)
   */
  async generateFlashcardsFromTranscript(
    transcript: string,
    sourceFile: string,
    options: {
      maxCards?: number;
      difficulty?: 'basic' | 'intermediate' | 'advanced';
    } = {}
  ): Promise<FlashcardSet> {
    const { maxCards = 15, difficulty = 'intermediate' } = options;

    try {
      const prompt = this.buildDirectFlashcardPrompt(transcript, maxCards, difficulty);

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        temperature: 0.4,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const response = message.content[0];
      if (response.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      const mockNotes: ProcessedNotes = {
        summary: 'Generated from transcript',
        keyPoints: [],
        detailedNotes: transcript,
        timestamp: new Date(),
        sourceFile,
      };

      return this.parseFlashcardResponse(response.text, mockNotes);
    } catch (error) {
      throw new Error(`Failed to generate flashcards from transcript: ${error}`);
    }
  }

  /**
   * Build prompt for generating flashcards from processed notes
   */
  private buildFlashcardPrompt(
    notes: ProcessedNotes,
    maxCards: number,
    difficulty: string,
    includeDefinitions: boolean,
    includeConceptualQuestions: boolean
  ): string {
    let prompt = `Create study flashcards from the following lecture notes. Generate up to ${maxCards} high-quality flashcards at ${difficulty} difficulty level.`;

    if (includeDefinitions) {
      prompt += ` Include term definition cards for key concepts.`;
    }

    if (includeConceptualQuestions) {
      prompt += ` Include conceptual question cards that test understanding of relationships and applications.`;
    }

    prompt += `

Guidelines:
- Each flashcard should have a clear, concise term/question and a comprehensive definition/answer
- Focus on the most important concepts from the lecture
- Make questions specific and unambiguous
- Ensure definitions are complete but not overly verbose
- Include examples where helpful
- Vary question types (definitions, applications, comparisons, etc.)

Format your response as a JSON array with this exact structure:
[
  {
    "term": "Question or term here",
    "definition": "Answer or definition here"
  }
]

Lecture Notes to process:

SUMMARY: ${notes.summary}

KEY POINTS:
${notes.keyPoints.map(point => `- ${point}`).join('\n')}

DETAILED NOTES:
${notes.detailedNotes}`;

    return prompt;
  }

  /**
   * Build prompt for generating flashcards directly from transcript
   */
  private buildDirectFlashcardPrompt(
    transcript: string,
    maxCards: number,
    difficulty: string
  ): string {
    return `Analyze this lecture transcript and create ${maxCards} study flashcards at ${difficulty} difficulty level.

Guidelines:
- Extract the most important concepts, definitions, and key points
- Create clear, specific questions with comprehensive answers
- Focus on terms, concepts, processes, and relationships discussed
- Include practical applications where mentioned
- Make sure each flashcard tests meaningful understanding

Format your response as a JSON array with this exact structure:
[
  {
    "term": "Question or term here",
    "definition": "Answer or definition here"
  }
]

Transcript:
${transcript}`;
  }

  /**
   * Parse Claude's flashcard response into structured format
   */
  private parseFlashcardResponse(response: string, notes: ProcessedNotes): FlashcardSet {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const flashcardsData = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(flashcardsData)) {
        throw new Error('Response is not an array');
      }

      const cards: Flashcard[] = flashcardsData
        .filter(item => item.term && item.definition)
        .map(item => ({
          term: item.term.trim(),
          definition: item.definition.trim(),
        }));

      return {
        title: `Flashcards - ${notes.sourceFile}`,
        description: `Study flashcards generated from lecture transcript`,
        cards,
        createdAt: new Date(),
        sourceNotes: notes.detailedNotes.substring(0, 200) + '...',
      };
    } catch (error) {
      throw new Error(`Failed to parse flashcard response: ${error}`);
    }
  }

  /**
   * Export flashcards in different formats
   */
  exportFlashcards(flashcardSet: FlashcardSet, format: 'json' | 'csv' | 'txt' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(flashcardSet, null, 2);
      
      case 'csv':
        const csvHeader = 'Term,Definition\n';
        const csvRows = flashcardSet.cards
          .map(card => `"${card.term.replace(/"/g, '""')}","${card.definition.replace(/"/g, '""')}"`)
          .join('\n');
        return csvHeader + csvRows;
      
      case 'txt':
        return flashcardSet.cards
          .map((card, index) => `${index + 1}. ${card.term}\n   ${card.definition}\n`)
          .join('\n');
      
      default:
        return JSON.stringify(flashcardSet, null, 2);
    }
  }

  /**
   * Validate flashcard quality and suggest improvements
   */
  validateFlashcards(flashcardSet: FlashcardSet): {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for minimum number of cards
    if (flashcardSet.cards.length < 5) {
      warnings.push('Very few flashcards generated. Consider providing more detailed source material.');
    }

    // Check for overly long terms/definitions
    flashcardSet.cards.forEach((card, index) => {
      if (card.term.length > 200) {
        warnings.push(`Card ${index + 1}: Term is very long, consider shortening.`);
      }
      if (card.definition.length > 500) {
        warnings.push(`Card ${index + 1}: Definition is very long, consider breaking into multiple cards.`);
      }
      if (card.definition.length < 20) {
        warnings.push(`Card ${index + 1}: Definition is very short, might need more detail.`);
      }
    });

    // Check for duplicate terms
    const terms = flashcardSet.cards.map(card => card.term.toLowerCase());
    const duplicates = terms.filter((term, index) => terms.indexOf(term) !== index);
    if (duplicates.length > 0) {
      warnings.push(`Duplicate terms found: ${duplicates.join(', ')}`);
    }

    // Suggestions for improvement
    if (flashcardSet.cards.length > 30) {
      suggestions.push('Consider reducing the number of cards for better study sessions.');
    }

    suggestions.push('Review cards for clarity and ensure they test meaningful understanding.');
    suggestions.push('Consider adding example-based questions for better comprehension.');

    return {
      isValid: warnings.length === 0,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate API key is available
   */
  validateApiKey(): boolean {
    return !!(process.env.ANTHROPIC_API_KEY || this.anthropic.apiKey);
  }
}
