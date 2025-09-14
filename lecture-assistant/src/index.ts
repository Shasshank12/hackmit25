import "dotenv/config";
import { AppServer, AppSession, AppServerConfig } from "@mentra/sdk";
import * as fs from "fs";
import * as path from "path";
import { TopicCollector } from "./agents/topic-collector";
import { KeywordGenerator } from "./agents/keyword-generator";
import { TranscriptToNotesProcessor } from "./transcript-to-notes";
import { LectureTopic, FlashcardSet } from "./types";
import { DISPLAY_DURATION_MS } from "./config";
import { QuizManager } from "./quiz/quiz-manager";

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
// doesn't allow you to properly exit flashcard mode
// definnitions are far too long
// saying topics is impermissive
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
  private sortedKeywords: [string, string][] = [];
  private keywordCache: Map<string, { isMatch: boolean; matchedText: string }> =
    new Map();
  private lastProcessedText: string = "";
  private recentKeywords: Set<string> = new Set();
  private notesDir: string = path.join(process.cwd(), "notes");
  private flashcardsDir: string = path.join(process.cwd(), "flashcards");
  private currentMode: "menu" | "flashcard" = "menu";
  private quizManager: QuizManager | null = null;
  private isTransitioning: boolean = false;

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

    // Add API endpoints for web dashboard
    this.setupAPIEndpoints();
  }

  /**
   * Setup API endpoints for web dashboard
   */
  private setupAPIEndpoints(): void {
    try {
      // Try to access the express app instance
      const app = (this as any).app;

      if (!app) {
        console.error("❌ Could not access Express app instance");
        return;
      }

      // Add CORS headers for web dashboard
      app.use((req: any, res: any, next: any) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, OPTIONS"
        );
        res.header(
          "Access-Control-Allow-Headers",
          "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        );
        if (req.method === "OPTIONS") {
          res.sendStatus(200);
        } else {
          next();
        }
      });

      // API endpoint to get the latest notes
      app.get("/api/notes/latest", async (req: any, res: any) => {
        try {
          const notesDir = path.join(process.cwd(), "notes");
          const latestNotes = await this.getLatestNotesFile(notesDir);

          if (!latestNotes) {
            return res.json({
              success: false,
              message: "No notes found",
              content: "",
              lastUpdated: null,
              topic: null,
            });
          }

          const content = await fs.promises.readFile(
            latestNotes.filePath,
            "utf-8"
          );

          res.json({
            success: true,
            content: content,
            lastUpdated: latestNotes.lastModified,
            topic: latestNotes.topic,
            filename: latestNotes.filename,
          });
        } catch (error) {
          console.error("Error fetching latest notes:", error);
          res.status(500).json({
            success: false,
            message: "Error fetching notes",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });

      console.log("📡 API endpoints setup complete");
    } catch (error) {
      console.error("❌ Error setting up API endpoints:", error);
    }
  }

  /**
   * Get the latest notes file from all topic directories
   */
  private async getLatestNotesFile(notesDir: string): Promise<{
    filePath: string;
    lastModified: Date;
    topic: string;
    filename: string;
  } | null> {
    try {
      if (!fs.existsSync(notesDir)) {
        return null;
      }

      let latestFile: {
        filePath: string;
        lastModified: Date;
        topic: string;
        filename: string;
      } | null = null;

      // Read all topic directories
      const topicDirs = await fs.promises.readdir(notesDir, {
        withFileTypes: true,
      });

      for (const dir of topicDirs) {
        if (dir.isDirectory()) {
          const topicPath = path.join(notesDir, dir.name);
          const files = await fs.promises.readdir(topicPath);

          for (const file of files) {
            if (file.endsWith(".md")) {
              const filePath = path.join(topicPath, file);
              const stats = await fs.promises.stat(filePath);

              if (!latestFile || stats.mtime > latestFile.lastModified) {
                latestFile = {
                  filePath,
                  lastModified: stats.mtime,
                  topic: dir.name,
                  filename: file,
                };
              }
            }
          }
        }
      }

      return latestFile;
    } catch (error) {
      console.error("Error getting latest notes file:", error);
      return null;
    }
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
      this.currentMode = "menu";
      const menuText =
        "Lecture Assistant\n\nSay 'lecture mode' to start recording\nSay 'card mode' or 'flashcard mode' to study\n\nReady!";
      await session.layouts.showTextWall(menuText);
      session.logger.info("✅ Main menu displayed");
    } catch (error) {
      session.logger.error(error as any, "❌ Failed to show main menu");
      await session.layouts.showTextWall("Ready");
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

        // Skip processing if we're transitioning between modes
        if (this.isTransitioning) {
          return;
        }

        // Check for flashcard mode command first
        if (
          this.currentMode === "menu" &&
          this.isFlashcardModeCommand(command)
        ) {
          session.logger.info(
            `🃏 Flashcard mode command detected: "${data.text}"`
          );
          this.startFlashcardMode(session);
          return;
        }

        // Check for start lecture commands (includes "lecture mode")
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

        // Handle flashcard mode commands
        if (this.currentMode === "flashcard") {
          // Always allow exit commands, even during active quiz
          if (this.isExitFlashcardCommand(command)) {
            session.logger.info(
              `🚪 Exit flashcard command detected: "${data.text}"`
            );

            // If quiz is active, stop it first
            if (this.quizManager && this.quizManager.isActive()) {
              session.logger.info(`🛑 Stopping active quiz before exit...`);
              await this.quizManager.stopQuiz();
            }

            this.exitFlashcardMode(session);
            return;
          }

          // Skip other processing if quiz is actively running to avoid interference
          if (this.quizManager && this.quizManager.isActive()) {
            session.logger.info(
              `🎯 Quiz active - main listener skipping non-exit transcription processing`
            );
            return;
          }
        }

        // If recording, add to transcript and check for keywords
        if (this.isRecording) {
          if (data.isFinal) {
            const timestamp = new Date().toISOString();
            const transcriptLine = `[${timestamp}] ${data.text}\n`;
            this.currentTranscript += transcriptLine;
            session.logger.info(`Added to transcript: "${data.text}"`);
          }

          // Check for keywords in real-time (both partial and final transcriptions)
          await this.checkForKeywordsStreaming(
            session,
            data.text,
            data.isFinal
          );
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
   * Start flashcard mode
   */
  private async startFlashcardMode(session: AppSession): Promise<void> {
    // Set transitioning flag to prevent race conditions
    this.isTransitioning = true;
    this.currentMode = "flashcard";

    // Get available topics from flashcard folders
    const availableTopics = await this.getAvailableTopics();

    if (availableTopics.length === 0) {
      await session.layouts.showTextWall(
        "No Flashcards Found\n\nNo flashcard sets available.\nComplete some lectures first!\n\nReturning to main menu..."
      );
      setTimeout(() => {
        this.showMainMenu(session);
        this.isTransitioning = false;
      }, 3000);
      return;
    }

    // Show topic selection
    await this.showTopicSelection(session, availableTopics);
    // Clear transitioning flag after topic selection is shown
    this.isTransitioning = false;
  }

  /**
   * Exit flashcard mode and return to main menu
   */
  private async exitFlashcardMode(session: AppSession): Promise<void> {
    // Set transitioning flag to prevent re-entry
    this.isTransitioning = true;

    if (this.quizManager && this.quizManager.isActive()) {
      await this.quizManager.stopQuiz();
    }
    this.quizManager = null;
    this.currentMode = "menu";

    await session.layouts.showTextWall(
      "Exiting Flashcard Mode\n\nReturning to main menu..."
    );

    setTimeout(() => {
      this.showMainMenu(session);
      // Clear transitioning flag after showing menu
      this.isTransitioning = false;
    }, 2000);
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
    this.keywordCache.clear();
    this.sortedKeywords = [];
    this.recentKeywords.clear();
    this.lastProcessedText = "";
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

      // Build sorted keywords cache for faster lookup
      this.buildKeywordCache();

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

      // Show initial processing message
      await session.layouts.showTextWall(
        "Processing Lecture...\n\nPreparing to generate notes and flashcards\n\nPlease wait, this may take a moment"
      );

      // Ensure output directories exist
      await this.ensureOutputDirectories();

      // Find the most recent transcript
      const mostRecentTranscript = await this.findMostRecentTranscript();
      if (!mostRecentTranscript) {
        await session.layouts.showTextWall(
          "No Transcript Found\n\nCould not find a transcript file to process\n\nReturning to main menu..."
        );
        setTimeout(() => this.showMainMenu(session), 3000);
        return;
      }

      session.logger.info(`📖 Processing transcript: ${mostRecentTranscript}`);

      // Show progress: analyzing transcript
      await session.layouts.showTextWall(
        "Processing Lecture...\n\nAnalyzing transcript content\n\nGenerating study materials..."
      );

      // Generate custom output paths organized by topic
      const baseName = path.basename(mostRecentTranscript, ".txt");
      const topicName =
        this.currentTopic?.subject?.toLowerCase().replace(/\s+/g, "-") ||
        "unknown";

      // Ensure topic directories exist
      const topicNotesDir = path.join(this.notesDir, topicName);
      const topicFlashcardsDir = path.join(this.flashcardsDir, topicName);
      await fs.promises.mkdir(topicNotesDir, { recursive: true });
      await fs.promises.mkdir(topicFlashcardsDir, { recursive: true });

      const notesPath = path.join(topicNotesDir, `${baseName}_notes.md`);
      const flashcardsPath = path.join(
        topicFlashcardsDir,
        `${baseName}_flashcards.json`
      );

      // Show progress: processing with AI
      await session.layouts.showTextWall(
        "Processing Lecture...\n\nAI is analyzing your lecture content\n\nThis may take 30-60 seconds..."
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

      // Show progress: saving files
      await session.layouts.showTextWall(
        "Processing Lecture...\n\nSaving notes and flashcards to files\n\nAlmost complete..."
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
      await session.layouts.showTextWall(
        `Processing Complete!\n\nGenerated ${result.notes.keyPoints.length} key points and ${result.flashcards.cards.length} flashcards\n\nFiles saved successfully`
      );

      // Return to main menu after showing completion
      setTimeout(() => this.showMainMenu(session), 5000);
    } catch (error) {
      session.logger.error("Failed to process transcript:", error as any);
      await session.layouts.showTextWall(
        "Processing Failed\n\nCould not generate notes and flashcards\n\nPlease check the logs and try again"
      );
      setTimeout(() => this.showMainMenu(session), 4000);
    }
  }

  /**
   * Build keyword cache for faster lookup
   */
  private buildKeywordCache(): void {
    // Sort keywords by length (longest first) to prioritize multi-word terms
    this.sortedKeywords = Array.from(this.keywordDefinitions.entries()).sort(
      ([a], [b]) => b.length - a.length
    );

    // Clear the match cache when rebuilding
    this.keywordCache.clear();

    console.log(
      `📚 Built keyword cache with ${this.sortedKeywords.length} keywords`
    );
  }

  /**
   * Check for keywords in streaming transcription (real-time)
   */
  private async checkForKeywordsStreaming(
    session: AppSession,
    text: string,
    isFinal: boolean
  ): Promise<void> {
    if (this.sortedKeywords.length === 0 || this.isShowingDefinition) {
      return;
    }

    // Process all speech immediately for instant keyword detection
    const startTime = Date.now();
    const normalizedText = this.normalizeText(text);

    // Process ALL text immediately for maximum responsiveness
    // Skip only if text is too short to contain meaningful keywords
    if (normalizedText.length < 2) return;

    session.logger.info(
      `🔍 Processing ${isFinal ? "FINAL" : "PARTIAL"} text: "${text}" (${
        text.length
      } chars)`
    );

    let textToProcess = normalizedText;

    // Update last processed text
    if (!isFinal) {
      this.lastProcessedText = normalizedText;
    } else {
      this.lastProcessedText = "";
      // Clear recent keywords for final text to allow re-detection
      setTimeout(() => this.recentKeywords.clear(), 10000); // Clear after 10 seconds
    }

    await this.detectKeywordsInText(session, textToProcess);

    const processingTime = Date.now() - startTime;
    session.logger.info(
      `⚡ Keyword detection took ${processingTime}ms for text: "${text}"`
    );
  }

  /**
   * Check for keywords in the transcribed text and display definitions (optimized)
   */
  private async checkForKeywords(
    session: AppSession,
    text: string
  ): Promise<void> {
    if (this.sortedKeywords.length === 0 || this.isShowingDefinition) {
      return; // No keywords to check or already showing a definition
    }

    await this.detectKeywordsInText(session, this.normalizeText(text));
  }

  /**
   * Core keyword detection with sliding window for continuous speech
   */
  private async detectKeywordsInText(
    session: AppSession,
    normalizedText: string
  ): Promise<void> {
    // Check cache first for this exact text
    const cacheKey = normalizedText;
    if (this.keywordCache.has(cacheKey)) {
      const cachedResult = this.keywordCache.get(cacheKey)!;
      if (cachedResult.isMatch) {
        const matchedKeyword = this.sortedKeywords.find(
          ([keyword]) =>
            this.normalizeText(keyword) === cachedResult.matchedText ||
            keyword.toLowerCase() === cachedResult.matchedText
        );
        if (matchedKeyword && !this.recentKeywords.has(matchedKeyword[0])) {
          this.recentKeywords.add(matchedKeyword[0]);
          await this.displayKeywordDefinition(
            session,
            matchedKeyword[0],
            matchedKeyword[1]
          );
        }
      }
      return;
    }

    // Sliding window approach for continuous speech
    const words = normalizedText.split(" ").filter((word) => word.length > 0);

    // Try different window sizes to catch multi-word keywords
    for (
      let windowSize = Math.min(5, words.length);
      windowSize >= 1;
      windowSize--
    ) {
      for (let i = 0; i <= words.length - windowSize; i++) {
        const window = words.slice(i, i + windowSize).join(" ");

        // Fast keyword matching for this window
        for (const [keyword, definition] of this.sortedKeywords) {
          if (this.recentKeywords.has(keyword)) continue; // Skip recently shown keywords

          const normalizedKeyword = this.normalizeText(keyword);

          // Fast exact match check
          if (
            window === normalizedKeyword ||
            window.includes(normalizedKeyword)
          ) {
            session.logger.info(
              `🔍 Keyword detected: "${keyword}" in window: "${window}"`
            );
            this.recentKeywords.add(keyword);
            this.keywordCache.set(cacheKey, {
              isMatch: true,
              matchedText: normalizedKeyword,
            });
            await this.displayKeywordDefinition(session, keyword, definition);
            return; // Found a match, stop processing
          }

          // Only do expensive permissive matching for multi-word terms
          if (normalizedKeyword.includes(" ") && windowSize > 1) {
            const matchResult = this.isPermissiveMatch(window, keyword);
            if (matchResult.isMatch) {
              session.logger.info(
                `🔍 Keyword detected: "${keyword}" (matched "${matchResult.matchedText}") in window: "${window}"`
              );
              this.recentKeywords.add(keyword);
              this.keywordCache.set(cacheKey, matchResult);
              await this.displayKeywordDefinition(session, keyword, definition);
              return; // Found a match, stop processing
            }
          }
        }
      }
    }

    // Cache negative result to avoid re-checking
    this.keywordCache.set(cacheKey, { isMatch: false, matchedText: "" });
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

      const displayTime = Date.now();
      session.logger.info(
        `📖 [${new Date(
          displayTime
        ).toLocaleTimeString()}] Displaying definition - Keyword: "${keyword}", Length: ${
          displayDefinition.length
        } chars`
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
      // Lecture mode commands
      "lecture mode",
      "start lecture mode",
      "begin lecture mode",
      "enter lecture mode",
      "lecture",
      "start lecture",
      "begin lecture",
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

  /**
   * Check if command is a flashcard mode command
   */
  private isFlashcardModeCommand(command: string): boolean {
    const flashcardModePatterns = [
      // Direct commands
      "flashcard mode",
      "flashcards mode",
      "flash card mode",
      "flash cards mode",
      "card mode",
      "cards mode",
      // Variations with start/begin
      "start flashcard mode",
      "start flashcards mode",
      "start flash card mode",
      "start flash cards mode",
      "start card mode",
      "start cards mode",
      "begin flashcard mode",
      "begin flashcards mode",
      "begin flash card mode",
      "begin flash cards mode",
      "begin card mode",
      "begin cards mode",
      "enter flashcard mode",
      "enter flashcards mode",
      "enter flash card mode",
      "enter flash cards mode",
      "enter card mode",
      "enter cards mode",
      // Alternative names
      "quiz mode",
      "study mode",
      "test mode",
      "review mode",
      "flashcard",
      "flashcards",
      "flash card",
      "flash cards",
      "start flashcard",
      "start flashcards",
      "begin flashcard",
      "begin flashcards",
      "let's do flashcards",
      "let's study flashcards",
      "time for flashcards",
    ];
    return flashcardModePatterns.some((pattern) => command.includes(pattern));
  }

  /**
   * Check if command is an exit flashcard command
   */
  private isExitFlashcardCommand(command: string): boolean {
    const exitPatterns = [
      // Direct exit commands
      "exit flashcard",
      "exit flashcards",
      "exit flash card",
      "exit flash cards",
      "exit card",
      "exit cards",
      "stop flashcard",
      "stop flashcards",
      "stop flash card",
      "stop flash cards",
      "stop card",
      "stop cards",
      "end flashcard",
      "end flashcards",
      "end flash card",
      "end flash cards",
      "end card",
      "end cards",
      "quit flashcard",
      "quit flashcards",
      "quit flash card",
      "quit flash cards",
      "quit card",
      "quit cards",
      "finish flashcard",
      "finish flashcards",
      "done with flashcard",
      "done with flashcards",
      // Navigation commands
      "back to menu",
      "main menu",
      "go back",
      "return to menu",
      "home",
      "exit",
      "quit",
      "stop",
      "done",
      "finished",
      "that's it",
      "we're done",
      "cancel",
    ];
    return exitPatterns.some((pattern) => command.includes(pattern));
  }

  /**
   * Find matching topic with permissive matching
   */
  private findMatchingTopic(
    userInput: string,
    availableTopics: string[]
  ): string | undefined {
    // Normalize user input: lowercase, remove punctuation, normalize spaces
    const normalizeText = (text: string): string => {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
        .replace(/\s+/g, " ") // Normalize multiple spaces to single space
        .trim();
    };

    const normalizedInput = normalizeText(userInput);

    // Try different matching strategies
    for (const topic of availableTopics) {
      const normalizedTopic = normalizeText(topic);

      // Strategy 1: Exact match after normalization
      if (normalizedInput === normalizedTopic) {
        return topic;
      }

      // Strategy 2: Input contains topic or topic contains input
      if (
        normalizedInput.includes(normalizedTopic) ||
        normalizedTopic.includes(normalizedInput)
      ) {
        return topic;
      }

      // Strategy 3: Word-by-word matching
      const inputWords = normalizedInput
        .split(" ")
        .filter((word) => word.length > 0);
      const topicWords = normalizedTopic
        .split(" ")
        .filter((word) => word.length > 0);

      // Check if all input words are found in topic words (or vice versa for shorter inputs)
      if (inputWords.length <= topicWords.length) {
        const allInputWordsFound = inputWords.every((inputWord) =>
          topicWords.some(
            (topicWord) =>
              topicWord.includes(inputWord) || inputWord.includes(topicWord)
          )
        );
        if (allInputWordsFound) {
          return topic;
        }
      }

      // Strategy 4: Check if most topic words are in input (for longer inputs)
      if (inputWords.length > topicWords.length) {
        const matchingWords = topicWords.filter((topicWord) =>
          inputWords.some(
            (inputWord) =>
              inputWord.includes(topicWord) || topicWord.includes(inputWord)
          )
        );
        // If most topic words match, consider it a match
        if (matchingWords.length >= Math.ceil(topicWords.length * 0.7)) {
          return topic;
        }
      }

      // Strategy 5: Partial matching for common abbreviations/variations
      const commonMappings: { [key: string]: string[] } = {
        math: ["mathematics", "maths"],
        mathematics: ["math", "maths"],
        history: ["hist"],
        physics: ["phys"],
        chemistry: ["chem"],
        biology: ["bio"],
        "computer science": ["cs", "comp sci", "compsci"],
        "american history": ["american-history", "us-history", "us history"],
      };

      // Check if input matches any common variations
      for (const [key, variations] of Object.entries(commonMappings)) {
        if (
          normalizedInput.includes(key) ||
          variations.some((v) => normalizedInput.includes(v))
        ) {
          if (
            normalizedTopic.includes(key) ||
            variations.some((v) => normalizedTopic.includes(v))
          ) {
            return topic;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Get available topics from flashcard directories
   */
  private async getAvailableTopics(): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(this.flashcardsDir, {
        withFileTypes: true,
      });
      const topics = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
      return topics;
    } catch (error) {
      console.error("Error reading flashcard directories:", error);
      return [];
    }
  }

  /**
   * Show topic selection for flashcard mode
   */
  private async showTopicSelection(
    session: AppSession,
    topics: string[]
  ): Promise<void> {
    const topicList = topics
      .map(
        (topic, index) =>
          `${index + 1}. ${topic.charAt(0).toUpperCase() + topic.slice(1)}`
      )
      .join("\n");

    await session.layouts.showTextWall(
      `Choose a Topic\n\n${topicList}\n\nSay the topic name you want to study\nor say 'exit' to return to menu`
    );

    // Set up listener for topic selection
    this.setupTopicSelectionListener(session, topics);
  }

  /**
   * Setup listener for topic selection in flashcard mode
   */
  private setupTopicSelectionListener(
    session: AppSession,
    availableTopics: string[]
  ): void {
    const unsubscribe = session.events.onTranscription(async (data) => {
      if (data.isFinal && data.text.trim().length > 0) {
        const command = data.text.toLowerCase().trim();

        // Check for exit command
        if (this.isExitFlashcardCommand(command)) {
          unsubscribe();
          await this.exitFlashcardMode(session);
          return;
        }

        // Find matching topic with permissive matching
        const selectedTopic = this.findMatchingTopic(command, availableTopics);

        if (selectedTopic) {
          unsubscribe();
          await this.startFlashcardQuiz(session, selectedTopic);
        } else {
          // Invalid topic, show selection again
          await session.layouts.showReferenceCard(
            "Topic Not Found",
            `"${data.text}" not found. Please try again.`,
            { durationMs: 2000 }
          );
          setTimeout(() => {
            this.showTopicSelection(session, availableTopics);
          }, 2000);
        }
      }
    });
  }

  /**
   * Start flashcard quiz for selected topic
   */
  private async startFlashcardQuiz(
    session: AppSession,
    topic: string
  ): Promise<void> {
    try {
      // Load flashcard set for the topic
      const flashcardSet = await this.loadFlashcardSet(topic);

      if (!flashcardSet || flashcardSet.cards.length === 0) {
        await session.layouts.showTextWall(
          `No Flashcards\n\nNo flashcards found for ${topic}\n\nReturning to topic selection...`
        );
        setTimeout(() => {
          this.getAvailableTopics().then((topics) => {
            this.showTopicSelection(session, topics);
          });
        }, 3000);
        return;
      }

      // Initialize quiz manager and start quiz
      this.quizManager = new QuizManager(session);
      await this.quizManager.startQuiz(flashcardSet);

      // Set up completion listener
      this.setupQuizCompletionListener(session);
    } catch (error) {
      session.logger.error("Failed to start flashcard quiz:", error as any);
      await session.layouts.showTextWall(
        "Quiz Error\n\nFailed to load flashcards\n\nReturning to main menu..."
      );
      setTimeout(() => this.showMainMenu(session), 3000);
    }
  }

  /**
   * Load flashcard set for a topic
   */
  private async loadFlashcardSet(topic: string): Promise<FlashcardSet | null> {
    try {
      const topicDir = path.join(this.flashcardsDir, topic);
      const files = await fs.promises.readdir(topicDir);
      const flashcardFiles = files.filter((file) =>
        file.endsWith("_flashcards.json")
      );

      if (flashcardFiles.length === 0) {
        return null;
      }

      // Load the most recent flashcard file
      const mostRecentFile = flashcardFiles.sort().pop()!;
      const filePath = path.join(topicDir, mostRecentFile);
      const content = await fs.promises.readFile(filePath, "utf8");
      const flashcardSet: FlashcardSet = JSON.parse(content);

      return flashcardSet;
    } catch (error) {
      console.error(`Error loading flashcard set for topic ${topic}:`, error);
      return null;
    }
  }

  /**
   * Setup quiz completion listener
   */
  private setupQuizCompletionListener(session: AppSession): void {
    const checkCompletion = () => {
      if (this.quizManager && !this.quizManager.isActive()) {
        // Quiz completed, show congratulations and return to menu
        setTimeout(async () => {
          await session.layouts.showReferenceCard(
            "Great Job!",
            "Flashcard session complete!\n\nReturning to main menu...",
            { durationMs: 3000 }
          );
          setTimeout(() => this.showMainMenu(session), 3000);
        }, 1000);
      } else if (this.quizManager) {
        // Still active, check again in 1 second
        setTimeout(checkCompletion, 1000);
      }
    };

    // Start checking after a short delay
    setTimeout(checkCompletion, 1000);
  }
}

// Start the application
const app = new LectureAssistantApp();
app.start();

console.log(
  "🎓 Simple Lecture Assistant started - Ready to record transcripts!"
);
