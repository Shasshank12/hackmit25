import "dotenv/config";
import { AppServer, AppSession, AppServerConfig } from "@mentra/sdk";
import * as fs from "fs";
import * as path from "path";
import { TopicCollector } from "./agents/topic-collector";
import { KeywordGenerator } from "./agents/keyword-generator";
import { LectureTopic } from "./types";
import { DISPLAY_DURATION_MS } from "./config";

// it can't capture multi word terms
// more validation of subject matter
// more validation of level
// overwrite keyword-mappings
// make term-definitions persist for 5 seconds
// have a list of transcripts

/**
 * Simple Lecture Assistant - Records transcripts to file
 */
class LectureAssistantApp extends AppServer {
  private isRecording: boolean = false;
  private currentTranscript: string = "";
  private transcriptFilePath: string = path.join(
    process.cwd(),
    "transcript.txt"
  );
  private keywordMappingsPath: string = path.join(
    process.cwd(),
    "keyword-mappings.json"
  );
  private topicCollector: TopicCollector | null = null;
  private keywordGenerator: KeywordGenerator | null = null;
  private currentTopic: LectureTopic | null = null;
  private keywordDefinitions: Map<string, string> = new Map();

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
        "🎓 Lecture Assistant\n\nSay 'start lecture' to begin recording\n\nReady to record!";
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

      if (
        command.includes("start lecture") ||
        command.includes("begin lecture")
      ) {
        session.logger.info("🚀 Starting recording via voice event");
        await this.startRecording(session);
      } else if (
        command.includes("stop lecture") ||
        command.includes("end lecture")
      ) {
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
        if (
          !this.isRecording &&
          (command.includes("start lecture") ||
            command.includes("begin lecture"))
        ) {
          session.logger.info(`🚀 Voice command detected: "${data.text}"`);
          this.startRecording(session);
          return;
        }

        if (
          this.isRecording &&
          (command.includes("stop lecture") || command.includes("end lecture"))
        ) {
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
      // Generate keyword-definition mappings
      await session.layouts.showTextWall(
        "🔄 Generating keywords...\n\nPlease wait while we prepare your lecture assistant",
        { durationMs: 3000 }
      );

      const keywords = await this.keywordGenerator!.generateKeywords(topic);

      // Generate definitions for each keyword
      for (const keyword of keywords) {
        const definition = await this.keywordGenerator!.generateDefinition(
          keyword,
          topic
        );
        this.keywordDefinitions.set(keyword.toLowerCase(), definition);
      }

      // Save mappings to JSON file
      await this.saveKeywordMappings();

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

    session.logger.info("🎙️ Started recording");
    const topicInfo = this.currentTopic
      ? `Subject: ${this.currentTopic.subject}\nLevel: ${this.currentTopic.academicLevel}\n\n`
      : "";

    await session.layouts.showTextWall(
      `🎙️ Recording Started\n\n${topicInfo}Listening for speech...\n\nSay 'stop lecture' to finish`,
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
      await session.layouts.showTextWall(
        "✅ Recording Complete!\n\nTranscript saved to transcript.txt\n\nSay 'start lecture' for new recording",
        { durationMs: 5000 }
      );

      // Return to main menu after delay
      setTimeout(async () => {
        await this.showMainMenu(session);
      }, 6000);
    } catch (error) {
      session.logger.error("Failed to save transcript:", error as any);
      await session.layouts.showTextWall("❌ Error saving transcript");
    }
  }

  /**
   * Save current transcript to file
   */
  private async saveTranscriptToFile(): Promise<void> {
    try {
      const header = `# Lecture Transcript\nGenerated: ${new Date().toISOString()}\n\n`;
      const fullContent = header + this.currentTranscript;

      await fs.promises.writeFile(this.transcriptFilePath, fullContent, "utf8");
      console.log(`📄 Transcript saved to: ${this.transcriptFilePath}`);
    } catch (error) {
      console.error("Error saving transcript:", error);
      throw error;
    }
  }

  /**
   * Check for keywords in the transcribed text and display definitions
   */
  private async checkForKeywords(
    session: AppSession,
    text: string
  ): Promise<void> {
    if (this.keywordDefinitions.size === 0) {
      return; // No keywords to check
    }

    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);

    // Check each word and phrase for keyword matches
    for (const [keyword, definition] of this.keywordDefinitions.entries()) {
      if (lowerText.includes(keyword)) {
        session.logger.info(`🔍 Keyword detected: "${keyword}"`);
        await this.displayKeywordDefinition(session, keyword, definition);
        break; // Only show one definition at a time to avoid overwhelming the user
      }
    }
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
      const displayText = `💡 ${keyword.toUpperCase()}\n\n${definition}`;

      await session.layouts.showTextWall(displayText, {
        durationMs: DISPLAY_DURATION_MS.KEYWORD_DEFINITION,
      });

      session.logger.info(`📖 Displayed definition for: ${keyword}`);
    } catch (error) {
      session.logger.error(
        `Failed to display definition for ${keyword}:`,
        error as any
      );
    }
  }

  /**
   * Save keyword-definition mappings to JSON file
   */
  private async saveKeywordMappings(): Promise<void> {
    try {
      const mappings = {
        topic: this.currentTopic,
        generatedAt: new Date().toISOString(),
        keywords: Object.fromEntries(this.keywordDefinitions),
      };

      await fs.promises.writeFile(
        this.keywordMappingsPath,
        JSON.stringify(mappings, null, 2),
        "utf8"
      );

      console.log(`📋 Keyword mappings saved to: ${this.keywordMappingsPath}`);
    } catch (error) {
      console.error("Error saving keyword mappings:", error);
      throw error;
    }
  }
}

// Start the application
const app = new LectureAssistantApp();
app.start();

console.log(
  "🎓 Simple Lecture Assistant started - Ready to record transcripts!"
);
