import "dotenv/config";
import { AppServer, AppSession, AppServerConfig } from "@mentra/sdk";
import * as fs from "fs";
import * as path from "path";
import { TopicCollector } from "./agents/topic-collector";
import { KeywordGenerator } from "./agents/keyword-generator";
import { TranscriptToNotesProcessor } from "./transcript-to-notes";
import { LectureTopic } from "./types";
import { DISPLAY_DURATION_MS } from "./config";

// it can't capture multi word terms
// more validation of subject matter
// more validation of level
// overwrite keyword-mappings
// make term-definitions persist for 5 seconds
// have a list of transcripts

// be more permissive in start and stop lecture triggers
// don't trim the string returned by Claude. instead, prompt Claude to return a shorter definition.
// don't prematurely cut the definition
// add live monitoring of hud to the app

// add a preparing... text when generating keywords
// do something with dashboard?
// why is it skipping subject
/**
 * Simple Lecture Assistant - Records transcripts to file
 */
class LectureAssistantApp extends AppServer {
  private isRecording: boolean = false;
  private currentTranscript: string = "";
  private transcriptsDir: string = path.join(process.cwd(), "transcripts");
  private currentTranscriptPath: string = "";
  private keywordMappingsPath: string = path.join(
    process.cwd(),
    "keyword-mappings.json"
  );
  private topicCollector: TopicCollector | null = null;
  private keywordGenerator: KeywordGenerator | null = null;
  private transcriptProcessor: TranscriptToNotesProcessor | null = null;
  private currentTopic: LectureTopic | null = null;
  private keywordDefinitions: Map<string, string> = new Map();
  private isShowingDefinition: boolean = false;
  private notesDir: string = path.join(process.cwd(), "notes");
  private flashcardsDir: string = path.join(process.cwd(), "flashcards");

  constructor() {
    const config: AppServerConfig = {
      port: parseInt(process.env.PORT || "3000"),
      packageName: process.env.PACKAGE_NAME || "com.hackmit.lectureassistant",
      apiKey:
        process.env.MENTRAOS_API_KEY ||
        "697793ee97a6e87a48fe3ae4be6f358798c3103d36522073b70f4b2c95be2964",
    };

    console.log(`🎓 Lecture Assistant started on port ${config.port}`);
    super(config);
  }

  /**
   * Handle new session connections
   */
  protected async onSession(
    session: AppSession,
    sessionId: string,
    userId: string
  ): Promise<void> {
    try {
      session.logger.info(`🚀 New session started: ${sessionId}`);

      // Show main menu
      await this.showMainMenu(session);

      // Set up event listeners
      await this.setupEventListeners(session);

      // Setup transcription listener
      await this.setupTranscriptionListener(session);

      session.logger.info(`Session setup complete: ${sessionId}`);
    } catch (error) {
      session.logger.error(
        error as any,
        `❌ Session setup failed: ${sessionId}`
      );

      try {
        await session.layouts.showTextWall(
          "🚫 App Error\n\nSession setup failed\nPlease restart the application"
        );
      } catch (displayError) {
        session.logger.error(
          displayError as any,
          "💥 Failed to display error message"
        );
      }
    }
  }

  /**
   * Show the main menu interface
   */
  private async showMainMenu(session: AppSession): Promise<void> {
    try {
      const menuText =
        "🎓 Lecture Assistant\n\nSay 'start lecture' or 'begin lecture' to begin\n\nReady to record!";
      await session.layouts.showTextWall(menuText);
      session.logger.info("✅ Main menu displayed");
    } catch (error) {
      session.logger.error(error as any, "❌ Failed to show main menu");
      await session.layouts.showTextWall("🎓 Ready");
    }
  }

  /**
   * Setup event listeners for user interactions
   */
  private async setupEventListeners(session: AppSession): Promise<void> {
    session.logger.info("🔧 Setting up event listeners...");

    // Listen for voice commands
    session.on("voice", async (voiceData: any) => {
      const command = voiceData.transcript.toLowerCase();
      session.logger.info(`🗣️ Voice event received: "${voiceData.transcript}"`);

      if (this.isStartLectureCommand(command)) {
        session.logger.info("🚀 Starting recording via voice event");
        await this.startRecording(session);
      } else if (this.isStopLectureCommand(command)) {
        session.logger.info("🛑 Stopping recording via voice event");
        await this.stopRecording(session);
      }
    });

    session.logger.info("✅ Event listeners setup complete");
  }

