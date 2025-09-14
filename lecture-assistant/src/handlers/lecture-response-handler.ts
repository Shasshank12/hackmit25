import { AppSession } from "@mentra/sdk";
import {
  Action,
  AgentType,
  type AgentResponse,
  type Conversation,
  type KeyTerm,
  type SensorData,
  DisplayMode,
  type LectureTopic,
} from "../types";
import {
  LectureProcessor,
  KeyTermDetector,
  DefinitionProvider,
  CaptionManager,
  TopicCollector,
} from "../agents";
import {
  TRANSCRIPT_BUFFER_LENGTH,
  KEY_TERMS_HISTORY_LENGTH,
  KEY_TERM_CACHE_SIZE,
  SIMILARITY_THRESHOLD,
  DISPLAY_DURATION_MS,
  AGENT_SETTINGS,
  type AgentSettingsKey,
} from "../config";
import { findBestMatch } from "../utils/text-processing";

export class LectureResponseHandler {
  private session: AppSession;
  private conversation: Conversation;
  private lectureProcessor: LectureProcessor;
  private keyTermDetector: KeyTermDetector;
  private definitionProvider: DefinitionProvider;
  private captionManager: CaptionManager;
  private topicCollector: TopicCollector;
  private recentKeyTerms: KeyTerm[] = [];
  private isInLectureMode: boolean = false;
  private currentSessionId: string | null = null;
  private currentLectureTopic: LectureTopic | null = null;

  // Settings
  public keyTermFrequency: "off" | "standard" | "high";
  private enabledAgents: AgentSettingsKey[] = [];

  constructor(
    session: AppSession,
    initialFrequency: "off" | "standard" | "high" = "high"
  ) {
    this.session = session;
    this.conversation = [];
    this.keyTermFrequency = initialFrequency;

    // Initialize agents
    this.lectureProcessor = new LectureProcessor();
    this.keyTermDetector = new KeyTermDetector();
    this.definitionProvider = new DefinitionProvider();
    this.captionManager = new CaptionManager();
    this.topicCollector = new TopicCollector(session);

    // Load initial settings
    this.loadAgentSettings();

    // Setup settings listeners
    this.setupSettingsListeners();
  }

  /**
   * Load current agent settings from session
   */
  private async loadAgentSettings(): Promise<void> {
    try {
      this.enabledAgents = [];

      // Get key term frequency setting
      this.keyTermFrequency = (await this.session.settings.get(
        "key_term_frequency",
        "high"
      )) as "off" | "standard" | "high";

      // Check enabled features
      const autoDefinitionsEnabled = (await this.session.settings.get(
        "auto_definitions",
        true
      )) as boolean;
      if (autoDefinitionsEnabled) {
        this.enabledAgents.push("auto_definitions");
      }

      const liveCaptionsEnabled = (await this.session.settings.get(
        "live_captions",
        true
      )) as boolean;
      if (liveCaptionsEnabled) {
        this.enabledAgents.push("live_captions");
      }

      this.session.logger.info(
        `Settings loaded - Key terms: ${this.keyTermFrequency}, Auto definitions: ${autoDefinitionsEnabled}, Live captions: ${liveCaptionsEnabled}`
      );
    } catch (error) {
      this.session.logger.error(`Failed to load agent settings: ${error}`);
      // Fallback to defaults
      this.enabledAgents = ["auto_definitions", "live_captions"];
      this.keyTermFrequency = "high";
    }
  }

  /**
   * Setup listeners for settings changes
   */
  private setupSettingsListeners(): void {
    // Listen for key term frequency changes
    const unsubscribeFrequency = this.session.settings.onValueChange(
      "key_term_frequency",
      (newValue: "off" | "standard" | "high") => {
        this.session.logger.info(`Key term frequency changed to: ${newValue}`);
        this.keyTermFrequency = newValue;
      }
    );

    // Listen for other setting changes
    const unsubscribeDefinitions = this.session.settings.onValueChange(
      "auto_definitions",
      async (newValue: boolean) => {
        this.session.logger.info(
          `Auto definitions ${newValue ? "enabled" : "disabled"}`
        );
        await this.loadAgentSettings();
      }
    );

    const unsubscribeCaptions = this.session.settings.onValueChange(
      "live_captions",
      async (newValue: boolean) => {
        this.session.logger.info(
          `Live captions ${newValue ? "enabled" : "disabled"}`
        );
        await this.loadAgentSettings();
      }
    );
  }

  /**
   * Start lecture mode with topic collection
   */
  async startLecture(sessionId: string): Promise<void> {
    this.currentSessionId = sessionId;
    this.conversation = [];
    this.recentKeyTerms = [];
    this.currentLectureTopic = null;

    this.session.logger.info(`Starting topic collection for session: ${sessionId}`);

    // Start topic collection process
    await this.topicCollector.startCollection(async (topic: LectureTopic) => {
      await this.onTopicCollectionComplete(topic, sessionId);
    });
  }

