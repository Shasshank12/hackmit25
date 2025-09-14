import { AppServer, AppSession, AppServerConfig } from "@mentra/sdk";
import { LectureResponseHandler } from "./handlers";
import { DatabaseManager } from "./DatabaseManager";
import { ENV_CONFIG, AGENT_SETTINGS } from "./config";
import {
  ButtonEvent,
  VoiceEvent,
  SensorEvent,
  DisplayMode,
  type KeyTerm,
} from "./types";

/**
 * LectureAssistantApp - A proactive AI assistant for smart glasses during lectures
 * Implements real-time transcription, key term detection, and contextual definitions
 */
class LectureAssistantApp extends AppServer {
  private databaseManager: DatabaseManager;

  constructor() {
    const config: AppServerConfig = {
      port: ENV_CONFIG.PORT,
      packageName: ENV_CONFIG.PACKAGE_NAME,
      apiKey: ENV_CONFIG.MENTRAOS_API_KEY,
    };

    console.log(`🔧 [${new Date().toISOString()}] App config:`, {
      port: config.port,
      packageName: config.packageName,
      apiKeySet: !!config.apiKey,
      environment: ENV_CONFIG.NODE_ENV,
    });

    super(config);
    this.databaseManager = new DatabaseManager();

    // Add startup health check
    this.performStartupHealthCheck();
  }

  /**
   * Perform startup health check to verify all dependencies are working
   */
  private performStartupHealthCheck(): void {
    try {
      console.log(
        `🏥 [${new Date().toISOString()}] Performing startup health check...`
      );

      // Check environment variables
      const requiredEnvVars = ["OPENAI_API_KEY", "MENTRAOS_API_KEY"];
      const missingVars = requiredEnvVars.filter(
        (varName) => !process.env[varName]
      );

      if (missingVars.length > 0) {
        console.error(
          `❌ Missing required environment variables: ${missingVars.join(", ")}`
        );
      } else {
        console.log(`✅ All required environment variables present`);
      }

      // Check database manager
      if (this.databaseManager) {
        console.log(`✅ Database manager initialized`);
      } else {
        console.error(`❌ Database manager failed to initialize`);
      }

      console.log(`🏥 [${new Date().toISOString()}] Health check completed`);
    } catch (error) {
      console.error(`💥 Health check failed:`, error);
    }
  }

  /**
   * Handle new session connections
   * @param session - The app session instance
   * @param sessionId - Unique identifier for this session
   * @param userId - The user ID for this session
   */
  protected async onSession(
    session: AppSession,
    sessionId: string,
    userId: string
  ): Promise<void> {
    try {
      session.logger.info(
        `🚀 New session started: ${sessionId} for user: ${userId}`
      );
      session.logger.info(
        `📱 App version: ${process.env.npm_package_version || "unknown"}`
      );
      session.logger.info(`🔧 Environment: ${ENV_CONFIG.NODE_ENV}`);

      // Get initial settings
      const initialFrequency = (await session.settings.get(
        "key_term_frequency",
        "high"
      )) as "off" | "standard" | "high";
      session.logger.info(`Initial key term frequency: ${initialFrequency}`);

      // Create response handler for this session
      const responseHandler = new LectureResponseHandler(
        session,
        initialFrequency
      );

      // Show main menu
      await this.showMainMenu(session);

      // Set up event listeners with response handler
      await this.setupEventListeners(
        session,
        sessionId,
        userId,
        responseHandler
      );

      // Setup transcription listener for real-time processing
      await this.setupTranscriptionListener(session, responseHandler);

      session.logger.info(`Session setup complete: ${sessionId}`);
    } catch (error) {
      session.logger.error(
        error as any,
        `❌ Session setup failed: ${sessionId}`,
        {
          userId,
          sessionId,
        }
      );

      try {
        await session.layouts.showTextWall(
          "🚫 App Error\n\nSession setup failed\nCheck logs for details\n\nPlease restart the application"
        );
      } catch (displayError) {
        session.logger.error(
          displayError as any,
          "💥 Failed to display error message:",
          {
            originalError:
              error instanceof Error ? error.message : String(error),
          }
        );
      }
    }
  }

