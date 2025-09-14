import { AppSession } from "@mentra/sdk";
import {
  LectureTopic,
  AcademicLevel,
  TopicCollectionState,
  TopicCollectionStep,
  Action,
  AgentType,
  type AgentResponse,
} from "../types";
import { DISPLAY_DURATION_MS } from "../config";

/**
 * Agent responsible for collecting lecture topic information
 * Handles subject, subtopic, and academic level collection through voice commands
 */
export class TopicCollector {
  private session: AppSession;
  private state: TopicCollectionState;
  private onCompleteCallback: ((topic: LectureTopic) => void) | null = null;

  constructor(session: AppSession) {
    this.session = session;
    this.state = {
      isCollecting: false,
      currentStep: "subject",
      collectedData: {},
    };
  }

  /**
   * Start topic collection process
   */
  async startCollection(
    onComplete: (topic: LectureTopic) => void
  ): Promise<void> {
    this.state.isCollecting = true;
    this.state.currentStep = "subject";
    this.state.collectedData = {};
    this.onCompleteCallback = onComplete;

    this.session.logger.info("Starting topic collection process");

    // Show initial prompt for subject
    await this.showSubjectPrompt();
  }

  /**
   * Process voice input during topic collection
   */
  async processVoiceInput(transcript: string): Promise<boolean> {
    if (!this.state.isCollecting) {
      return false;
    }

    this.session.logger.info(
      `Processing topic collection input: "${transcript}" for step: ${this.state.currentStep}`
    );

    const normalizedInput = transcript.toLowerCase().trim();

    switch (this.state.currentStep) {
      case "subject":
        return await this.processSubjectInput(normalizedInput);
      case "subtopic":
        return await this.processSubtopicInput(normalizedInput);
      case "level":
        return await this.processLevelInput(normalizedInput);
      default:
        return false;
    }
  }

  /**
   * Process subject input
   */
  private async processSubjectInput(input: string): Promise<boolean> {
    // Extract subject from input
    const subject = this.extractSubject(input);

    if (subject) {
      this.state.collectedData.subject = subject;
      this.state.currentStep = "subtopic";

      this.session.logger.info(`Subject collected: ${subject}`);
      await this.showSubtopicPrompt(subject);
      return true;
    }

    // If no valid subject found, ask for clarification
    await this.showSubjectClarificationPrompt();
    return true;
  }

  /**
   * Process subtopic input
   */
  private async processSubtopicInput(input: string): Promise<boolean> {
    // Extract subtopic from input
    const subtopic = this.extractSubtopic(input);

    if (subtopic) {
      this.state.collectedData.subtopic = subtopic;
      this.state.currentStep = "level";

      this.session.logger.info(`Subtopic collected: ${subtopic}`);
      await this.showLevelPrompt();
      return true;
    }

    // If no valid subtopic found, ask for clarification
    await this.showSubtopicClarificationPrompt();
    return true;
  }

  /**
   * Process level input
   */
  private async processLevelInput(input: string): Promise<boolean> {
    // Extract academic level from input
    const level = this.extractAcademicLevel(input);

    if (level) {
      this.state.collectedData.level = level;

      // Complete topic collection
      await this.completeTopicCollection();
      return true;
    }

    // If no valid level found, ask for clarification
    await this.showLevelClarificationPrompt();
    return true;
  }

  /**
   * Extract subject from voice input
   */
  private extractSubject(input: string): string | null {
    const cleanInput = input.toLowerCase().trim();

    // Validate that it's a proper academic subject
    if (!this.isValidAcademicSubject(cleanInput)) {
      return null;
    }

    // Common subject patterns
    const subjectPatterns = [
      // Direct statements
      /(?:subject is|topic is|studying|learning|about)\s+(.+)/i,
      // Academic subjects
      /(?:american history|world history|mathematics|math|science|physics|chemistry|biology|english|literature|computer science|programming|art|music|philosophy|psychology|economics|political science|sociology)/i,
      // Generic patterns
      /^(.+)$/i, // Fallback to entire input
    ];

    for (const pattern of subjectPatterns) {
      const match = input.match(pattern);
      if (match) {
        let subject = match[1] || match[0];
        subject = subject.trim();

        // Clean up common prefixes/suffixes
        subject = subject.replace(/^(the|a|an)\s+/i, "");
        subject = subject.replace(/\s+(class|course|subject|topic)$/i, "");

        if (subject.length > 2 && subject.length < 50) {
          return this.capitalizeWords(subject);
        }
      }
    }

    return null;
  }

