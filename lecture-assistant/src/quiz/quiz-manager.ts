import { AppSession } from '@mentra/sdk';
import { FlashcardQuiz, QuizSession, QuizCard } from './flashcard-quiz';
import { FlashcardSet } from '../types';

/**
 * Quiz Manager for Smart Glasses Integration
 * Handles the quiz flow with voice input/output and display management
 */
export class QuizManager {
  private session: AppSession;
  private currentQuiz: FlashcardQuiz | null = null;
  private isQuizActive: boolean = false;
  private currentCard: QuizCard | null = null;

  constructor(session: AppSession) {
    this.session = session;
  }

  /**
   * Start a new quiz session
   */
  async startQuiz(flashcardSet: FlashcardSet): Promise<void> {
    if (this.isQuizActive) {
      throw new Error('Quiz is already active');
    }

    this.currentQuiz = new FlashcardQuiz(flashcardSet);
    this.isQuizActive = true;

    // Show quiz start message
    await this.displayMessage('Quiz Started! Get ready...', 2000);
    
    // Start the quiz loop
    await this.nextCard();
  }

  /**
   * Main quiz loop - display next card
   */
  private async nextCard(): Promise<void> {
    if (!this.currentQuiz || !this.isQuizActive) return;

    this.currentCard = this.currentQuiz.getNextCard();

    if (!this.currentCard) {
      // Quiz completed
      await this.endQuiz();
      return;
    }

    // Display the flashcard question
    await this.displayFlashcard(this.currentCard);
    
    // Set up voice recognition for answer
    this.setupAnswerListener();
  }

  /**
   * Display flashcard on smart glasses
   */
  private async displayFlashcard(card: QuizCard): Promise<void> {
    const status = this.currentQuiz!.getQuizStatus();
    
    const cardDisplay = `
+---------------------+
| FLASHCARD ${status.totalAttempts + 1}/${this.currentQuiz!.getSession().totalCards}     |
+---------------------+
|                     |
| ${this.wrapText(card.term, 19)}
|                     |
+---------------------+
| Say your answer...  |
+---------------------+

Progress: ${Math.round(status.progress)}%
Remaining: ${status.cardsRemaining}
    `.trim();

    await this.session.display.showText(cardDisplay);
    
    // Also log for development
    console.log('\n' + cardDisplay);
    console.log(`\nExpected: ${card.definition}`);
  }

  /**
   * Set up voice recognition for user answers
   */
  private setupAnswerListener(): void {
    // Listen for voice input
    const unsubscribe = this.session.events.onTranscription((data) => {
      if (data.isFinal && data.text.trim().length > 0) {
        this.handleUserAnswer(data.text.trim());
        unsubscribe(); // Stop listening after getting answer
      }
    });

    // Set timeout for answer (30 seconds)
    setTimeout(() => {
      if (this.isQuizActive && this.currentCard) {
        unsubscribe();
        this.handleTimeout();
      }
    }, 30000);
  }

  /**
   * Handle user's spoken answer
   */
  private async handleUserAnswer(userAnswer: string): Promise<void> {
    if (!this.currentQuiz || !this.currentCard) return;

    console.log(`User answered: "${userAnswer}"`);
    
    const isCorrect = this.currentQuiz.flashcard_correct(userAnswer);
    
    if (isCorrect) {
      await this.showCorrectFeedback();
    } else {
      await this.showIncorrectFeedback();
    }

    // Move to next card after feedback
    setTimeout(() => {
      this.nextCard();
    }, 2000);
  }

  /**
   * Show correct answer feedback
   */
  private async showCorrectFeedback(): Promise<void> {
    const correctDisplay = `
╭─────────────────────╮
│    ✓ CORRECT! ✓     │
├─────────────────────┤
│                     │
│     Well done!      │
│                     │
╰─────────────────────╯
    `.trim();

    await this.session.display.showText(correctDisplay);
    console.log('\n' + correctDisplay);
  }

  /**
   * Show incorrect answer feedback with correct answer
   */
  private async showIncorrectFeedback(): Promise<void> {
    if (!this.currentCard) return;

    const incorrectDisplay = `
╭─────────────────────╮
│    ✗ INCORRECT ✗    │
├─────────────────────┤
│                     │
│ Correct answer:     │
│ ${this.wrapText(this.currentCard.definition, 19)}
│                     │
│ Try again later!    │
╰─────────────────────╯
    `.trim();

    await this.session.display.showText(incorrectDisplay);
    console.log('\n' + incorrectDisplay);
  }

