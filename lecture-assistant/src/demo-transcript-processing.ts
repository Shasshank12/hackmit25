#!/usr/bin/env tsx

/**
 * Demo script showing how to use the transcript processing feature
 * 
 * Usage:
 *   npm run demo:transcript <transcript-file.txt>
 *   
 * Or with options:
 *   ANTHROPIC_API_KEY=your_key npm run demo:transcript transcript.txt
 */

import { processTranscriptFile, TranscriptToNotesProcessor } from './transcript-to-notes';
// Path import removed - not used in this demo

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🎓 Lecture Transcript Processing Demo

Usage:
  npm run demo:transcript <transcript-file.txt>

Environment Variables:
  ANTHROPIC_API_KEY - Your Anthropic/Claude API key (required)

Example:
  ANTHROPIC_API_KEY=your_key npm run demo:transcript lecture1.txt

Options you can customize in the code:
  - noteStyle: 'detailed', 'concise', 'outline'
  - maxFlashcards: number of flashcards to generate
  - flashcardDifficulty: 'basic', 'intermediate', 'advanced'
  - focusAreas: specific topics to emphasize
    `);
    process.exit(1);
  }

  const inputFile = args[0];
  
  // Check if API key is provided
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable is required');
    console.log('Set it like: ANTHROPIC_API_KEY=your_key npm run demo:transcript transcript.txt');
    process.exit(1);
  }

  try {
    console.log('🚀 Starting transcript processing...\n');
    
    // Example 1: Full processing workflow
    console.log('=== FULL PROCESSING WORKFLOW ===');
    const result = await processTranscriptFile(inputFile, {
      noteStyle: 'detailed',
      maxFlashcards: 15,
      flashcardDifficulty: 'intermediate',
      focusAreas: ['key concepts', 'definitions', 'important processes'],
    });

    console.log('\n📊 Processing Results:');
    console.log(`   📝 Summary: ${result.notes.summary.substring(0, 100)}...`);
    console.log(`   📋 Key Points: ${result.notes.keyPoints.length}`);
    console.log(`   🃏 Flashcards: ${result.flashcards.cards.length}`);
    
    if (result.outputFiles.notesPath) {
      console.log(`   📄 Notes saved: ${result.outputFiles.notesPath}`);
    }
    if (result.outputFiles.flashcardsPath) {
      console.log(`   📚 Flashcards saved: ${result.outputFiles.flashcardsPath}`);
    }

    // Example 2: Show sample flashcards
    console.log('\n=== SAMPLE FLASHCARDS ===');
    const sampleCards = result.flashcards.cards.slice(0, 3);
    sampleCards.forEach((card, index) => {
      console.log(`\n${index + 1}. ${card.term}`);
      console.log(`   ${card.definition}`);
    });

    // Example 3: Different processing options
    console.log('\n=== ALTERNATIVE PROCESSING MODES ===');
    
    const processor = new TranscriptToNotesProcessor();
    
    // Generate only concise notes
    console.log('\n📝 Generating concise notes only...');
    const notesOnly = await processor.generateNotesOnly(inputFile, {
      noteStyle: 'concise',
      saveNotes: false, // Don't save to avoid overwriting
    });
    console.log(`   Generated concise notes with ${notesOnly.notes.keyPoints.length} key points`);

    // Generate only flashcards (direct from transcript)
    console.log('\n🃏 Generating flashcards only...');
    const flashcardsOnly = await processor.generateFlashcardsOnly(inputFile, {
      maxFlashcards: 10,
      flashcardDifficulty: 'basic',
      saveFlashcards: false, // Don't save to avoid overwriting
    });
    console.log(`   Generated ${flashcardsOnly.flashcards.cards.length} basic flashcards`);

    console.log('\n✅ Demo completed successfully!');
    console.log('\n💡 Tips:');
    console.log('   - Adjust noteStyle for different detail levels');
    console.log('   - Use focusAreas to emphasize specific topics');
    console.log('   - Try different flashcard difficulties for varied complexity');
    console.log('   - Check the generated files for full content');

  } catch (error) {
    console.error('❌ Error processing transcript:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the demo
main().catch(console.error);
