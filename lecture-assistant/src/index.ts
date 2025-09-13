import { AppServer, AppSession, AppServerConfig } from "@mentra/sdk";
import { LectureManager } from "./LectureManager";
import { KeyTermExtractor } from "./KeyTermExtractor";
import { DatabaseManager } from "./DatabaseManager";

interface ButtonEvent {
  action: string;
  button?: string;
}

interface VoiceEvent {
  transcript: string;
  confidence?: number;
}

interface SensorEvent {
  accelerometer?: {
    x: number;
    y: number;
    z: number;
  };
  gyroscope?: {
    x: number;
    y: number;
    z: number;
  };
}

class LectureAssistantApp extends AppServer {
  private lectureManager: LectureManager;
  private keyTermExtractor: KeyTermExtractor;
  private databaseManager: DatabaseManager;

  constructor() {
    const config: AppServerConfig = {
      port: parseInt(process.env.PORT || "3000"),
      packageName: process.env.PACKAGE_NAME || "com.hackmit.lectureassistant",
      apiKey:
        process.env.MENTRAOS_API_KEY ||
        "697793ee97a6e87a48fe3ae4be6f358798c3103d36522073b70f4b2c95be2964",
    };

    console.log(`🔧 [${new Date().toISOString()}] App config:`, {
      port: config.port,
      packageName: config.packageName,
      apiKeySet: !!config.apiKey,
    });

    super(config);
    this.lectureManager = new LectureManager();
    this.keyTermExtractor = new KeyTermExtractor();
    this.databaseManager = new DatabaseManager();
  }

  protected async onSession(
    session: AppSession,
    sessionId: string,
    userId: string
  ): Promise<void> {
    try {
      console.log(
        `🔗 [${new Date().toISOString()}] New session started: ${sessionId} for user: ${userId}`
      );

      // Initialize the session with the main menu
      await this.showMainMenu(session);

      // Set up event listeners
      await this.setupEventListeners(session, sessionId, userId);

      console.log(
        `✅ [${new Date().toISOString()}] Session setup complete: ${sessionId}`
      );
    } catch (error) {
      console.error(
        `❌ [${new Date().toISOString()}] Session setup failed: ${sessionId}`,
        error
      );
      // Try to show a simple error message
      try {
        await session.layouts.showTextWall("App Error - Please restart");
      } catch (displayError) {
        console.error("Failed to display error message:", displayError);
      }
    }
  }

  private async showMainMenu(session: AppSession): Promise<void> {
    try {
      console.log(`📱 [${new Date().toISOString()}] Showing main menu`);

      // Try simple text first
      await session.layouts.showTextWall("Lecture Assistant Ready");

      console.log(
        `✅ [${new Date().toISOString()}] Main menu displayed successfully`
      );
    } catch (error) {
      console.error(
        `❌ [${new Date().toISOString()}] Failed to show main menu:`,
        error
      );

      // Try even simpler fallback
      try {
        await session.layouts.showTextWall("Ready");
      } catch (fallbackError) {
        console.error(`❌ Fallback display also failed:`, fallbackError);
      }

      throw error;
    }
  }

  private async setupEventListeners(
    session: AppSession,
    sessionId: string,
    userId: string
  ): Promise<void> {
    // Listen for button presses
    session.on("button", async (buttonData: ButtonEvent) => {
      console.log(
        `🔘 [${new Date().toISOString()}] Button ${
          buttonData.action
        } - Session: ${sessionId}`
      );
      if (buttonData.action === "press") {
        await this.toggleLectureMode(session, sessionId, userId);
      }
    });

    // Listen for voice commands
    session.on("voice", async (voiceData: VoiceEvent) => {
      console.log(
        `🎤 [${new Date().toISOString()}] Voice command: "${
          voiceData.transcript
        }" - Session: ${sessionId}`
      );
      const command = voiceData.transcript.toLowerCase();
      if (
        command.includes("start lecture") ||
        command.includes("begin lecture")
      ) {
        await this.startLectureMode(session, sessionId, userId);
      } else if (
        command.includes("stop lecture") ||
        command.includes("end lecture")
      ) {
        await this.stopLectureMode(session, sessionId, userId);
      }
    });

    // Listen for head movement
    session.on("sensors", async (sensorData: SensorEvent) => {
      if (this.lectureManager.isInLectureMode()) {
        console.log(
          `📱 [${new Date().toISOString()}] Sensor data received - Session: ${sessionId}`
        );
        await this.handleHeadMovement(session, sensorData);
      }
    });
  }

