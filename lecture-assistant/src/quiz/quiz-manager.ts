import { AppSession } from "@mentra/sdk";
import { FlashcardQuiz, QuizSession, QuizCard } from "./flashcard-quiz";
import { FlashcardSet } from "../types";

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
      throw new Error("Quiz is already active");
    }

    this.currentQuiz = new FlashcardQuiz(flashcardSet);
    this.isQuizActive = true;

    // Show quiz start message
    await this.displayMessage("Quiz Started! Get ready...", 2000);

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
    // Small delay to ensure previous displays are cleared
    await new Promise((resolve) => setTimeout(resolve, 200));

    const status = this.currentQuiz!.getQuizStatus();

    // For question-answer format, show the definition as question, expect term as answer
    const cardDisplay = `FLASHCARD ${status.totalAttempts + 1}/${
      this.currentQuiz!.getSession().totalCards
    }

Q: ${card.definition}`;

    await this.session.layouts.showTextWall(cardDisplay, {
      durationMs: 0, // Keep displayed until manually changed
    });

    // Also log for development
    console.log("\n" + cardDisplay);
    console.log(`\nExpected answer: ${card.term}`);
  }

  /**
   * Set up voice recognition for user answers
   */
  private setupAnswerListener(): void {
    console.log("🎯 Setting up answer listener for flashcard...");

    // Clear any existing timeout and unsubscribe function
    if ((this as any).currentTimeoutId) {
      console.log("🎯 Clearing existing timeout...");
      clearTimeout((this as any).currentTimeoutId);
    }
    if ((this as any).currentUnsubscribe) {
      console.log("🎯 Unsubscribing existing listener...");
      (this as any).currentUnsubscribe();
    }

    // Listen for voice input
    const unsubscribe = this.session.events.onTranscription((data) => {
      console.log(
        `🎯 Quiz manager received transcription: "${data.text}", isFinal: ${data.isFinal}`
      );
      if (data.isFinal && data.text.trim().length > 0) {
        console.log(`🎯 Processing user answer: "${data.text.trim()}"`);

        // Clear timeout since we got an answer
        if ((this as any).currentTimeoutId) {
          clearTimeout((this as any).currentTimeoutId);
          (this as any).currentTimeoutId = null;
        }

        // Handle the answer
        this.handleUserAnswer(data.text.trim());

        // Unsubscribe from this listener
        unsubscribe();
        (this as any).currentUnsubscribe = null;
      }
    });

    // Store unsubscribe function
    (this as any).currentUnsubscribe = unsubscribe;

    // Set timeout for answer (60 seconds)
    console.log("🎯 Setting 60-second timeout for answer...");
    const timeoutId = setTimeout(() => {
      console.log("🎯 60-second timeout reached!");
      if (this.isQuizActive && this.currentCard) {
        console.log("🎯 Triggering timeout handler...");

        // Unsubscribe from listener
        if ((this as any).currentUnsubscribe) {
          (this as any).currentUnsubscribe();
          (this as any).currentUnsubscribe = null;
        }

        this.handleTimeout();
      } else {
        console.log("🎯 Quiz no longer active, ignoring timeout");
      }
      (this as any).currentTimeoutId = null;
    }, 60000);

    // Store timeout ID
    (this as any).currentTimeoutId = timeoutId;
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

    // Move to next card after feedback (wait for feedback to clear)
    setTimeout(() => {
      this.nextCard();
    }, 3500); // Slightly longer than feedback display duration
  }

  /**
   * Show correct answer feedback
   */
  private async showCorrectFeedback(): Promise<void> {
    const correctDisplay = `CORRECT!

Well done!`;

    await this.session.layouts.showTextWall(correctDisplay, {
      durationMs: 3000, // Show for 3 seconds, then clear
    });
    console.log("\n" + correctDisplay);
  }

  /**
   * Show incorrect answer feedback with correct answer
   */
  private async showIncorrectFeedback(): Promise<void> {
    if (!this.currentCard) return;

    const incorrectDisplay = `INCORRECT

A: ${this.currentCard.term}

Try again later!`;

    await this.session.layouts.showTextWall(incorrectDisplay, {
      durationMs: 3000, // Show for 3 seconds, then clear
    });
    console.log("\n" + incorrectDisplay);
  }

  /**
   * Handle answer timeout
   */
  private async handleTimeout(): Promise<void> {
    if (!this.currentCard) return;

    const timeoutDisplay = `TIME'S UP!

A: ${this.currentCard.term}`;

    await this.session.layouts.showTextWall(timeoutDisplay, {
      durationMs: 4000, // Show for 4 seconds, then clear
    });
    console.log("\n" + timeoutDisplay);

    // Treat timeout as incorrect
    if (this.currentQuiz) {
      this.currentQuiz.flashcard_correct(""); // Empty answer = incorrect
    }

    // Move to next card
    setTimeout(() => {
      this.nextCard();
    }, 4500); // Slightly longer than display duration
  }

  /**
   * End quiz and show final results
   */
  private async endQuiz(): Promise<void> {
    if (!this.currentQuiz) return;

    // Clean up any active listeners and timeouts
    console.log("🎯 Ending quiz - cleaning up listeners and timeouts...");
    if ((this as any).currentTimeoutId) {
      clearTimeout((this as any).currentTimeoutId);
      (this as any).currentTimeoutId = null;
    }
    if ((this as any).currentUnsubscribe) {
      (this as any).currentUnsubscribe();
      (this as any).currentUnsubscribe = null;
    }

    this.isQuizActive = false;

    // Show the congratulations message using the quiz's built-in display
    this.currentQuiz.showCongratulations();

    const quizSession = this.currentQuiz.getSession();
    const finalDisplay = `Quiz Complete!

Cards Correct: ${quizSession.cardsCompleted}/${quizSession.totalCards}

Great job!`;
    await this.session.layouts.showTextWall(finalDisplay);

    console.log("\n" + finalDisplay);

    // Log detailed results
    console.log("\nQuiz Results:");
    console.log(`   Total Cards: ${quizSession.totalCards}`);
    console.log(`   Completed: ${quizSession.cardsCompleted}`);
    console.log(`   Incorrect Attempts: ${quizSession.incorrectAttempts}`);
    console.log(
      `   Duration: ${this.formatDuration(
        quizSession.startTime,
        quizSession.endTime!
      )}`
    );
    console.log(`   Accuracy: ${this.calculateAccuracy(quizSession)}%`);
  }

  /**
   * Stop current quiz
   */
  async stopQuiz(): Promise<void> {
    if (!this.isQuizActive) return;

    // Clean up any active listeners and timeouts
    console.log("🎯 Stopping quiz - cleaning up listeners and timeouts...");
    if ((this as any).currentTimeoutId) {
      clearTimeout((this as any).currentTimeoutId);
      (this as any).currentTimeoutId = null;
    }
    if ((this as any).currentUnsubscribe) {
      (this as any).currentUnsubscribe();
      (this as any).currentUnsubscribe = null;
    }

    this.isQuizActive = false;
    this.currentQuiz = null;
    this.currentCard = null;

    await this.displayMessage("Quiz stopped.", 1500);
  }

  /**
   * Pause/Resume quiz
   */
  async togglePause(): Promise<void> {
    if (!this.currentQuiz) return;

    this.isQuizActive = !this.isQuizActive;

    if (this.isQuizActive) {
      await this.displayMessage("Quiz resumed!", 1500);
      await this.nextCard();
    } else {
      await this.displayMessage("Quiz paused.", 1500);
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
  private async displayMessage(
    message: string,
    duration: number
  ): Promise<void> {
    await this.session.layouts.showTextWall(message);
    console.log("\n" + message);

    // Clear after duration
    setTimeout(async () => {
      if (!this.isQuizActive) {
        // Clear display after timeout
        await this.session.layouts.showTextWall("");
      }
    }, duration);
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
