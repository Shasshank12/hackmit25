#!/usr/bin/env tsx

/**
 * Demo script for the Flashcard Quiz System
 * 
 * Usage:
 *   npm run demo:quiz [flashcards.json]
 *   
 * Or test with sample data:
 *   npm run demo:quiz
 */

import { FlashcardQuiz } from './quiz/flashcard-quiz';
import { FlashcardSet } from './types';
import { promises as fs } from 'node:fs';
import * as readline from 'readline';

// Sample flashcard data for testing
const sampleFlashcardSet: FlashcardSet = {
  title: "Computer Science Basics",
  description: "Fundamental CS concepts",
  createdAt: new Date(),
  sourceNotes: "Generated for demo",
  cards: [
    {
      term: "What is an algorithm?",
      definition: "A step-by-step procedure for solving a problem or completing a task"
    },
    {
      term: "What is recursion?",
      definition: "A programming technique where a function calls itself to solve smaller instances of the same problem"
    },
    {
      term: "What is Big O notation?",
      definition: "A mathematical notation that describes the limiting behavior of a function when the argument tends towards a particular value or infinity"
    },
    {
      term: "What is a data structure?",
      definition: "A way of organizing and storing data to enable efficient access and modification"
    },
    {
      term: "What is machine learning?",
      definition: "A subset of AI that enables computers to learn and improve from experience without being explicitly programmed"
    }
  ]
};

class ConsoleQuizDemo {
  private rl: readline.Interface;
  private quiz: FlashcardQuiz;

  constructor(flashcardSet: FlashcardSet) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.quiz = new FlashcardQuiz(flashcardSet);
  }

  /**
   * Start the interactive quiz demo
   */
  async startQuiz(): Promise<void> {
    console.log('\n🎓 FLASHCARD QUIZ DEMO 🎓');
    console.log('=' .repeat(40));
    console.log(`📚 Quiz: ${this.quiz.getSession().flashcardSet.title}`);
    console.log(`🃏 Total Cards: ${this.quiz.getSession().totalCards}`);
    console.log('\n💡 Instructions:');
    console.log('   - Type your answer and press Enter');
    console.log('   - Type "hint" for a hint');
    console.log('   - Type "skip" to skip the card');
    console.log('   - Type "quit" to exit');
    console.log('\n' + '=' .repeat(40));

    await this.quizLoop();
  }

  /**
   * Main quiz loop implementation
   */
  private async quizLoop(): Promise<void> {
    while (!this.quiz.isQuizComplete()) {
      const card = this.quiz.getNextCard();
      
      if (!card) {
        break; // Quiz complete
      }

      // Display current status
      const status = this.quiz.getQuizStatus();
      console.log(`\n📊 Progress: ${Math.round(status.progress)}% | Remaining: ${status.cardsRemaining} | Attempts: ${status.totalAttempts}`);
      console.log('─'.repeat(50));
      
      // Display the flashcard
      console.log(`\n🃏 CARD ${status.totalAttempts + 1}:`);
      console.log(`┌${'─'.repeat(48)}┐`);
      console.log(`│ ${card.term.padEnd(46)} │`);
      console.log(`└${'─'.repeat(48)}┘`);
      
      // Get user input
      const userAnswer = await this.getUserInput('\n💭 Your answer: ');
      
      // Handle special commands
      if (userAnswer.toLowerCase() === 'quit') {
        console.log('\n👋 Quiz ended by user.');
        break;
      }
      
      if (userAnswer.toLowerCase() === 'skip') {
        this.quiz.skipCard();
        console.log('⏭️  Card skipped!');
        continue;
      }
      
      if (userAnswer.toLowerCase() === 'hint') {
        const hint = this.quiz.getHint();
        console.log(`💡 Hint: ${hint}`);
        
        // Ask again after showing hint
        const hintAnswer = await this.getUserInput('💭 Your answer (after hint): ');
        if (hintAnswer.toLowerCase() === 'quit') break;
        if (hintAnswer.toLowerCase() === 'skip') {
          this.quiz.skipCard();
          continue;
        }
        
        this.processAnswer(hintAnswer, card);
      } else {
        this.processAnswer(userAnswer, card);
      }
    }

    this.rl.close();
  }

  /**
   * Process user's answer
   */
  private processAnswer(userAnswer: string, card: any): void {
    const isCorrect = this.quiz.flashcard_correct(userAnswer);
    
    if (isCorrect) {
      console.log('\n✅ CORRECT! Well done! 🎉');
    } else {
      console.log('\n❌ INCORRECT.');
      console.log(`📖 Correct answer: ${card.definition}`);
      console.log('🔄 This card will appear again later.');
    }
    
    // Show brief pause
    console.log('\nPress Enter to continue...');
  }

  /**
   * Get user input with promise
   */
  private getUserInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }
}