  /**
   * Setup real-time transcription listener
   */
  private async setupTranscriptionListener(session: AppSession): Promise<void> {
    session.logger.info("🎤 Setting up transcription listener...");

    // Listen for real-time speech transcriptions
    session.events.onTranscription(async (data) => {
      session.logger.info(
        `🎤 Transcription received: "${data.text}", isFinal: ${data.isFinal}`
      );

      if (data.isFinal) {
        const command = data.text.toLowerCase();

        // Check for voice commands first
        if (!this.isRecording && this.isStartLectureCommand(command)) {
          session.logger.info(`🚀 Voice command detected: "${data.text}"`);
          this.startRecording(session);
          return;
        }

        if (this.isRecording && this.isStopLectureCommand(command)) {
          session.logger.info(`🛑 Voice command detected: "${data.text}"`);
          this.stopRecording(session);
          return;
        }

        // If recording, add to transcript and check for keywords
        if (this.isRecording) {
          const timestamp = new Date().toISOString();
          const transcriptLine = `[${timestamp}] ${data.text}\n`;

          this.currentTranscript += transcriptLine;
          session.logger.info(`Added to transcript: "${data.text}"`);

          // Check for keywords and display definitions
          await this.checkForKeywords(session, data.text);
        } else {
          // Handle topic collection if active
          if (this.topicCollector) {
            await this.topicCollector.processVoiceInput(data.text);
          } else {
            session.logger.info(
              `🎤 Speech detected but not recording: "${data.text}"`
            );
          }
        }
      }
    });

    session.logger.info("✅ Transcription listener setup complete");
  }

  /**
   * Start lecture process - collect topic first, then begin recording
   */
  private async startRecording(session: AppSession): Promise<void> {
    if (this.isRecording) {
      session.logger.info("Already recording");
      return;
    }

    session.logger.info("🎓 Starting lecture setup process");

    // Initialize agents
    this.topicCollector = new TopicCollector(session);
    this.keywordGenerator = new KeywordGenerator();
    this.transcriptProcessor = new TranscriptToNotesProcessor();

    // Clear previous keyword definitions for fresh start
    this.keywordDefinitions.clear();
    session.logger.info("🧹 Cleared previous keyword definitions");

    // Start topic collection
    await this.topicCollector.startCollection(async (topic: LectureTopic) => {
      await this.onTopicCollected(session, topic);
    });
  }

  /**
   * Handle topic collection completion
   */
  private async onTopicCollected(
    session: AppSession,
    topic: LectureTopic
  ): Promise<void> {
    this.currentTopic = topic;
    session.logger.info(
      `📚 Topic collected: ${topic.subject} - ${topic.academicLevel}`
    );

    try {
      // Show persistent preparing message
      await session.layouts.showTextWall(
        "🔄 Preparing Lecture Assistant...\n\nGenerating keywords and definitions\n\nPlease wait, this may take a moment"
      );

      session.logger.info("🔄 Starting keyword generation...");
      const keywords = await this.keywordGenerator!.generateKeywords(topic);
      session.logger.info(`✅ Generated ${keywords.length} keywords`);

      // Update progress message
      await session.layouts.showTextWall(
        `🔄 Preparing Lecture Assistant...\n\nGenerating definitions for ${keywords.length} keywords\n\nPlease wait, this may take a moment`
      );

      // Generate definitions for each keyword with progress tracking
      let processedCount = 0;
      for (const keyword of keywords) {
        const definition = await this.keywordGenerator!.generateDefinition(
          keyword,
          topic
        );
        this.keywordDefinitions.set(keyword.toLowerCase(), definition);
        processedCount++;

        // Update progress every 5 keywords
        if (processedCount % 5 === 0 || processedCount === keywords.length) {
          await session.layouts.showTextWall(
            `🔄 Preparing Lecture Assistant...\n\nGenerating definitions: ${processedCount}/${keywords.length}\n\nPlease wait, this may take a moment`
          );
          session.logger.info(
            `📖 Generated ${processedCount}/${keywords.length} definitions`
          );
        }
      }

      // Show saving progress
      await session.layouts.showTextWall(
        "🔄 Preparing Lecture Assistant...\n\nSaving keyword mappings\n\nAlmost ready!"
      );

      // Save mappings to JSON file
      await this.saveKeywordMappings();
      session.logger.info("✅ All keyword mappings saved");

      // Show completion message briefly before starting recording
      await session.layouts.showReferenceCard(
        "✅ Ready to Record!",
        `Generated ${keywords.length} keywords and definitions\n\nStarting lecture recording now`,
        { durationMs: 2000 }
      );

      // Start actual recording
      await this.beginRecording(session);
    } catch (error) {
      session.logger.error("Failed to generate keywords:", error as any);
      await session.layouts.showTextWall(
        "❌ Error generating keywords. Starting basic recording..."
      );
      await this.beginRecording(session);
    }
  }

