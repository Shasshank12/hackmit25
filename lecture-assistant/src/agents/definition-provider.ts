import { KeyTerm, LectureTopic } from "../types";
import { KeywordGenerator } from "./keyword-generator";

/**
 * Agent responsible for providing definitions for detected key terms
 */
export class DefinitionProvider {
  private keywordGenerator: KeywordGenerator;
  private currentTopic: LectureTopic | null = null;
  private definitions: Map<string, string> = new Map([
    // AI/ML Terms
    [
      "machine learning",
      "A subset of AI that enables computers to learn and improve from experience without being explicitly programmed.",
    ],
    [
      "artificial intelligence",
      "The simulation of human intelligence in machines programmed to think and learn like humans.",
    ],
    [
      "neural network",
      "A computing system inspired by biological neural networks that constitute animal brains.",
    ],
    [
      "deep learning",
      "A subset of machine learning using neural networks with multiple layers to model complex patterns.",
    ],
    [
      "supervised learning",
      "Machine learning using labeled training data to make predictions on new, unseen data.",
    ],
    [
      "unsupervised learning",
      "Machine learning that finds hidden patterns in data without labeled examples.",
    ],
    [
      "reinforcement learning",
      "Learning through interaction with an environment using rewards and penalties.",
    ],
    [
      "gradient descent",
      "An optimization algorithm used to minimize the error of machine learning models.",
    ],
    [
      "overfitting",
      "When a model learns training data too specifically and fails to generalize to new data.",
    ],
    [
      "cross-validation",
      "A technique to assess how well a model will generalize to independent datasets.",
    ],

    // Programming Terms
    [
      "algorithm",
      "A step-by-step procedure or formula for solving a problem or completing a task.",
    ],
    [
      "data structure",
      "A way of organizing and storing data to enable efficient access and modification.",
    ],
    [
      "recursion",
      "A programming technique where a function calls itself to solve smaller instances of the same problem.",
    ],
    [
      "polymorphism",
      "The ability of objects of different types to be treated as instances of the same type through inheritance.",
    ],
    [
      "encapsulation",
      "The bundling of data and methods that operate on that data within a single unit or class.",
    ],
    [
      "inheritance",
      "A mechanism where a new class inherits properties and methods from an existing class.",
    ],

    // Mathematics Terms
    [
      "calculus",
      "A branch of mathematics focused on limits, functions, derivatives, integrals, and infinite series.",
    ],
    [
      "derivative",
      "A measure of how a function changes as its input changes; the slope of the function at a point.",
    ],
    [
      "integral",
      "A mathematical concept representing the area under a curve or the reverse of differentiation.",
    ],
    [
      "linear algebra",
      "The branch of mathematics concerning linear equations, linear maps, and their representations in vector spaces.",
    ],
    [
      "matrix",
      "A rectangular array of numbers, symbols, or expressions arranged in rows and columns.",
    ],
    [
      "eigenvalue",
      "A scalar value that indicates how much a corresponding eigenvector is scaled during a linear transformation.",
    ],

    // Academic Terms
    [
      "hypothesis",
      "A proposed explanation for a phenomenon that can be tested through experimentation or observation.",
    ],
    [
      "methodology",
      "A system of methods used in a particular area of study or activity.",
    ],
    [
      "paradigm",
      "A distinct set of concepts or thought patterns, including theories and research methods.",
    ],
    [
      "empirical",
      "Based on, concerned with, or verifiable by observation or experience rather than theory.",
    ],
    [
      "theoretical",
      "Concerned with or involving the theory of a subject or area of study rather than its practical application.",
    ],
  ]);

  constructor() {
    this.keywordGenerator = new KeywordGenerator();
  }

  /**
   * Set the current lecture topic
   */
  setTopic(topic: LectureTopic): void {
    this.currentTopic = topic;
  }

  /**
   * Get definition for a key term
   */
  async getDefinition(term: string): Promise<string | null> {
    const normalizedTerm = term.toLowerCase().trim();

    // First check our predefined definitions
    const definition = this.definitions.get(normalizedTerm);
    if (definition) {
      return definition;
    }

    // Try partial matches for multi-word terms
    for (const [key, value] of this.definitions.entries()) {
      if (normalizedTerm.includes(key) || key.includes(normalizedTerm)) {
        return value;
      }
    }

    // Try to generate definition using Claude API if we have a topic
    if (this.currentTopic) {
      try {
        const generatedDefinition = await this.keywordGenerator.generateDefinition(term, this.currentTopic);
        if (generatedDefinition && generatedDefinition.length > 0) {
          return generatedDefinition;
        }
      } catch (error) {
        console.error(`Error generating definition for "${term}":`, error);
      }
    }

    // Fallback to generic definition
    return this.generateGenericDefinition(term);
  }

  /**
   * Provide definitions for multiple key terms
   */
  async getDefinitions(terms: KeyTerm[]): Promise<KeyTerm[]> {
    const enrichedTerms: KeyTerm[] = [];

    for (const term of terms) {
      const definition = await this.getDefinition(term.term);
      if (definition) {
        enrichedTerms.push({
          ...term,
          definition,
        });
      }
    }

    return enrichedTerms;
  }

  /**
   * Generate a generic definition when specific one isn't available
   */
  private generateGenericDefinition(term: string): string {
    // This is a fallback - in a real implementation, you might:
    // - Call an external API (Wikipedia, Dictionary API, etc.)
    // - Use an LLM to generate definitions
    // - Query a knowledge base

    const category = this.inferCategory(term);

    switch (category) {
      case "technical":
        return `${term}: A technical concept or method used in computer science and engineering.`;
      case "mathematical":
        return `${term}: A mathematical concept or operation used in quantitative analysis.`;
      case "academic":
        return `${term}: An academic term or concept used in scholarly discourse.`;
      default:
        return `${term}: A specialized term requiring further context for precise definition.`;
    }
  }

  /**
   * Infer the category of a term for generic definitions
   */
  private inferCategory(term: string): string {
    const technicalKeywords = [
      "algorithm",
      "system",
      "network",
      "protocol",
      "framework",
      "architecture",
    ];
    const mathematicalKeywords = [
      "function",
      "equation",
      "theorem",
      "proof",
      "formula",
      "calculation",
    ];
    const academicKeywords = [
      "theory",
      "principle",
      "concept",
      "methodology",
      "approach",
      "model",
    ];

    const lowerTerm = term.toLowerCase();

    if (technicalKeywords.some((keyword) => lowerTerm.includes(keyword))) {
      return "technical";
    }
    if (mathematicalKeywords.some((keyword) => lowerTerm.includes(keyword))) {
      return "mathematical";
    }
    if (academicKeywords.some((keyword) => lowerTerm.includes(keyword))) {
      return "academic";
    }

    return "general";
  }

  /**
   * Add a new definition to the knowledge base
   */
  addDefinition(term: string, definition: string): void {
    this.definitions.set(term.toLowerCase().trim(), definition);
  }

  /**
   * Check if we have a definition for a term
   */
  hasDefinition(term: string): boolean {
    const normalizedTerm = term.toLowerCase().trim();
    return (
      this.definitions.has(normalizedTerm) ||
      Array.from(this.definitions.keys()).some(
        (key) => normalizedTerm.includes(key) || key.includes(normalizedTerm)
      )
    );
  }

  /**
   * Get all available definitions (for debugging/admin)
   */
  getAllDefinitions(): Map<string, string> {
    return new Map(this.definitions);
  }
}