  /**
   * Show the main menu interface
   */
  private async showMainMenu(session: AppSession): Promise<void> {
    try {
      session.logger.info("📺 Displaying main menu");

      const menuText =
        "🎓 Lecture Assistant\n\nPress button or say 'start lecture' to begin\n\nReady to capture knowledge!";

      session.logger.debug("Menu text to display: " + menuText);
      await session.layouts.showTextWall(menuText);

      session.logger.info("✅ Main menu displayed successfully");
    } catch (error) {
      session.logger.error(error as any, "❌ Failed to show main menu");

      // Fallback to simple text
      try {
        session.logger.info("🔄 Attempting fallback display...");
        await session.layouts.showTextWall("🎓 Ready");
        session.logger.info("✅ Fallback display successful");
      } catch (fallbackError) {
        session.logger.error(
          fallbackError as any,
          "💥 Fallback display failed",
          {
            originalError:
              error instanceof Error ? error.message : String(error),
          }
        );
      }

      throw error;
    }
  }

  /**
   * Setup event listeners for user interactions
   */
  private async setupEventListeners(
    session: AppSession,
    sessionId: string,
    userId: string,
    responseHandler: LectureResponseHandler
  ): Promise<void> {
    // Listen for button presses
    session.on("button", async (buttonData: ButtonEvent) => {
      session.logger.info(
        `Button ${buttonData.action} pressed - Session: ${sessionId}`
      );

      if (buttonData.action === "press") {
        await this.toggleLectureMode(
          session,
          sessionId,
          userId,
          responseHandler
        );
      }
    });

    // Listen for voice commands
    session.on("voice", async (voiceData: VoiceEvent) => {
      session.logger.info(
        `Voice command: "${voiceData.transcript}" - Session: ${sessionId}`
      );

      const command = voiceData.transcript.toLowerCase();
      if (
        command.includes("start lecture") ||
        command.includes("begin lecture")
      ) {
        await this.startLectureMode(
          session,
          sessionId,
          userId,
          responseHandler
        );
      } else if (
        command.includes("stop lecture") ||
        command.includes("end lecture")
      ) {
        await this.stopLectureMode(session, sessionId, userId, responseHandler);
      }
    });

    // Listen for sensor data (head movements)
    session.on("sensors", async (sensorData: SensorEvent) => {
      if (responseHandler.isLectureModeActive()) {
        session.logger.debug(`Sensor data received - Session: ${sessionId}`);
        await responseHandler.handleHeadTilt(sensorData);
      }
    });

    // Clean up listeners when session ends
    session.events.onDisconnected(() => {
      session.logger.info(`Session ${sessionId} disconnected - cleaning up`);
      responseHandler.reset();
    });
  }