  /**
   * Begin actual recording after topic collection
   */
  private async beginRecording(session: AppSession): Promise<void> {
    this.isRecording = true;
    this.currentTranscript = "";

    // Create transcripts directory if it doesn't exist
    await this.ensureTranscriptsDirectory();

    // Generate unique transcript filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const topicName = this.currentTopic
      ? `${this.currentTopic.subject}-${this.currentTopic.academicLevel}`
      : "lecture";
    const filename = `${timestamp}_${topicName.replace(/\s+/g, "-")}.txt`;
    this.currentTranscriptPath = path.join(this.transcriptsDir, filename);

    session.logger.info("🎙️ Started recording");
    const topicInfo = this.currentTopic
      ? `Subject: ${this.currentTopic.subject}\nLevel: ${this.currentTopic.academicLevel}\n\n`
      : "";

    await session.layouts.showReferenceCard(
      "🎙️ Recording Started",
      `${topicInfo}Listening for speech...\n\nSay 'stop lecture' to finish`,
      { durationMs: 4000 }
    );
  }

  /**
   * Stop recording and save transcript
   */
  private async stopRecording(session: AppSession): Promise<void> {
    if (!this.isRecording) {
      session.logger.info("Not currently recording");
      return;
    }

    this.isRecording = false;

    try {
      // Save transcript to file
      await this.saveTranscriptToFile();

      session.logger.info("🛑 Recording stopped and saved");
      await session.layouts.showReferenceCard(
        "✅ Recording Complete!",
        "Transcript saved to transcripts folder\n\nProcessing notes and flashcards...",
        { durationMs: 3000 }
      );

      // Process transcript to generate notes and flashcards
      await this.processTranscriptToNotesAndFlashcards(session);

      // Return to main menu after delay
      setTimeout(async () => {
        await this.showMainMenu(session);
      }, 8000); // Extended delay to account for processing time
    } catch (error) {
      session.logger.error("Failed to save transcript:", error as any);
      await session.layouts.showTextWall("❌ Error saving transcript");
    }
  }