  /**
   * Stop lecture mode
   */
  async stopLecture(): Promise<{ keyTerms: KeyTerm[]; duration: number }> {
    this.isInLectureMode = false;
    const sessionId = this.currentSessionId;
    this.currentSessionId = null;

    // Calculate duration (simplified)
    const duration = this.conversation.length * 3; // Rough estimate

    // Show completion summary
    const response = this.captionManager.showLectureComplete(
      duration,
      this.recentKeyTerms.length,
      Date.now()
    );
    await this.displayAgentResponse(response);

    this.session.logger.info(
      `Stopped lecture mode. Key terms: ${this.recentKeyTerms.length}, Duration: ${duration}s`
    );

    return {
      keyTerms: [...this.recentKeyTerms],
      duration,
    };
  }

  /**
   * Handle topic collection completion
   */
  private async onTopicCollectionComplete(topic: LectureTopic, sessionId: string): Promise<void> {
    this.currentLectureTopic = topic;
    this.isInLectureMode = true;

    this.session.logger.info(`Topic collection completed. Starting lecture mode with topic: ${JSON.stringify(topic)}`);

    // Set the topic for key term detection and definition providers
    await this.keyTermDetector.setTopic(topic);
    this.definitionProvider.setTopic(topic);

    // Show lecture mode activation message
    await this.session.layouts.showTextWall(
      "🎓 Lecture Mode Active\n\nListening for speech...\n\nTilt head to see key terms",
      { durationMs: 3000 }
    );
  }

  /**
   * Process a new transcript segment
   */
  async processTranscript(text: string, timestamp: number): Promise<void> {
    // Check if we're in topic collection mode
    if (this.topicCollector.isCollecting()) {
      await this.topicCollector.processVoiceInput(text);
      return;
    }

    if (!this.isInLectureMode) {
      return;
    }

    this.session.logger.info(`Processing transcript: "${text}"`);

    // Add to conversation
    this.conversation.push({
      type: "transcript",
      text,
      timestamp,
    });

    // Get initial processing decision
    const processingResponse = await this.lectureProcessor.processTranscript(
      text,
      timestamp
    );

    // Handle the processing response
    await this.handleAgentResponse(processingResponse, text, timestamp);

    // Trim conversation if needed
    this.trimConversation();
  }

  /**
   * Handle agent responses
   */
  private async handleAgentResponse(
    response: AgentResponse,
    originalText: string,
    timestamp: number
  ): Promise<void> {
    this.session.logger.info(
      `Agent action: ${response.type}, reasoning: ${response.reasoning}`
    );

    switch (response.type) {
      case Action.PROCESS:
        if (response.payload.extractKeyTerms) {
          await this.extractAndProcessKeyTerms(originalText, timestamp);
        }
        break;

      case Action.SHOW_CAPTION:
        if (this.enabledAgents.includes("live_captions")) {
          await this.displayAgentResponse(response);
        }
        break;

      case Action.SHOW_TERM:
        if (this.enabledAgents.includes("auto_definitions")) {
          await this.displayAgentResponse(response);
        }
        break;

      case Action.SILENT:
        // Do nothing - agent decided to stay quiet
        break;
    }

    // Add response to conversation
    this.conversation.push(response);
  }

  /**
   * Extract and process key terms from text
   */
  private async extractAndProcessKeyTerms(
    text: string,
    timestamp: number
  ): Promise<void> {
    // Detect key terms
    const detectedTerms = await this.keyTermDetector.detectKeyTerms(
      text,
      timestamp
    );

    if (detectedTerms.length === 0) {
      return;
    }

    // Get definitions for terms
    const enrichedTerms = await this.definitionProvider.getDefinitions(
      detectedTerms
    );

    // Filter based on frequency setting and recent terms
    const filteredTerms = this.filterTermsByFrequency(enrichedTerms);

    // Add to recent terms and show if appropriate
    for (const term of filteredTerms) {
      if (this.shouldShowKeyTerm(term)) {
        this.addToRecentTerms(term);

        // Show the term if auto definitions are enabled
        if (this.enabledAgents.includes("auto_definitions")) {
          const showTermResponse = this.captionManager.showKeyTerm(
            term.term,
            term.definition,
            term.context,
            timestamp
          );
          await this.displayAgentResponse(showTermResponse);
          break; // Only show one term at a time
        }
      }
    }
  }