  /**
   * Handle answer timeout
   */
  private async handleTimeout(): Promise<void> {
    if (!this.currentCard) return;

    const timeoutDisplay = `
╭─────────────────────╮
│    ⏰ TIME'S UP!     │
├─────────────────────┤
│                     │
│ Answer was:         │
│ ${this.wrapText(this.currentCard.definition, 19)}
│                     │
╰─────────────────────╯
    `.trim();

    await this.session.display.showText(timeoutDisplay);
    console.log('\n' + timeoutDisplay);

    // Treat timeout as incorrect
    if (this.currentQuiz) {
      this.currentQuiz.flashcard_correct(''); // Empty answer = incorrect
    }

    // Move to next card
    setTimeout(() => {
      this.nextCard();
    }, 3000);
  }

  /**
   * End quiz and show final results
   */
  private async endQuiz(): Promise<void> {
    if (!this.currentQuiz) return;

    this.isQuizActive = false;
    
    // Show the congratulations message
    const finalDisplay = this.currentQuiz.getGlassesDisplay();
    await this.session.display.showText(finalDisplay);
    
    console.log('\n' + finalDisplay);
    
    // Log detailed results
    const session = this.currentQuiz.getSession();
    console.log('\n📊 Quiz Results:');
    console.log(`   Total Cards: ${session.totalCards}`);
    console.log(`   Completed: ${session.cardsCompleted}`);
    console.log(`   Incorrect Attempts: ${session.incorrectAttempts}`);
    console.log(`   Duration: ${this.formatDuration(session.startTime, session.endTime!)}`);
    console.log(`   Accuracy: ${this.calculateAccuracy(session)}%`);
  }

  /**
   * Stop current quiz
   */
  async stopQuiz(): Promise<void> {
    if (!this.isQuizActive) return;

    this.isQuizActive = false;
    this.currentQuiz = null;
    this.currentCard = null;

    await this.displayMessage('Quiz stopped.', 1500);
  }

  /**
   * Pause/Resume quiz
   */
  async togglePause(): Promise<void> {
    if (!this.currentQuiz) return;

    this.isQuizActive = !this.isQuizActive;
    
    if (this.isQuizActive) {
      await this.displayMessage('Quiz resumed!', 1500);
      await this.nextCard();
    } else {
      await this.displayMessage('Quiz paused.', 1500);
    }
  }

  /**
   * Get current quiz status
   */
  getQuizStatus(): any {
    if (!this.currentQuiz) return null;
    return this.currentQuiz.getQuizStatus();
  }

  /**
   * Utility: Display a temporary message
   */
  private async displayMessage(message: string, duration: number): Promise<void> {
    const messageDisplay = `
╭─────────────────────╮
│                     │
│ ${message.padStart(Math.floor((19 + message.length) / 2)).padEnd(19)} │
│                     │
╰─────────────────────╯
    `.trim();

    await this.session.display.showText(messageDisplay);
    console.log('\n' + messageDisplay);

    // Clear after duration
    setTimeout(() => {
      if (!this.isQuizActive) {
        this.session.display.clear();
      }
    }, duration);
  }

  /**
   * Utility: Wrap text to fit display width
   */
  private wrapText(text: string, maxWidth: number): string {
    if (text.length <= maxWidth) {
      return text.padEnd(maxWidth);
    }
    
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + word).length <= maxWidth) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine.padEnd(maxWidth));
        }
        currentLine = word;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine.padEnd(maxWidth));
    }
    
    return lines.join('\n│ ');
  }

  /**
   * Utility: Format duration
   */
  private formatDuration(start: Date, end: Date): string {
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  /**
   * Utility: Calculate accuracy percentage
   */
  private calculateAccuracy(session: QuizSession): number {
    const total = session.cardsCompleted + session.incorrectAttempts;
    return total > 0 ? Math.round((session.cardsCompleted / total) * 100) : 100;
  }

  /**
   * Check if quiz is currently active
   */
  isActive(): boolean {
    return this.isQuizActive;
  }
}