  /**
   * Ensure transcripts directory exists
   */
  private async ensureTranscriptsDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.transcriptsDir, { recursive: true });
    } catch (error) {
      console.error("Error creating transcripts directory:", error);
      throw error;
    }
  }

  /**
   * Ensure notes and flashcards directories exist
   */
  private async ensureOutputDirectories(): Promise<void> {
    try {
      await fs.promises.mkdir(this.notesDir, { recursive: true });
      await fs.promises.mkdir(this.flashcardsDir, { recursive: true });
    } catch (error) {
      console.error("Error creating output directories:", error);
      throw error;
    }
  }

  /**
   * Find the most recent transcript file in the transcripts directory
   */
  private async findMostRecentTranscript(): Promise<string | null> {
    try {
      const files = await fs.promises.readdir(this.transcriptsDir);
      const transcriptFiles = files.filter((file) => file.endsWith(".txt"));

      if (transcriptFiles.length === 0) {
        return null;
      }

      // Get file stats and sort by modification time
      const fileStats = await Promise.all(
        transcriptFiles.map(async (file) => {
          const filePath = path.join(this.transcriptsDir, file);
          const stats = await fs.promises.stat(filePath);
          return { file, path: filePath, mtime: stats.mtime };
        })
      );

      // Sort by modification time (newest first)
      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      return fileStats[0].path;
    } catch (error) {
      console.error("Error finding most recent transcript:", error);
      return null;
    }
  }

  /**
   * Save current transcript to file
   */
  private async saveTranscriptToFile(): Promise<void> {
    try {
      const topicInfo = this.currentTopic
        ? `Subject: ${this.currentTopic.subject}\nLevel: ${this.currentTopic.academicLevel}\n`
        : "";
      const header = `# Lecture Transcript\nGenerated: ${new Date().toISOString()}\n${topicInfo}\n`;
      const fullContent = header + this.currentTranscript;

      await fs.promises.writeFile(
        this.currentTranscriptPath,
        fullContent,
        "utf8"
      );
      console.log(`📄 Transcript saved to: ${this.currentTranscriptPath}`);
    } catch (error) {
      console.error("Error saving transcript:", error);
      throw error;
    }
  }

  /**
   * Process the most recent transcript to generate notes and flashcards
   */
  private async processTranscriptToNotesAndFlashcards(
    session: AppSession
  ): Promise<void> {
    try {
      if (!this.transcriptProcessor) {
        session.logger.error("Transcript processor not initialized");
        return;
      }

      // Show processing start message
      await session.layouts.showReferenceCard(
        "🤖 Processing Transcript",
        "Generating study notes and flashcards from your lecture...",
        { durationMs: 3000 }
      );

      // Ensure output directories exist
      await this.ensureOutputDirectories();

      // Find the most recent transcript
      const mostRecentTranscript = await this.findMostRecentTranscript();
      if (!mostRecentTranscript) {
        await session.layouts.showReferenceCard(
          "❌ No Transcript Found",
          "Could not find a transcript file to process",
          { durationMs: 3000 }
        );
        return;
      }

      session.logger.info(`📖 Processing transcript: ${mostRecentTranscript}`);

      // Generate custom output paths in separate folders
      const baseName = path.basename(mostRecentTranscript, ".txt");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const notesPath = path.join(this.notesDir, `${baseName}_notes.md`);
      const flashcardsPath = path.join(
        this.flashcardsDir,
        `${baseName}_flashcards.json`
      );

      // Process transcript with custom options
      const result = await this.transcriptProcessor.processTranscriptFile(
        mostRecentTranscript,
        {
          outputDir: undefined, // We'll handle paths manually
          noteStyle: "detailed",
          maxFlashcards: 20,
          flashcardDifficulty: "intermediate",
          focusAreas: this.currentTopic ? [this.currentTopic.subject] : [],
          saveNotes: false, // We'll save manually to custom locations
          saveFlashcards: false,
        }
      );

      // Save to custom locations
      const formattedNotes = `# Lecture Notes

**Source:** ${path.basename(mostRecentTranscript)}  
**Generated:** ${new Date().toLocaleDateString()}
**Subject:** ${this.currentTopic?.subject || "Unknown"}
**Level:** ${this.currentTopic?.academicLevel || "Unknown"}

## Summary

${result.notes.summary}

## Key Points

${result.notes.keyPoints.map((point) => `- ${point}`).join("\n")}

## Detailed Notes

${result.notes.detailedNotes}

---
*Generated automatically from transcript using AI*`;
      await fs.promises.writeFile(notesPath, formattedNotes, "utf8");

      const flashcardsJson = JSON.stringify(result.flashcards, null, 2);
      await fs.promises.writeFile(flashcardsPath, flashcardsJson, "utf8");

      session.logger.info(`📝 Notes saved to: ${notesPath}`);
      session.logger.info(`🃏 Flashcards saved to: ${flashcardsPath}`);

      // Show completion message
      await session.layouts.showReferenceCard(
        "✅ Processing Complete!",
        `Generated ${result.notes.keyPoints.length} key points and ${result.flashcards.cards.length} flashcards\n\nFiles saved to notes/ and flashcards/ folders`,
        { durationMs: 5000 }
      );
    } catch (error) {
      session.logger.error("Failed to process transcript:", error as any);
      await session.layouts.showReferenceCard(
        "❌ Processing Failed",
        "Could not generate notes and flashcards. Please check the logs.",
        { durationMs: 3000 }
      );
    }
  }

  /**
   * Check for keywords in the transcribed text and display definitions
   */
  private async checkForKeywords(
    session: AppSession,
    text: string
  ): Promise<void> {
    if (this.keywordDefinitions.size === 0 || this.isShowingDefinition) {
      return; // No keywords to check or already showing a definition
    }

    const normalizedText = this.normalizeText(text);

    // Sort keywords by length (longest first) to prioritize multi-word terms
    const sortedKeywords = Array.from(this.keywordDefinitions.entries()).sort(
      ([a], [b]) => b.length - a.length
    );

    // Check for keyword matches with permissive matching
    for (const [keyword, definition] of sortedKeywords) {
      const matchResult = this.isPermissiveMatch(normalizedText, keyword);
      if (matchResult.isMatch) {
        session.logger.info(
          `🔍 Keyword detected: "${keyword}" (matched "${matchResult.matchedText}")`
        );
        await this.displayKeywordDefinition(session, keyword, definition);
        break; // Only show one definition at a time
      }
    }
  }

  /**
   * Normalize text for better matching (remove punctuation, normalize spaces)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
      .replace(/\s+/g, " ") // Normalize multiple spaces to single space
      .trim();
  }

  /**
   * Permissive keyword matching that handles variations
   */
  private isPermissiveMatch(
    text: string,
    keyword: string
  ): { isMatch: boolean; matchedText: string } {
    const normalizedKeyword = this.normalizeText(keyword);
    const keywordWords = normalizedKeyword
      .split(" ")
      .filter((word) => word.length > 0);

    // Exact match first (fastest)
    if (text.includes(normalizedKeyword)) {
      return { isMatch: true, matchedText: normalizedKeyword };
    }

    // Hyphenated variation (e.g., "wave-particle duality" vs "wave particle duality")
    const hyphenatedKeyword = keywordWords.join("-");
    if (text.includes(hyphenatedKeyword)) {
      return { isMatch: true, matchedText: hyphenatedKeyword };
    }

    // Check if original keyword had hyphens and spoken version doesn't
    const originalWithSpaces = keyword.toLowerCase().replace(/-/g, " ");
    if (text.includes(originalWithSpaces)) {
      return { isMatch: true, matchedText: originalWithSpaces };
    }

    // Partial match - check if most significant words are present
    if (keywordWords.length >= 2) {
      // For multi-word terms, check if the last 2-3 most significant words are present
      const significantWords = keywordWords.slice(
        -Math.min(3, keywordWords.length)
      );
      const allSignificantWordsPresent = significantWords.every(
        (word) => text.includes(word) && word.length > 2 // Only check words longer than 2 chars
      );

      if (allSignificantWordsPresent) {
        // Additional check: make sure the words appear in reasonable proximity
        const wordPositions = significantWords.map((word) =>
          text.indexOf(word)
        );
        const maxDistance =
          Math.max(...wordPositions) - Math.min(...wordPositions);

        // If words are within reasonable distance (less than 50 characters apart)
        if (maxDistance < 50) {
          return { isMatch: true, matchedText: significantWords.join(" ") };
        }
      }
    }

    // Substring match for single important words (e.g., "field theory" matches "quantum field theory")
    if (keywordWords.length >= 2) {
      const lastWord = keywordWords[keywordWords.length - 1];
      const secondLastWord = keywordWords[keywordWords.length - 2];

      // Check for "X theory", "X duality", "X principle", etc.
      if (
        lastWord.length > 4 &&
        [
          "theory",
          "duality",
          "principle",
          "equation",
          "law",
          "effect",
          "model",
        ].includes(lastWord)
      ) {
        const pattern = `${secondLastWord} ${lastWord}`;
        if (text.includes(pattern)) {
          return { isMatch: true, matchedText: pattern };
        }
      }
    }

    return { isMatch: false, matchedText: "" };
  }

  /**
   * Display keyword definition on screen
   */
  private async displayKeywordDefinition(
    session: AppSession,
    keyword: string,
    definition: string
  ): Promise<void> {
    try {
      this.isShowingDefinition = true;

      // Use the full definition without truncation
      const displayDefinition = definition.trim();

      // Use TextWall layout for reliable display
      const textWallContent = `💡 ${keyword.toUpperCase()}\n\n${displayDefinition}`;

      session.logger.info(
        `📖 Displaying definition - Keyword: "${keyword}", Length: ${displayDefinition.length} chars`
      );
      session.logger.info(`📖 Definition content: "${displayDefinition}"`);

      await session.layouts.showTextWall(textWallContent, {
        durationMs: DISPLAY_DURATION_MS.KEYWORD_DEFINITION,
      });

      session.logger.info(
        `📖 Successfully displayed definition for: ${keyword}`
      );

      // Reset the flag after the display duration
      setTimeout(() => {
        this.isShowingDefinition = false;
      }, DISPLAY_DURATION_MS.KEYWORD_DEFINITION);
    } catch (error) {
      session.logger.error(
        `Failed to display definition for ${keyword}:`,
        error as any
      );
      this.isShowingDefinition = false;
    }
  }

  /**
   * Save keyword-definition mappings to JSON file
   */
  private async saveKeywordMappings(): Promise<void> {
    try {
      // Create fresh mappings object for this lecture only
      const mappings = {
        topic: this.currentTopic,
        generatedAt: new Date().toISOString(),
        totalKeywords: this.keywordDefinitions.size,
        keywords: Object.fromEntries(this.keywordDefinitions),
      };

      // Overwrite the file completely (not append)
      await fs.promises.writeFile(
        this.keywordMappingsPath,
        JSON.stringify(mappings, null, 2),
        "utf8"
      );

      console.log(
        `📋 Keyword mappings overwritten with ${mappings.totalKeywords} keywords: ${this.keywordMappingsPath}`
      );
    } catch (error) {
      console.error("Error saving keyword mappings:", error);
      throw error;
    }
  }

  /**
   * Check if command is a start lecture command
   */
  private isStartLectureCommand(command: string): boolean {
    const startPatterns = [
      // Direct commands
      "start lecture",
      "start the lecture",
      "begin lecture",
      "begin the lecture",
      "commence lecture",
      "commence the lecture",
      "starting lecture",
      "starting the lecture",
      "let's start lecture",
      "let's start the lecture",
      "let's begin lecture",
      "let's begin the lecture",
      // Variations
      "start recording",
      "begin recording",
      "commence recording",
      "starting recording",
      "let's start recording",
      "start class",
      "begin class",
      "starting class",
    ];

    return startPatterns.some((pattern) => command.includes(pattern));
  }

  /**
   * Check if command is a stop lecture command
   */
  private isStopLectureCommand(command: string): boolean {
    const stopPatterns = [
      // Direct commands
      "stop lecture",
      "stop the lecture",
      "end lecture",
      "end the lecture",
      "finish lecture",
      "finish the lecture",
      "conclude lecture",
      "conclude the lecture",
      "stopping lecture",
      "stopping the lecture",
      "ending lecture",
      "ending the lecture",
      // Variations
      "stop recording",
      "end recording",
      "finish recording",
      "conclude recording",
      "stopping recording",
      "ending recording",
      "stop class",
      "end class",
      "finish class",
      "that's it",
      "we're done",
      "lecture over",
      "class over",
    ];

    return stopPatterns.some((pattern) => command.includes(pattern));
  }
}

// Start the application
const app = new LectureAssistantApp();
app.start();

console.log(
  "🎓 Simple Lecture Assistant started - Ready to record transcripts!"
);