  /**
   * Filter terms based on frequency setting
   */
  private filterTermsByFrequency(terms: KeyTerm[]): KeyTerm[] {
    switch (this.keyTermFrequency) {
      case "off":
        return [];
      case "standard":
        // Only show high-confidence, unique terms
        return terms.filter(
          (term) =>
            term.confidence > 0.8 &&
            !this.recentKeyTerms.some(
              (recent) => recent.term.toLowerCase() === term.term.toLowerCase()
            )
        );
      case "high":
        // Show most terms, but avoid duplicates
        return terms.filter(
          (term) =>
            term.confidence > 0.6 &&
            !this.recentKeyTerms.some(
              (recent) => recent.term.toLowerCase() === term.term.toLowerCase()
            )
        );
      default:
        return terms;
    }
  }

  /**
   * Determine if a key term should be shown
   */
  private shouldShowKeyTerm(term: KeyTerm): boolean {
    // Check for duplicates using similarity
    if (this.recentKeyTerms.length > 0) {
      const recentTermTexts = this.recentKeyTerms.map((t) => t.term);
      const { bestMatch } = findBestMatch(term.term, recentTermTexts);

      if (bestMatch.rating > SIMILARITY_THRESHOLD) {
        this.session.logger.info(
          `Duplicate term detected (Similarity: ${bestMatch.rating.toFixed(
            2
          )}). Skipping: "${term.term}"`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Add term to recent terms cache
   */
  private addToRecentTerms(term: KeyTerm): void {
    this.recentKeyTerms.unshift(term);

    // Trim cache
    if (this.recentKeyTerms.length > KEY_TERM_CACHE_SIZE) {
      this.recentKeyTerms = this.recentKeyTerms.slice(0, KEY_TERM_CACHE_SIZE);
    }
  }

  /**
   * Handle head tilt gesture
   */
  async handleHeadTilt(sensorData: SensorData): Promise<void> {
    if (!this.isInLectureMode) {
      return;
    }

    const isHeadTilted = this.detectHeadTilt(sensorData);

    if (
      isHeadTilted &&
      this.captionManager.getCurrentDisplayMode() !== DisplayMode.KEY_TERMS
    ) {
      // Show recent key terms
      const recentTermsForDisplay = this.recentKeyTerms
        .slice(0, 3)
        .map((term) => ({
          term: term.term,
          definition: term.definition,
        }));

      const response = this.captionManager.handleHeadTilt(
        recentTermsForDisplay,
        Date.now()
      );
      await this.displayAgentResponse(response);
    } else if (
      !isHeadTilted &&
      this.captionManager.getCurrentDisplayMode() === DisplayMode.KEY_TERMS
    ) {
      // Return to live captions
      this.captionManager.forceClear();
    }
  }

  /**
   * Detect head tilt from sensor data
   */
  private detectHeadTilt(sensorData: SensorData): boolean {
    if (sensorData.accelerometer) {
      const { x, y, z } = sensorData.accelerometer;
      const tiltThreshold = 0.3;
      return Math.abs(x) > tiltThreshold || Math.abs(y) > tiltThreshold;
    }
    return false;
  }

  /**
   * Display agent response on glasses
   */
  private async displayAgentResponse(response: AgentResponse): Promise<void> {
    try {
      let displayText = "";
      let durationMs = DISPLAY_DURATION_MS;

      switch (response.type) {
        case Action.SHOW_CAPTION:
          displayText = response.output;
          break;
        case Action.SHOW_TERM:
          displayText = `🔑 ${response.output.term}\n\n${response.output.definition}`;
          durationMs = 7000; // Longer display for definitions
          break;
        default:
          return; // Don't display other response types
      }

      this.session.logger.info(`Displaying: "${displayText}"`);
      await this.session.layouts.showTextWall(displayText, { durationMs });
    } catch (error) {
      this.session.logger.error(`Failed to display response: ${error}`);
    }
  }

  /**
   * Trim conversation to prevent memory issues
   */
  private trimConversation(): void {
    const maxLength = TRANSCRIPT_BUFFER_LENGTH + KEY_TERMS_HISTORY_LENGTH;
    if (this.conversation.length > maxLength) {
      this.conversation = this.conversation.slice(-maxLength);
    }
  }

  /**
   * Get current conversation for debugging
   */
  getConversation(): Conversation {
    return [...this.conversation];
  }

  /**
   * Get recent key terms
   */
  getRecentKeyTerms(): KeyTerm[] {
    return [...this.recentKeyTerms];
  }

  /**
   * Check if in lecture mode
   */
  isLectureModeActive(): boolean {
    return this.isInLectureMode;
  }

  /**
   * Get current lecture topic
   */
  getCurrentLectureTopic(): LectureTopic | null {
    return this.currentLectureTopic;
  }

  /**
   * Clear conversation and reset state
   */
  reset(): void {
    this.conversation = [];
    this.recentKeyTerms = [];
    this.isInLectureMode = false;
    this.currentSessionId = null;
    this.currentLectureTopic = null;
    this.captionManager.forceClear();
    this.topicCollector.cancelCollection();
  }
}