/**
 * Load flashcards from JSON file
 */
async function loadFlashcards(filePath: string): Promise<FlashcardSet> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const flashcardSet = JSON.parse(content) as FlashcardSet;
    
    if (!flashcardSet.cards || !Array.isArray(flashcardSet.cards)) {
      throw new Error('Invalid flashcard format: missing cards array');
    }
    
    return flashcardSet;
  } catch (error) {
    throw new Error(`Failed to load flashcards: ${error}`);
  }
}

/**
 * Main demo function
 */
async function main() {
  const args = process.argv.slice(2);
  
  console.log('\n🚀 FLASHCARD QUIZ SYSTEM DEMO');
  console.log('=' .repeat(50));
  
  let flashcardSet: FlashcardSet;
  
  if (args.length > 0) {
    const filePath = args[0];
    console.log(`📂 Loading flashcards from: ${filePath}`);
    
    try {
      flashcardSet = await loadFlashcards(filePath);
      console.log(`✅ Loaded ${flashcardSet.cards.length} flashcards`);
    } catch (error) {
      console.error(`❌ Error loading flashcards: ${error}`);
      console.log('📝 Using sample flashcards instead...');
      flashcardSet = sampleFlashcardSet;
    }
  } else {
    console.log('📝 Using sample flashcards for demo...');
    flashcardSet = sampleFlashcardSet;
  }

  // Test the core algorithm first
  console.log('\n🔬 TESTING CORE ALGORITHM:');
  console.log('─'.repeat(30));
  
  const testQuiz = new FlashcardQuiz(flashcardSet);
  console.log(`Initial queue size: ${testQuiz.getQuizStatus().cardsRemaining}`);
  
  // Simulate some correct/incorrect answers
  let card = testQuiz.getNextCard();
  if (card) {
    console.log(`Card: ${card.term}`);
    const correct1 = testQuiz.flashcard_correct("wrong answer");
    console.log(`Wrong answer result: ${correct1} (should be false)`);
    console.log(`Queue size after wrong: ${testQuiz.getQuizStatus().cardsRemaining}`);
    
    card = testQuiz.getNextCard();
    if (card) {
      const correct2 = testQuiz.flashcard_correct(card.definition);
      console.log(`Correct answer result: ${correct2} (should be true)`);
      console.log(`Queue size after correct: ${testQuiz.getQuizStatus().cardsRemaining}`);
    }
  }

  console.log('\n✅ Algorithm test complete!');
  console.log('\n' + '=' .repeat(50));

  // Start interactive demo
  const demo = new ConsoleQuizDemo(flashcardSet);
  await demo.startQuiz();
  
  console.log('\n🎊 Demo completed! Thanks for trying the Flashcard Quiz System!');
  console.log('\n💡 Integration Notes:');
  console.log('   - This demo shows the core algorithm working');
  console.log('   - In the smart glasses app, voice input/output replaces console I/O');
  console.log('   - The queue-based spaced repetition ensures difficult cards repeat');
  console.log('   - ASCII art congratulations will appear on the glasses display');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the demo
main().catch(console.error);
