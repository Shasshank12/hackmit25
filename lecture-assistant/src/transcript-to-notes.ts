import { TranscriptProcessor } from './agents/transcript-processor';
import { FlashcardGenerator } from './agents/flashcard-generator';
import { FileUtils } from './utils/file-utils';
import { ProcessedNotes, FlashcardSet } from './types';

/**
 * Main orchestrator class for the transcript-to-notes-to-flashcards workflow
 */
export class TranscriptToNotesProcessor {
  private transcriptProcessor: TranscriptProcessor;
  private flashcardGenerator: FlashcardGenerator;

  constructor(anthropicApiKey?: string) {
    this.transcriptProcessor = new TranscriptProcessor(anthropicApiKey);
    this.flashcardGenerator = new FlashcardGenerator(anthropicApiKey);
  }

  /**
   * Complete workflow: Process transcript file -> Generate notes -> Create flashcards
   */
  async processTranscriptFile(
    inputFilePath: string,
    options: {
      outputDir?: string;
      noteStyle?: 'detailed' | 'concise' | 'outline';
      maxFlashcards?: number;
      flashcardDifficulty?: 'basic' | 'intermediate' | 'advanced';
      focusAreas?: string[];
      saveNotes?: boolean;
      saveFlashcards?: boolean;
    } = {}
  ): Promise<{
    notes: ProcessedNotes;
    flashcards: FlashcardSet;
    outputFiles: {
      notesPath?: string;
      flashcardsPath?: string;
    };
  }> {
    const {
      outputDir,
      noteStyle = 'detailed',
      maxFlashcards = 20,
      flashcardDifficulty = 'intermediate',
      focusAreas = [],
      saveNotes = true,
      saveFlashcards = true,
    } = options;

    try {
      // Validate input file
      if (!FileUtils.validateTranscriptFile(inputFilePath)) {
        throw new Error('Input file must be a .txt file');
      }

      if (!(await FileUtils.fileExists(inputFilePath))) {
        throw new Error(`Input file does not exist: ${inputFilePath}`);
      }

      console.log(`📖 Reading transcript from: ${inputFilePath}`);
      
      // Step 1: Read transcript file
      const transcriptContent = await FileUtils.readTranscriptFile(inputFilePath);
      
      if (transcriptContent.length < 100) {
        console.warn('⚠️  Warning: Transcript seems very short, results may be limited');
      }

      console.log(`🤖 Processing transcript (${transcriptContent.length} characters)...`);
      
      // Step 2: Generate detailed notes using Claude
      const notes = await this.transcriptProcessor.processTranscript(
        transcriptContent,
        inputFilePath,
        {
          focusAreas,
          noteStyle,
          includeTimestamps: false,
        }
      );

      console.log(`📝 Generated notes with ${notes.keyPoints.length} key points`);
      console.log(`🃏 Generating flashcards...`);
      
      // Step 3: Generate flashcards from the notes
      const flashcards = await this.flashcardGenerator.generateFlashcards(notes, {
        maxCards: maxFlashcards,
        difficulty: flashcardDifficulty,
        includeDefinitions: true,
        includeConceptualQuestions: true,
      });

      console.log(`✨ Generated ${flashcards.cards.length} flashcards`);

      const outputFiles: { notesPath?: string; flashcardsPath?: string } = {};

      // Step 4: Save files if requested
      if (saveNotes || saveFlashcards) {
        const outputPaths = outputDir
          ? {
              notesPath: `${outputDir}/${inputFilePath.split('/').pop()?.replace('.txt', '_notes.md')}`,
              flashcardsPath: `${outputDir}/${inputFilePath.split('/').pop()?.replace('.txt', '_flashcards.json')}`,
            }
          : FileUtils.generateOutputPaths(inputFilePath);

        if (saveNotes) {
          const formattedNotes = this.transcriptProcessor.formatAsMarkdown(notes);
          await FileUtils.saveNotesToFile(formattedNotes, outputPaths.notesPath);
          outputFiles.notesPath = outputPaths.notesPath;
          console.log(`💾 Saved notes to: ${outputPaths.notesPath}`);
        }

        if (saveFlashcards) {
          await FileUtils.saveFlashcardsToFile(flashcards, outputPaths.flashcardsPath);
          outputFiles.flashcardsPath = outputPaths.flashcardsPath;
          console.log(`💾 Saved flashcards to: ${outputPaths.flashcardsPath}`);
        }
      }

      // Validate flashcards quality
      const validation = this.flashcardGenerator.validateFlashcards(flashcards);
      if (validation.warnings.length > 0) {
        console.log('⚠️  Flashcard warnings:');
        validation.warnings.forEach(warning => console.log(`   - ${warning}`));
      }

      return {
        notes,
        flashcards,
        outputFiles,
      };
    } catch (error) {
      throw new Error(`Failed to process transcript: ${error}`);
    }
  }

