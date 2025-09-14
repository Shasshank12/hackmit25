import { AppServer, AppSession, AppServerConfig } from "@mentra/sdk";
import * as fs from "fs";
import * as path from "path";

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
    session.events.onTranscription((data) => {
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

        // If recording, add to transcript
        if (this.isRecording) {
          const timestamp = new Date().toISOString();
          const transcriptLine = `[${timestamp}] ${data.text}\n`;

          this.currentTranscript += transcriptLine;
          session.logger.info(`Added to transcript: "${data.text}"`);
        } else {
          session.logger.info(
            `🎤 Speech detected but not recording: "${data.text}"`
          );
        }
      }
    });

    session.logger.info("✅ Transcription listener setup complete");
  }

  /**
   * Start recording transcript
   */
  private async startRecording(session: AppSession): Promise<void> {
    if (this.isRecording) {
      session.logger.info("Already recording");
      return;
    }

    this.isRecording = true;
    this.currentTranscript = "";

    session.logger.info("🎙️ Started recording");
    await session.layouts.showTextWall(
      "🎙️ Recording Started\n\nListening for speech...\n\nSay 'stop lecture' to finish",
      { durationMs: 3000 }
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
}

// Start the application
const app = new LectureAssistantApp();
app.start();

console.log(
  "🎓 Simple Lecture Assistant started - Ready to record transcripts!"
);
