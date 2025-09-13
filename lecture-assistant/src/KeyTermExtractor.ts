export interface KeyTerm {
  term: string;
  definition: string;
  confidence: number;
  timestamp: Date;
  context: string;
}

export class KeyTermExtractor {
  private recentKeyTerms: KeyTerm[] = [];
  private readonly maxRecentTerms = 10;

  public async extractKeyTerms(transcript: string): Promise<KeyTerm[]> {
    console.log("Extracting key terms from transcript...");

    // In a real implementation, this would use NLP services like:
    // - OpenAI GPT API
    // - Google Cloud Natural Language API
    // - Azure Text Analytics
    // - Custom trained models

    const keyTerms = await this.analyzeTranscriptForKeyTerms(transcript);

    // Add to recent terms list
    keyTerms.forEach((term) => {
      this.addToRecentTerms(term);
    });

    console.log(`Extracted ${keyTerms.length} key terms`);
    return keyTerms;
  }

  public async getRecentKeyTerms(limit: number = 3): Promise<KeyTerm[]> {
    return this.recentKeyTerms
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private addToRecentTerms(keyTerm: KeyTerm): void {
    // Check if term already exists (avoid duplicates)
    const existingIndex = this.recentKeyTerms.findIndex(
      (term) => term.term.toLowerCase() === keyTerm.term.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Update existing term with new information
      this.recentKeyTerms[existingIndex] = keyTerm;
    } else {
      // Add new term
      this.recentKeyTerms.unshift(keyTerm);

      // Keep only the most recent terms
      if (this.recentKeyTerms.length > this.maxRecentTerms) {
        this.recentKeyTerms = this.recentKeyTerms.slice(0, this.maxRecentTerms);
      }
    }
  }

  private async analyzeTranscriptForKeyTerms(
    transcript: string
  ): Promise<KeyTerm[]> {
    // This is a simplified implementation for demonstration
    // In production, you would use advanced NLP techniques

    const keyTerms: KeyTerm[] = [];

    // Define patterns for academic/technical terms
    const academicPatterns = [
      /machine learning/gi,
      /artificial intelligence/gi,
      /neural network/gi,
      /deep learning/gi,
      /supervised learning/gi,
      /unsupervised learning/gi,
      /reinforcement learning/gi,
      /gradient descent/gi,
      /overfitting/gi,
      /cross-validation/gi,
      /feature engineering/gi,
      /algorithm/gi,
      /optimization/gi,
      /regression/gi,
      /classification/gi,
    ];

    // Simple definitions (in production, these would come from APIs or databases)
    const definitions: { [key: string]: string } = {
      "machine learning":
        "A subset of AI that enables computers to learn and improve from experience without being explicitly programmed.",
      "artificial intelligence":
        "The simulation of human intelligence in machines programmed to think and learn like humans.",
      "neural network":
        "A computing system inspired by biological neural networks that constitute animal brains.",
      "deep learning":
        "A subset of machine learning using neural networks with multiple layers to model complex patterns.",
      "supervised learning":
        "Machine learning using labeled training data to make predictions on new, unseen data.",
      "unsupervised learning":
        "Machine learning that finds hidden patterns in data without labeled examples.",
      "reinforcement learning":
        "Learning through interaction with an environment using rewards and penalties.",
      "gradient descent":
        "An optimization algorithm used to minimize the error of machine learning models.",
      overfitting:
        "When a model learns training data too specifically and fails to generalize to new data.",
      "cross-validation":
        "A technique to assess how well a model will generalize to independent datasets.",
      "feature engineering":
        "The process of selecting and transforming variables for machine learning models.",
      algorithm:
        "A step-by-step procedure or formula for solving a problem or completing a task.",
      optimization:
        "The process of making something as effective or functional as possible.",
      regression:
        "A statistical method for predicting continuous numerical values.",
      classification:
        "A machine learning task that assigns categories or classes to data points.",
    };

    // Extract terms using patterns
    academicPatterns.forEach((pattern) => {
      const matches = transcript.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          const term = match.toLowerCase();
          const definition = definitions[term];

          if (definition) {
            // Find context (surrounding words)
            const termIndex = transcript.toLowerCase().indexOf(term);
            const contextStart = Math.max(0, termIndex - 50);
            const contextEnd = Math.min(
              transcript.length,
              termIndex + term.length + 50
            );
            const context = transcript
              .substring(contextStart, contextEnd)
              .trim();

            keyTerms.push({
              term: this.capitalizeWords(term),
              definition,
              confidence: 0.8, // Simplified confidence score
              timestamp: new Date(),
              context,
            });
          }
        });
      }
    });

    // Remove duplicates and sort by confidence
    const uniqueTerms = keyTerms.filter(
      (term, index, self) =>
        index ===
        self.findIndex((t) => t.term.toLowerCase() === term.term.toLowerCase())
    );

    return uniqueTerms.sort((a, b) => b.confidence - a.confidence);
  }

  private capitalizeWords(str: string): string {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  // Method to process real-time transcript updates
  public async processRealtimeTranscript(newText: string): Promise<KeyTerm[]> {
    // Extract key terms from the new text segment
    const newKeyTerms = await this.analyzeTranscriptForKeyTerms(newText);

    // Add to recent terms
    newKeyTerms.forEach((term) => {
      this.addToRecentTerms(term);
    });

    return newKeyTerms;
  }
}
