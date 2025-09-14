import { Flashcard, FlashcardSet } from '../types';

/**
 * Quiz session state and progress tracking
 */
export interface QuizSession {
  id: string;
  flashcardSet: FlashcardSet;
  totalCards: number;
  cardsCompleted: number;
  incorrectAttempts: number;
  startTime: Date;
  endTime?: Date;
  isComplete: boolean;
}

/**
 * Flashcard with quiz metadata
 */
export interface QuizCard extends Flashcard {
  attempts: number;
  lastAttempt?: Date;
  isCorrect?: boolean;
}

/**
 * Flashcard Quiz Algorithm Implementation
 * Uses a queue-based spaced repetition system where incorrect answers go back into the queue
 */
export class FlashcardQuiz {
  private queue: QuizCard[] = [];
  private session: QuizSession;
  private currentCard: QuizCard | null = null;

  constructor(flashcardSet: FlashcardSet, sessionId?: string) {
    // Initialize the queue with all flashcards
    this.queue = flashcardSet.cards.map(card => ({
      ...card,
      attempts: 0,
    }));

    // Shuffle the initial queue for variety
    this.shuffleQueue();

    // Initialize session
    this.session = {
      id: sessionId || this.generateSessionId(),
      flashcardSet,
      totalCards: flashcardSet.cards.length,
      cardsCompleted: 0,
      incorrectAttempts: 0,
      startTime: new Date(),
      isComplete: false,
    };
  }

  /**
   * Main quiz loop - gets next card from queue
   */
  getNextCard(): QuizCard | null {
    if (this.queue.length === 0) {
      this.completeQuiz();
      return null;
    }

    // Pop the next card from the queue
    this.currentCard = this.queue.shift()!;
    this.currentCard.attempts++;
    this.currentCard.lastAttempt = new Date();

    return this.currentCard;
  }

  /**
   * Check if the user's response matches the expected answer
   */
  flashcard_correct(userResponse: string): boolean {
    if (!this.currentCard) {
      throw new Error('No current card to check');
    }

    const isCorrect = this.validateResponse(userResponse, this.currentCard.definition);
    this.currentCard.isCorrect = isCorrect;

    if (!isCorrect) {
      // Push card back to the queue (at the end)
      this.queue.push(this.currentCard);
      this.session.incorrectAttempts++;
    } else {
      // Card completed successfully
      this.session.cardsCompleted++;
    }

    return isCorrect;
  }

  /**
   * Validate user response against expected answer
   */
  private validateResponse(userResponse: string, expectedAnswer: string): boolean {
    // Normalize both responses for comparison
    const normalizeText = (text: string): string => {
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' '); // Normalize whitespace
    };

    const normalizedUser = normalizeText(userResponse);
    const normalizedExpected = normalizeText(expectedAnswer);

    // Exact match
    if (normalizedUser === normalizedExpected) {
      return true;
    }

    // Check if user response contains key terms from expected answer
    const expectedWords = normalizedExpected.split(' ').filter(word => word.length > 3);
    const userWords = normalizedUser.split(' ');
    
    // Calculate similarity - user must include at least 70% of key terms
    const matchingWords = expectedWords.filter(word => 
      userWords.some(userWord => 
        userWord.includes(word) || word.includes(userWord)
      )
    );

    const similarity = matchingWords.length / expectedWords.length;
    return similarity >= 0.7;
  }

  /**
   * Get current quiz status and progress
   */
  getQuizStatus(): {
    isComplete: boolean;
    progress: number;
    cardsRemaining: number;
    currentStreak: number;
    totalAttempts: number;
  } {
    const totalAttempts = this.session.cardsCompleted + this.session.incorrectAttempts;
    const currentStreak = this.calculateCurrentStreak();

    return {
      isComplete: this.session.isComplete,
      progress: (this.session.cardsCompleted / this.session.totalCards) * 100,
      cardsRemaining: this.queue.length,
      currentStreak,
      totalAttempts,
    };
  }

  /**
   * Complete the quiz and show congratulations
   */
  private completeQuiz(): void {
    this.session.isComplete = true;
    this.session.endTime = new Date();
    
    // Display congratulations with ASCII art
    this.showCongratulations();
  }

  /**
   * Show congratulations message with ASCII art for smart glasses
   */
  private showCongratulations(): void {
    const duration = this.getQuizDuration();
    const accuracy = this.calculateAccuracy();

    const asciiArt = `
    * * * QUIZ COMPLETE! * * *
    
         WELL DONE!
    
    +-------------------------+
    |  Cards Correct: ${this.session.cardsCompleted.toString().padStart(2)}/${this.session.totalCards}     |
    +-------------------------+
    
        Keep up the learning!
    `;

    console.log(asciiArt);
    
    // For smart glasses display (smaller format)
    const glassesDisplay = this.getGlassesDisplay();
    return glassesDisplay;
  }

  /**
   * Get compact display for smart glasses
   */
  private getGlassesDisplay(): string {
    const accuracy = this.calculateAccuracy();
    const duration = this.getQuizDuration();

    return `
* QUIZ COMPLETE! *
Cards Correct: ${this.session.cardsCompleted}/${this.session.totalCards}
Great job!
    `.trim();
  }

  /**
   * Calculate quiz accuracy percentage
   */
  private calculateAccuracy(): number {
    const totalAttempts = this.session.cardsCompleted + this.session.incorrectAttempts;
    if (totalAttempts === 0) return 100;
    
    return Math.round((this.session.cardsCompleted / totalAttempts) * 100);
  }

  /**
   * Get quiz duration in human-readable format
   */
  private getQuizDuration(): string {
    const endTime = this.session.endTime || new Date();
    const durationMs = endTime.getTime() - this.session.startTime.getTime();
    const durationMinutes = Math.floor(durationMs / 60000);
    const durationSeconds = Math.floor((durationMs % 60000) / 1000);
    
    if (durationMinutes > 0) {
      return `${durationMinutes}m ${durationSeconds}s`;
    }
    return `${durationSeconds}s`;
  }

  /**
   * Calculate current correct answer streak
   */
  private calculateCurrentStreak(): number {
    // This would track consecutive correct answers
    // For now, return a simple calculation
    return Math.max(0, this.session.cardsCompleted - this.queue.length);
  }

  /**
   * Shuffle the queue for variety
   */
  private shuffleQueue(): void {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get detailed session information
   */
  getSession(): QuizSession {
    return { ...this.session };
  }

  /**
   * Reset quiz to start over
   */
  resetQuiz(): void {
    this.queue = this.session.flashcardSet.cards.map(card => ({
      ...card,
      attempts: 0,
    }));
    
    this.shuffleQueue();
    
    this.session = {
      ...this.session,
      cardsCompleted: 0,
      incorrectAttempts: 0,
      startTime: new Date(),
      endTime: undefined,
      isComplete: false,
    };
    
    this.currentCard = null;
  }

  /**
   * Skip current card (mark as completed without answering)
   */
  skipCard(): void {
    if (this.currentCard) {
      this.session.cardsCompleted++;
      this.currentCard = null;
    }
  }

  /**
   * Get hint for current card (first few words of answer)
   */
  getHint(): string | null {
    if (!this.currentCard) return null;
    
    const words = this.currentCard.definition.split(' ');
    const hintWords = words.slice(0, Math.min(3, words.length));
    return hintWords.join(' ') + '...';
  }

  /**
   * Check if quiz is complete
   */
  isQuizComplete(): boolean {
    return this.session.isComplete;
  }
}