  /**
   * Extract subtopic from voice input
   */
  private extractSubtopic(input: string): string | null {
    // Common subtopic patterns
    const subtopicPatterns = [
      // Direct statements
      /(?:subtopic is|specific topic is|focusing on|covering|about)\s+(.+)/i,
      // Common subtopic indicators
      /(?:chapter|unit|section|module)\s+(\d+)/i,
      /(?:we're studying|we're covering|we're learning)\s+(.+)/i,
      // Generic patterns
      /^(.+)$/i, // Fallback to entire input
    ];

    for (const pattern of subtopicPatterns) {
      const match = input.match(pattern);
      if (match) {
        let subtopic = match[1] || match[0];
        subtopic = subtopic.trim();

        // Clean up common prefixes/suffixes
        subtopic = subtopic.replace(/^(the|a|an)\s+/i, "");
        subtopic = subtopic.replace(/\s+(class|course|subject|topic)$/i, "");

        if (subtopic.length > 2 && subtopic.length < 50) {
          return this.capitalizeWords(subtopic);
        }
      }
    }

    return null;
  }

  /**
   * Extract academic level from voice input
   */
  private extractAcademicLevel(input: string): AcademicLevel | null {
    // First validate if it's a proper academic level
    if (!this.isValidAcademicLevel(input)) {
      return null;
    }
    const levelMappings: { [key: string]: AcademicLevel } = {
      // High school variations
      "high school": AcademicLevel.HIGH_SCHOOL,
      highschool: AcademicLevel.HIGH_SCHOOL,
      hs: AcademicLevel.HIGH_SCHOOL,
      secondary: AcademicLevel.HIGH_SCHOOL,
      "grade 9": AcademicLevel.HIGH_SCHOOL,
      "grade 10": AcademicLevel.HIGH_SCHOOL,
      "grade 11": AcademicLevel.HIGH_SCHOOL,
      "grade 12": AcademicLevel.HIGH_SCHOOL,

      // College variations
      college: AcademicLevel.COLLEGE,
      undergraduate: AcademicLevel.UNDERGRADUATE,
      undergrad: AcademicLevel.COLLEGE,
      bachelor: AcademicLevel.COLLEGE,
      "bachelor's": AcademicLevel.COLLEGE,
      university: AcademicLevel.COLLEGE,
      freshman: AcademicLevel.COLLEGE,
      sophomore: AcademicLevel.COLLEGE,
      junior: AcademicLevel.COLLEGE,
      senior: AcademicLevel.COLLEGE,

      // Masters variations
      masters: AcademicLevel.GRADUATE,
      "master's": AcademicLevel.GRADUATE,
      graduate: AcademicLevel.GRADUATE,
      grad: AcademicLevel.GRADUATE,
      ms: AcademicLevel.GRADUATE,
      ma: AcademicLevel.GRADUATE,

      // PhD variations
      phd: AcademicLevel.GRADUATE,
      "ph.d": AcademicLevel.GRADUATE,
      doctorate: AcademicLevel.GRADUATE,
      doctoral: AcademicLevel.GRADUATE,
      "ph.d.": AcademicLevel.GRADUATE,

      // Professional variations
      professional: AcademicLevel.PROFESSIONAL,
      work: AcademicLevel.PROFESSIONAL,
      industry: AcademicLevel.PROFESSIONAL,
      career: AcademicLevel.PROFESSIONAL,
    };

    const normalizedInput = input.toLowerCase().trim();

    for (const [key, level] of Object.entries(levelMappings)) {
      if (normalizedInput.includes(key)) {
        return level;
      }
    }

    return null;
  }

  /**
   * Show initial subject prompt
   */
  private async showSubjectPrompt(): Promise<void> {
    const prompt =
      "🎓 Let's start your lecture!\n\nWhat subject are you studying?\n\nSay: 'American History' or 'Mathematics'";

    await this.session.layouts.showTextWall(prompt, { durationMs: 8000 });
    this.session.logger.info("Displayed subject collection prompt");
  }

  /**
   * Show subtopic prompt
   */
  private async showSubtopicPrompt(subject: string): Promise<void> {
    const prompt = `📚 Great! Subject: ${subject}\n\nWhat specific topic or chapter?\n\nSay: 'World War 2' or 'Chapter 5'`;

    await this.session.layouts.showTextWall(prompt, { durationMs: 8000 });
    this.session.logger.info(
      `Displayed subtopic collection prompt for subject: ${subject}`
    );
  }

  /**
   * Show level prompt
   */
  private async showLevelPrompt(): Promise<void> {
    const prompt =
      "🎯 What's your academic level?\n\nSay: 'High School', 'College', 'Masters', or 'PhD'";

    await this.session.layouts.showTextWall(prompt, { durationMs: 8000 });
    this.session.logger.info("Displayed level collection prompt");
  }

  /**
   * Show subject clarification prompt
   */
  private async showSubjectClarificationPrompt(): Promise<void> {
    const prompt =
      "❓ I didn't catch the subject clearly.\n\nPlease say the subject name clearly.\n\nExample: 'American History'";

    await this.session.layouts.showTextWall(prompt, { durationMs: 6000 });
    this.session.logger.info("Displayed subject clarification prompt");
  }

  /**
   * Show subtopic clarification prompt
   */
  private async showSubtopicClarificationPrompt(): Promise<void> {
    const prompt =
      "❓ I didn't catch the specific topic.\n\nPlease say the topic or chapter clearly.\n\nExample: 'World War 2'";

    await this.session.layouts.showTextWall(prompt, { durationMs: 6000 });
    this.session.logger.info("Displayed subtopic clarification prompt");
  }

  /**
   * Show level clarification prompt
   */
  private async showLevelClarificationPrompt(): Promise<void> {
    const prompt =
      "❓ I didn't catch your academic level.\n\nPlease say: 'High School', 'College', 'Masters', or 'PhD'";

    await this.session.layouts.showTextWall(prompt, { durationMs: 6000 });
    this.session.logger.info("Displayed level clarification prompt");
  }

  /**
   * Complete topic collection and start lecture
   */
  private async completeTopicCollection(): Promise<void> {
    const topic: LectureTopic = {
      subject: this.state.collectedData.subject!,
      subtopic: this.state.collectedData.subtopic!,
      academicLevel: this.state.collectedData.level!,
      level: this.state.collectedData.level!,
      timestamp: new Date(),
    };

    this.state.isCollecting = false;
    this.state.currentStep = "complete";

    // Show completion message
    const completionMessage = `✅ Lecture Setup Complete!\n\n📚 Subject: ${
      topic.subject
    }\n📖 Topic: ${topic.subtopic}\n🎓 Level: ${this.formatAcademicLevel(
      topic.level
    )}\n\n🎤 Lecture recording starting now!`;

    await this.session.layouts.showTextWall(completionMessage, {
      durationMs: 5000,
    });

    this.session.logger.info(
      `Topic collection completed: ${JSON.stringify(topic)}`
    );

    // Call completion callback
    if (this.onCompleteCallback) {
      this.onCompleteCallback(topic);
    }
  }

  /**
   * Format academic level for display
   */
  private formatAcademicLevel(level: AcademicLevel): string {
    const levelLabels: { [key in AcademicLevel]: string } = {
      [AcademicLevel.ELEMENTARY]: "Elementary",
      [AcademicLevel.MIDDLE_SCHOOL]: "Middle School",
      [AcademicLevel.HIGH_SCHOOL]: "High School",
      [AcademicLevel.UNDERGRADUATE]: "Undergraduate",
      [AcademicLevel.GRADUATE]: "Graduate",
      [AcademicLevel.PROFESSIONAL]: "Professional",
      [AcademicLevel.COLLEGE]: "College",
    };

    return levelLabels[level];
  }

  /**
   * Validate if input is a proper academic subject
   */
  private isValidAcademicSubject(input: string): boolean {
    // Reject obviously non-academic inputs
    const invalidPatterns = [
      /^(hi|hey|hello|yes|no|ok|okay|sure|maybe|i|me|my|the|a|an|and|or|but)$/i,
      /^(my name is|i am|i'm|this is)/i,
      /^(one|two|three|four|five|six|seven|eight|nine|ten|\d+)$/i,
      /^.{1,2}$/i, // Too short (1-2 characters)
      /^.{50,}$/i, // Too long (50+ characters)
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(input)) {
        return false;
      }
    }

    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(input)) {
      return false;
    }

    // Valid academic subjects (partial list)
    const validSubjects = [
      "math",
      "mathematics",
      "algebra",
      "calculus",
      "geometry",
      "statistics",
      "science",
      "physics",
      "chemistry",
      "biology",
      "anatomy",
      "physiology",
      "history",
      "american history",
      "world history",
      "european history",
      "english",
      "literature",
      "writing",
      "composition",
      "grammar",
      "computer science",
      "programming",
      "coding",
      "software engineering",
      "art",
      "music",
      "philosophy",
      "psychology",
      "sociology",
      "anthropology",
      "economics",
      "political science",
      "government",
      "civics",
      "geography",
      "geology",
      "astronomy",
      "astrophysics",
      "engineering",
      "mechanical engineering",
      "electrical engineering",
      "business",
      "marketing",
      "accounting",
      "finance",
      "medicine",
      "nursing",
      "health",
      "nutrition",
      "education",
      "pedagogy",
      "linguistics",
      "foreign language",
      "spanish",
      "french",
      "german",
      "chinese",
      "japanese",
    ];

    // Check if input contains any valid subject keywords
    const inputLower = input.toLowerCase();
    return validSubjects.some(
      (subject) => inputLower.includes(subject) || subject.includes(inputLower)
    );
  }

  /**
   * Validate if input is a proper academic level
   */
  private isValidAcademicLevel(input: string): boolean {
    const validLevels = [
      "elementary",
      "middle school",
      "high school",
      "undergraduate",
      "graduate",
      "professional",
      "college",
      "university",
    ];

    const inputLower = input.toLowerCase();
    return validLevels.some(
      (level) => inputLower.includes(level) || level.includes(inputLower)
    );
  }

  /**
   * Capitalize words in a string
   */
  private capitalizeWords(str: string): string {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Check if currently collecting topic information
   */
  isCollecting(): boolean {
    return this.state.isCollecting;
  }

  /**
   * Get current collection state
   */
  getState(): TopicCollectionState {
    return { ...this.state };
  }

  /**
   * Cancel topic collection
   */
  async cancelCollection(): Promise<void> {
    this.state.isCollecting = false;
    this.state.currentStep = "subject";
    this.state.collectedData = {};
    this.onCompleteCallback = null;

    await this.session.layouts.showTextWall("❌ Topic collection cancelled", {
      durationMs: 3000,
    });
    this.session.logger.info("Topic collection cancelled");
  }
}