  private async toggleLectureMode(
    session: AppSession,
    sessionId: string,
    userId: string
  ): Promise<void> {
    if (this.lectureManager.isInLectureMode()) {
      await this.stopLectureMode(session, sessionId, userId);
    } else {
      await this.startLectureMode(session, sessionId, userId);
    }
  }

  private async startLectureMode(
    session: AppSession,
    sessionId: string,
    userId: string
  ): Promise<void> {
    console.log("Starting lecture mode");

    // Start lecture recording and processing
    await this.lectureManager.startLecture(sessionId);

    // Show lecture mode UI
    await session.layouts.showTextWall(
      "🎓 Lecture Mode Active\n\nLive captions will appear here...\n\nTilt head to see key terms"
    );

    // Start live captioning
    await this.startLiveCaptioning(session);
  }

  private async stopLectureMode(
    session: AppSession,
    sessionId: string,
    userId: string
  ): Promise<void> {
    console.log("Stopping lecture mode");

    // Stop lecture recording
    const lectureData = await this.lectureManager.stopLecture();

    // Extract and save key terms
    if (lectureData) {
      const keyTerms = await this.keyTermExtractor.extractKeyTerms(
        lectureData.transcript
      );
      await this.databaseManager.saveKeyTerms(sessionId, userId, keyTerms);

      await session.layouts.showTextWall(
        `📚 Lecture Complete!\n\n` +
          `Extracted ${keyTerms.length} key terms\n` +
          `Duration: ${Math.round(lectureData.duration / 60)} minutes\n\n` +
          `Press button to start new lecture`
      );
    }

    // Return to main menu after 3 seconds
    setTimeout(async () => {
      await this.showMainMenu(session);
    }, 3000);
  }

  private async startLiveCaptioning(session: AppSession): Promise<void> {
    // Start continuous speech recognition for live captions
    this.lectureManager.onTranscriptUpdate((transcript: string) => {
      // Update the display with live captions
      session.layouts.showTextWall(
        "🎓 Lecture Mode - Live Captions\n\n" +
          transcript.split(" ").slice(-50).join(" ") + // Show last 50 words
          "\n\n(Tilt head to see key terms)"
      );
    });
  }

  private async handleHeadMovement(
    session: AppSession,
    sensorData: SensorEvent
  ): Promise<void> {
    // Check if head is tilted (simplified logic)
    const isHeadTilted = this.isHeadTilted(sensorData);

    if (isHeadTilted && !this.lectureManager.isShowingKeyTerms()) {
      await this.showRecentKeyTerms(session);
    } else if (!isHeadTilted && this.lectureManager.isShowingKeyTerms()) {
      await this.showLiveCaptions(session);
    }
  }

  private isHeadTilted(sensorData: SensorEvent): boolean {
    // Simple head tilt detection based on accelerometer data
    // This would need to be calibrated based on actual sensor data format
    if (sensorData.accelerometer) {
      const { x, y, z } = sensorData.accelerometer;
      const tiltThreshold = 0.3; // Adjust based on testing
      return Math.abs(x) > tiltThreshold || Math.abs(y) > tiltThreshold;
    }
    return false;
  }

  private async showRecentKeyTerms(session: AppSession): Promise<void> {
    this.lectureManager.setShowingKeyTerms(true);

    const recentKeyTerms = await this.keyTermExtractor.getRecentKeyTerms(3);

    let display = "🔑 Recent Key Terms\n\n";

    if (recentKeyTerms.length === 0) {
      display += "No key terms detected yet...\nKeep listening!";
    } else {
      recentKeyTerms.forEach((term: any, index: number) => {
        display += `${index + 1}. ${term.term}\n`;
        display += `   ${term.definition}\n\n`;
      });
    }

    display += "\n(Straighten head for live captions)";

    await session.layouts.showTextWall(display);
  }

  private async showLiveCaptions(session: AppSession): Promise<void> {
    this.lectureManager.setShowingKeyTerms(false);

    const currentTranscript = this.lectureManager.getCurrentTranscript();
    await session.layouts.showTextWall(
      "🎓 Lecture Mode - Live Captions\n\n" +
        currentTranscript.split(" ").slice(-50).join(" ") +
        "\n\n(Tilt head to see key terms)"
    );
  }
}

// Start the application
const app = new LectureAssistantApp();
app.start();

console.log("Lecture Assistant app started on port", process.env.PORT || 3000);
