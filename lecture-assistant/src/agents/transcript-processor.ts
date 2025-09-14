import Anthropic from '@anthropic-ai/sdk';
import { ProcessedNotes } from '../types';

/**
 * TranscriptProcessor uses Claude API to generate detailed notes from lecture transcripts
 */
export class TranscriptProcessor {
  private anthropic: Anthropic;

  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Process a transcript and generate detailed notes using Claude
   */
  async processTranscript(
    transcript: string,
    sourceFile: string,
    options: {
      includeTimestamps?: boolean;
      focusAreas?: string[];
      noteStyle?: 'detailed' | 'concise' | 'outline';
    } = {}
  ): Promise<ProcessedNotes> {
    const { includeTimestamps = false, focusAreas = [], noteStyle = 'detailed' } = options;

    try {
      const prompt = this.buildNotesPrompt(transcript, focusAreas, noteStyle, includeTimestamps);
      
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        temperature: 0.3,
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

      return this.parseNotesResponse(response.text, sourceFile);
    } catch (error) {
      throw new Error(`Failed to process transcript with Claude: ${error}`);
    }
  }

  /**
   * Build the prompt for Claude to generate notes
   */
  private buildNotesPrompt(
    transcript: string,
    focusAreas: string[],
    noteStyle: string,
    includeTimestamps: boolean
  ): string {
    let prompt = `Please analyze this lecture transcript and generate comprehensive study notes. `;

    // Add style instructions
    switch (noteStyle) {
      case 'detailed':
        prompt += `Create detailed, comprehensive notes with thorough explanations of concepts. `;
        break;
      case 'concise':
        prompt += `Create concise, bullet-point style notes focusing on key information. `;
        break;
      case 'outline':
        prompt += `Create well-structured outline-style notes with clear hierarchical organization. `;
        break;
    }

    // Add focus areas if specified
    if (focusAreas.length > 0) {
      prompt += `Pay special attention to these areas: ${focusAreas.join(', ')}. `;
    }

    prompt += `
Format your response as follows:

SUMMARY:
[Provide a brief 2-3 sentence summary of the main topic and key takeaways]

KEY POINTS:
[List 5-8 main points covered in the lecture, formatted as bullet points]

DETAILED NOTES:
[Provide comprehensive notes organized by topic/section with clear headings and subheadings. Include:
- Important concepts and definitions
- Examples and illustrations mentioned
- Key relationships between ideas
- Any formulas, processes, or methodologies discussed
- Critical insights or conclusions]

Here is the transcript to analyze:

${transcript}`;

    return prompt;
  }

  /**
   * Parse Claude's response into structured notes
   */
  private parseNotesResponse(response: string, sourceFile: string): ProcessedNotes {
    try {
      const sections = this.extractSections(response);
      
      return {
        summary: sections.summary || 'No summary provided',
        keyPoints: sections.keyPoints || [],
        detailedNotes: sections.detailedNotes || response,
        timestamp: new Date(),
        sourceFile,
      };
    } catch (error) {
      // Fallback: return the full response as detailed notes
      return {
        summary: 'Generated from transcript analysis',
        keyPoints: [],
        detailedNotes: response,
        timestamp: new Date(),
        sourceFile,
      };
    }
  }

  /**
   * Extract structured sections from Claude's response
   */
  private extractSections(response: string): {
    summary?: string;
    keyPoints?: string[];
    detailedNotes?: string;
  } {
    const sections: any = {};

    // Extract summary
    const summaryMatch = response.match(/SUMMARY:\s*\n(.*?)\n\n/s);
    if (summaryMatch) {
      sections.summary = summaryMatch[1].trim();
    }

    // Extract key points
    const keyPointsMatch = response.match(/KEY POINTS:\s*\n(.*?)\n\n/s);
    if (keyPointsMatch) {
      const keyPointsText = keyPointsMatch[1];
      sections.keyPoints = keyPointsText
        .split('\n')
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .filter(line => line.length > 0);
    }

    // Extract detailed notes
    const detailedNotesMatch = response.match(/DETAILED NOTES:\s*\n(.*)/s);
    if (detailedNotesMatch) {
      sections.detailedNotes = detailedNotesMatch[1].trim();
    }

    return sections;
  }

  /**
   * Format processed notes as markdown
   */
  formatAsMarkdown(notes: ProcessedNotes): string {
    const timestamp = notes.timestamp.toLocaleDateString();
    
    return `# Lecture Notes

**Source:** ${notes.sourceFile}  
**Generated:** ${timestamp}

## Summary

${notes.summary}

## Key Points

${notes.keyPoints.map(point => `- ${point}`).join('\n')}

## Detailed Notes

${notes.detailedNotes}

---
*Generated automatically from transcript using AI*`;
  }

  /**
   * Validate API key is available
   */
  validateApiKey(): boolean {
    return !!(process.env.ANTHROPIC_API_KEY || this.anthropic.apiKey);
  }
}
