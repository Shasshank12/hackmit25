import Anthropic from '@anthropic-ai/sdk';
import { LectureTopic, AcademicLevel } from '../types';
import { ENV_CONFIG } from '../config';

/**
 * Agent responsible for generating topic-specific keywords using Claude API
 */
export class KeywordGenerator {
  private anthropic: Anthropic;
  private generatedKeywords: Map<string, string[]> = new Map();
  private generatedDefinitions: Map<string, string> = new Map();

  constructor() {
    if (!ENV_CONFIG.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for keyword generation');
    }

    this.anthropic = new Anthropic({
      apiKey: ENV_CONFIG.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Generate keywords for a specific lecture topic
   */
  async generateKeywords(topic: LectureTopic): Promise<string[]> {
    const topicKey = this.createTopicKey(topic);
    
    // Check if we already have keywords for this topic
    if (this.generatedKeywords.has(topicKey)) {
      return this.generatedKeywords.get(topicKey)!;
    }

    try {
      const keywords = await this.generateKeywordsWithClaude(topic);
      this.generatedKeywords.set(topicKey, keywords);
      return keywords;
    } catch (error) {
      console.error('Error generating keywords:', error);
      // Fallback to basic keywords
      return this.generateFallbackKeywords(topic);
    }
  }

  /**
   * Generate keywords using Claude API
   */
  private async generateKeywordsWithClaude(topic: LectureTopic): Promise<string[]> {
    const levelDescription = this.getLevelDescription(topic.level);
    
    const prompt = `You are an expert educational assistant. Generate a comprehensive list of key terms and concepts that would be covered in a ${levelDescription} lecture about "${topic.subject}" focusing specifically on "${topic.subtopic}".

Requirements:
- Generate 20-30 key terms that are essential for understanding this topic
- Include both basic and advanced concepts appropriate for ${levelDescription} level
- Focus on the most important terminology that students need to know
- Include terms that might be mentioned in lectures, textbooks, or discussions
- Consider related concepts, processes, people, events, or theories

Format your response as a simple list, with each key term on a new line. Do not include explanations or definitions, just the terms themselves.

Example for "American History - World War 2":
Allied Powers
Axis Powers
Pearl Harbor
D-Day
Holocaust
Blitzkrieg
etc.

Now generate the key terms for "${topic.subject} - ${topic.subtopic}" at ${levelDescription} level:`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Using Haiku for faster, cheaper responses
      max_tokens: 1000,
      temperature: 0.3, // Lower temperature for more consistent results
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse the response into a list of keywords
    const keywords = content.text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^(key terms?|concepts?|topics?):?$/i))
      .map(line => line.replace(/^[-•*]\s*/, '')) // Remove bullet points
      .filter(keyword => keyword.length > 1 && keyword.length < 50) // Reasonable length
      .slice(0, 30); // Limit to 30 keywords

    console.log(`Generated ${keywords.length} keywords for ${topic.subject} - ${topic.subtopic}`);
    return keywords;
  }

  /**
   * Generate definition for a specific term using Claude API
   */
  async generateDefinition(term: string, topic: LectureTopic, context?: string): Promise<string> {
    const definitionKey = `${term}-${this.createTopicKey(topic)}`;
    
    // Check if we already have a definition for this term
    if (this.generatedDefinitions.has(definitionKey)) {
      return this.generatedDefinitions.get(definitionKey)!;
    }

    try {
      const definition = await this.generateDefinitionWithClaude(term, topic, context);
      this.generatedDefinitions.set(definitionKey, definition);
      return definition;
    } catch (error) {
      console.error(`Error generating definition for "${term}":`, error);
      // Fallback to generic definition
      return this.generateFallbackDefinition(term, topic);
    }
  }

  /**
   * Generate definition using Claude API
   */
  private async generateDefinitionWithClaude(
    term: string, 
    topic: LectureTopic, 
    context?: string
  ): Promise<string> {
    const levelDescription = this.getLevelDescription(topic.level);
    
    const contextInfo = context ? `\n\nContext from lecture: "${context}"` : '';
    
    const prompt = `You are an expert educational assistant. Provide a clear, concise definition for the term "${term}" in the context of ${levelDescription} ${topic.subject}, specifically related to "${topic.subtopic}".

Requirements:
- Write a definition appropriate for ${levelDescription} students
- Keep it concise (maximum 100 characters) as it will be displayed on smart glasses
- Make it specific to the ${topic.subject} context when relevant
- Use simple, clear language
- Focus on the most important aspect of the term
- Do not include examples or lengthy explanations

${contextInfo}

Provide only the definition, nothing else.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 150,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let definition = content.text.trim();
    
    // Clean up the definition
    definition = definition.replace(/^["']|["']$/g, ''); // Remove quotes
    definition = definition.replace(/^(the term|term|definition):?\s*/i, ''); // Remove prefixes
    definition = definition.substring(0, 100); // Ensure it fits in glasses display
    
    console.log(`Generated definition for "${term}": "${definition}"`);
    return definition;
  }

  /**
   * Get level-appropriate description
   */
  private getLevelDescription(level: AcademicLevel): string {
    const levelDescriptions: { [key in AcademicLevel]: string } = {
      'high_school': 'high school',
      'college': 'college/university undergraduate',
      'masters': 'graduate/master\'s level',
      'phd': 'PhD/doctoral level',
      'professional': 'professional/workplace',
    };

    return levelDescriptions[level];
  }

  /**
   * Create a unique key for caching
   */
  private createTopicKey(topic: LectureTopic): string {
    return `${topic.subject}-${topic.subtopic}-${topic.level}`.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Generate fallback keywords when Claude API is unavailable
   */
  private generateFallbackKeywords(topic: LectureTopic): string[] {
    // Basic fallback keywords based on subject
    const subjectKeywords: { [key: string]: string[] } = {
      'history': ['timeline', 'events', 'dates', 'causes', 'effects', 'significance'],
      'mathematics': ['formula', 'equation', 'calculation', 'theorem', 'proof', 'solution'],
      'science': ['hypothesis', 'experiment', 'theory', 'observation', 'conclusion', 'data'],
      'english': ['theme', 'character', 'plot', 'setting', 'analysis', 'literary device'],
      'computer science': ['algorithm', 'programming', 'data structure', 'function', 'variable', 'loop'],
    };

    const subject = topic.subject.toLowerCase();
    const keywords = subjectKeywords[subject] || ['concept', 'theory', 'principle', 'method', 'approach'];

    console.log(`Using fallback keywords for ${topic.subject}`);
    return keywords;
  }

  /**
   * Generate fallback definition when Claude API is unavailable
   */
  private generateFallbackDefinition(term: string, topic: LectureTopic): string {
    const level = this.getLevelDescription(topic.level);
    return `${term}: A key concept in ${level} ${topic.subject}`;
  }

  /**
   * Check if keywords have been generated for a topic
   */
  hasKeywordsForTopic(topic: LectureTopic): boolean {
    const topicKey = this.createTopicKey(topic);
    return this.generatedKeywords.has(topicKey);
  }

  /**
   * Get cached keywords for a topic
   */
  getCachedKeywords(topic: LectureTopic): string[] | null {
    const topicKey = this.createTopicKey(topic);
    return this.generatedKeywords.get(topicKey) || null;
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.generatedKeywords.clear();
    this.generatedDefinitions.clear();
    console.log('Keyword generator cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { keywordsCount: number; definitionsCount: number } {
    return {
      keywordsCount: this.generatedKeywords.size,
      definitionsCount: this.generatedDefinitions.size,
    };
  }
}