  /**
   * Process transcript content directly (without file I/O)
   */
  async processTranscriptContent(
    transcriptContent: string,
    sourceIdentifier: string = 'direct-input',
    options: {
      noteStyle?: 'detailed' | 'concise' | 'outline';
      maxFlashcards?: number;
      flashcardDifficulty?: 'basic' | 'intermediate' | 'advanced';
      focusAreas?: string[];
    } = {}
  ): Promise<{
    notes: ProcessedNotes;
    flashcards: FlashcardSet;
  }> {
    const {
      noteStyle = 'detailed',
      maxFlashcards = 20,
      flashcardDifficulty = 'intermediate',
      focusAreas = [],
    } = options;

    console.log(`🤖 Processing transcript content (${transcriptContent.length} characters)...`);

    // Generate notes
    const notes = await this.transcriptProcessor.processTranscript(
      transcriptContent,
      sourceIdentifier,
      {
        focusAreas,
        noteStyle,
        includeTimestamps: false,
      }
    );

    console.log(`📝 Generated notes with ${notes.keyPoints.length} key points`);

    // Generate flashcards
    const flashcards = await this.flashcardGenerator.generateFlashcards(notes, {
      maxCards: maxFlashcards,
      difficulty: flashcardDifficulty,
      includeDefinitions: true,
      includeConceptualQuestions: true,
    });

    console.log(`✨ Generated ${flashcards.cards.length} flashcards`);

    return { notes, flashcards };
  }

  /**
   * Generate only notes (skip flashcards)
   */
  async generateNotesOnly(
    inputFilePath: string,
    options: {
      outputDir?: string;
      noteStyle?: 'detailed' | 'concise' | 'outline';
      focusAreas?: string[];
      saveNotes?: boolean;
    } = {}
  ): Promise<{ notes: ProcessedNotes; outputPath?: string }> {
    const transcriptContent = await FileUtils.readTranscriptFile(inputFilePath);
    
    const notes = await this.transcriptProcessor.processTranscript(
      transcriptContent,
      inputFilePath,
      {
        focusAreas: options.focusAreas || [],
        noteStyle: options.noteStyle || 'detailed',
        includeTimestamps: false,
      }
    );

    let outputPath: string | undefined;
    if (options.saveNotes !== false) {
      const outputPaths = FileUtils.generateOutputPaths(inputFilePath);
      const formattedNotes = this.transcriptProcessor.formatAsMarkdown(notes);
      await FileUtils.saveNotesToFile(formattedNotes, outputPaths.notesPath);
      outputPath = outputPaths.notesPath;
    }

    return { notes, outputPath };
  }

  /**
   * Generate only flashcards (skip detailed notes generation)
   */
  async generateFlashcardsOnly(
    inputFilePath: string,
    options: {
      outputDir?: string;
      maxFlashcards?: number;
      flashcardDifficulty?: 'basic' | 'intermediate' | 'advanced';
      saveFlashcards?: boolean;
    } = {}
  ): Promise<{ flashcards: FlashcardSet; outputPath?: string }> {
    const transcriptContent = await FileUtils.readTranscriptFile(inputFilePath);
    
    const flashcards = await this.flashcardGenerator.generateFlashcardsFromTranscript(
      transcriptContent,
      inputFilePath,
      {
        maxCards: options.maxFlashcards || 15,
        difficulty: options.flashcardDifficulty || 'intermediate',
      }
    );

    let outputPath: string | undefined;
    if (options.saveFlashcards !== false) {
      const outputPaths = FileUtils.generateOutputPaths(inputFilePath);
      await FileUtils.saveFlashcardsToFile(flashcards, outputPaths.flashcardsPath);
      outputPath = outputPaths.flashcardsPath;
    }

    return { flashcards, outputPath };
  }

  /**
   * Validate that required API keys are available
   */
  validateConfiguration(): { isValid: boolean; missingKeys: string[] } {
    const missingKeys: string[] = [];

    if (!this.transcriptProcessor.validateApiKey()) {
      missingKeys.push('ANTHROPIC_API_KEY');
    }

    return {
      isValid: missingKeys.length === 0,
      missingKeys,
    };
  }
}

/**
 * Convenience function for quick processing
 */
export async function processTranscriptFile(
  inputFilePath: string,
  options?: {
    anthropicApiKey?: string;
    outputDir?: string;
    noteStyle?: 'detailed' | 'concise' | 'outline';
    maxFlashcards?: number;
    flashcardDifficulty?: 'basic' | 'intermediate' | 'advanced';
    focusAreas?: string[];
  }
) {
  const processor = new TranscriptToNotesProcessor(options?.anthropicApiKey);
  
  const configValidation = processor.validateConfiguration();
  if (!configValidation.isValid) {
    throw new Error(`Missing required configuration: ${configValidation.missingKeys.join(', ')}`);
  }

  return await processor.processTranscriptFile(inputFilePath, options);
}

// Export types for external use
export { ProcessedNotes, FlashcardSet, Flashcard } from './types';