  /**
   * Setup real-time transcription listener
   */
  private async setupTranscriptionListener(
    session: AppSession,
    responseHandler: LectureResponseHandler
  ): Promise<void> {
    // State for managing transcription buffering
    let currentUtteranceBuffer = "";
    let utteranceTimer: NodeJS.Timeout | null = null;
    const UTTERANCE_TIMEOUT_MS = 3000;

    // Function to process the buffer and reset state
    const processBufferAndReset = (reason: "isFinal" | "timeout") => {
      if (utteranceTimer) {
        clearTimeout(utteranceTimer);
        utteranceTimer = null;
      }

      const textToProcess = currentUtteranceBuffer.trim();
      if (textToProcess.length > 0 && responseHandler.isLectureModeActive()) {
        session.logger.info(
          `Processing utterance (${reason}): "${textToProcess}"`
        );
        const timestamp = Date.now();
        responseHandler
          .processTranscript(textToProcess, timestamp)
          .catch((error) => {
            session.logger.error(`Failed to process transcript: ${error}`);
          });
      }

      currentUtteranceBuffer = "";
    };

    // Listen for real-time speech transcriptions
    const unsubscribe = session.events.onTranscription((data) => {
      session.logger.debug(
        `Transcription: "${data.text}", isFinal: ${data.isFinal}`
      );

      const isNewUtterance =
        currentUtteranceBuffer.length === 0 && data.text.trim().length > 0;

      // Update buffer with latest text
      currentUtteranceBuffer = data.text;

      if (isNewUtterance) {
        // Start timeout for max utterance duration
        utteranceTimer = setTimeout(
          () => processBufferAndReset("timeout"),
          UTTERANCE_TIMEOUT_MS
        );
      }

      if (data.isFinal) {
        // Process complete utterance
        processBufferAndReset("isFinal");
      }
    });

    // Cleanup transcription listener
    this.addCleanupHandler(() => {
      if (utteranceTimer) clearTimeout(utteranceTimer);
      unsubscribe();
    });
  }

  /**
   * Toggle lecture mode on/off
   */
  private async toggleLectureMode(
    session: AppSession,
    sessionId: string,
    userId: string,
    responseHandler: LectureResponseHandler
  ): Promise<void> {
    if (responseHandler.isLectureModeActive()) {
      await this.stopLectureMode(session, sessionId, userId, responseHandler);
    } else {
      await this.startLectureMode(session, sessionId, userId, responseHandler);
    }
  }

  /**
   * Start lecture mode
   */
  private async startLectureMode(
    session: AppSession,
    sessionId: string,
    userId: string,
    responseHandler: LectureResponseHandler
  ): Promise<void> {
    session.logger.info("Starting lecture mode");

    try {
      // Start lecture with response handler
      await responseHandler.startLecture(sessionId);

      // Show lecture mode activation message
      await session.layouts.showTextWall(
        "🎓 Lecture Mode Active\n\nListening for speech...\n\nTilt head to see key terms",
        { durationMs: 3000 }
      );

      session.logger.info("Lecture mode started successfully");
    } catch (error) {
      session.logger.error("Failed to start lecture mode:", error as any);
      await session.layouts.showTextWall("❌ Failed to start lecture mode");
    }
  }

  /**
   * Stop lecture mode
   */
  private async stopLectureMode(
    session: AppSession,
    sessionId: string,
    userId: string,
    responseHandler: LectureResponseHandler
  ): Promise<void> {
    session.logger.info("Stopping lecture mode");

    try {
      // Stop lecture and get results
      const lectureResults = await responseHandler.stopLecture();

      // Save results to database
      if (lectureResults.keyTerms.length > 0) {
        await this.databaseManager.saveKeyTerms(
          sessionId,
          userId,
          lectureResults.keyTerms
        );
      }

      // Save lecture session
      const lectureSession = {
        id: sessionId,
        userId,
        startTime: new Date(Date.now() - lectureResults.duration * 1000),
        endTime: new Date(),
        duration: lectureResults.duration,
        transcript: "", // Would be populated with full transcript
        keyTermsCount: lectureResults.keyTerms.length,
      };

      await this.databaseManager.saveLectureSession(lectureSession);

      session.logger.info(
        `Lecture completed - Duration: ${lectureResults.duration}s, Key terms: ${lectureResults.keyTerms.length}`
      );

      // Return to main menu after delay
      setTimeout(async () => {
        await this.showMainMenu(session);
      }, 5000);
    } catch (error) {
      session.logger.error("Failed to stop lecture mode:", error as any);
      await session.layouts.showTextWall("❌ Error stopping lecture");

      // Still try to return to main menu
      setTimeout(async () => {
        await this.showMainMenu(session);
      }, 3000);
    }
  }
}

// Start the application
const app = new LectureAssistantApp();
app.start();

console.log("Lecture Assistant app started on port", process.env.PORT || 3000);
