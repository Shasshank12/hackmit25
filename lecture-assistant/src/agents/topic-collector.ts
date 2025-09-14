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
            currentStep: 'subject',
            collectedData: {},
        };
    }

    /**
     * Start topic collection process
     */
    async startCollection(onComplete: (topic: LectureTopic) => void): Promise<void> {
        this.state.isCollecting = true;
        this.state.currentStep = 'subject';
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

        this.session.logger.info(`Processing topic collection input: "${transcript}" for step: ${this.state.currentStep}`);

        const normalizedInput = transcript.toLowerCase().trim();

        switch (this.state.currentStep) {
            case 'subject':
                return await this.processSubjectInput(normalizedInput);
            case 'subtopic':
                return await this.processSubtopicInput(normalizedInput);
            case 'level':
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
            this.state.currentStep = 'subtopic';
            
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
            this.state.currentStep = 'level';
            
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
                subject = subject.replace(/^(the|a|an)\s+/i, '');
                subject = subject.replace(/\s+(class|course|subject|topic)$/i, '');
                
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
                subtopic = subtopic.replace(/^(the|a|an)\s+/i, '');
                subtopic = subtopic.replace(/\s+(class|course|subject|topic)$/i, '');
                
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
        const levelMappings: { [key: string]: AcademicLevel } = {
            // High school variations
            'high school': 'high_school',
            'highschool': 'high_school',
            'hs': 'high_school',
            'secondary': 'high_school',
            'grade 9': 'high_school',
            'grade 10': 'high_school',
            'grade 11': 'high_school',
            'grade 12': 'high_school',
            
            // College variations
            'college': 'college',
            'undergraduate': 'college',
            'undergrad': 'college',
            'bachelor': 'college',
            'bachelor\'s': 'college',
            'university': 'college',
            'freshman': 'college',
            'sophomore': 'college',
            'junior': 'college',
            'senior': 'college',
            
            // Masters variations
            'masters': 'masters',
            'master\'s': 'masters',
            'graduate': 'masters',
            'grad': 'masters',
            'ms': 'masters',
            'ma': 'masters',
            
            // PhD variations
            'phd': 'phd',
            'ph.d': 'phd',
            'doctorate': 'phd',
            'doctoral': 'phd',
            'ph.d.': 'phd',
            
            // Professional variations
            'professional': 'professional',
            'work': 'professional',
            'industry': 'professional',
            'career': 'professional',
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
        const prompt = "🎓 Let's start your lecture!\n\nWhat subject are you studying?\n\nSay: 'American History' or 'Mathematics'";
        
        await this.session.layouts.showTextWall(prompt, { durationMs: 8000 });
        this.session.logger.info("Displayed subject collection prompt");
    }

    /**
     * Show subtopic prompt
     */
    private async showSubtopicPrompt(subject: string): Promise<void> {
        const prompt = `📚 Great! Subject: ${subject}\n\nWhat specific topic or chapter?\n\nSay: 'World War 2' or 'Chapter 5'`;
        
        await this.session.layouts.showTextWall(prompt, { durationMs: 8000 });
        this.session.logger.info(`Displayed subtopic collection prompt for subject: ${subject}`);
    }

    /**
     * Show level prompt
     */
    private async showLevelPrompt(): Promise<void> {
        const prompt = "🎯 What's your academic level?\n\nSay: 'High School', 'College', 'Masters', or 'PhD'";
        
        await this.session.layouts.showTextWall(prompt, { durationMs: 8000 });
        this.session.logger.info("Displayed level collection prompt");
    }

    /**
     * Show subject clarification prompt
     */
    private async showSubjectClarificationPrompt(): Promise<void> {
        const prompt = "❓ I didn't catch the subject clearly.\n\nPlease say the subject name clearly.\n\nExample: 'American History'";
        
        await this.session.layouts.showTextWall(prompt, { durationMs: 6000 });
        this.session.logger.info("Displayed subject clarification prompt");
    }

    /**
     * Show subtopic clarification prompt
     */
    private async showSubtopicClarificationPrompt(): Promise<void> {
        const prompt = "❓ I didn't catch the specific topic.\n\nPlease say the topic or chapter clearly.\n\nExample: 'World War 2'";
        
        await this.session.layouts.showTextWall(prompt, { durationMs: 6000 });
        this.session.logger.info("Displayed subtopic clarification prompt");
    }

    /**
     * Show level clarification prompt
     */
    private async showLevelClarificationPrompt(): Promise<void> {
        const prompt = "❓ I didn't catch your academic level.\n\nPlease say: 'High School', 'College', 'Masters', or 'PhD'";
        
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
            level: this.state.collectedData.level!,
            timestamp: new Date(),
        };

        this.state.isCollecting = false;
        this.state.currentStep = 'complete';

        // Show completion message
        const completionMessage = `✅ Lecture Setup Complete!\n\n📚 Subject: ${topic.subject}\n📖 Topic: ${topic.subtopic}\n🎓 Level: ${this.formatAcademicLevel(topic.level)}\n\n🎤 Lecture recording starting now!`;
        
        await this.session.layouts.showTextWall(completionMessage, { durationMs: 5000 });
        
        this.session.logger.info(`Topic collection completed: ${JSON.stringify(topic)}`);

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
            'high_school': 'High School',
            'college': 'College',
            'masters': 'Masters',
            'phd': 'PhD',
            'professional': 'Professional',
        };

        return levelLabels[level];
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
        this.state.currentStep = 'subject';
        this.state.collectedData = {};
        this.onCompleteCallback = null;

        await this.session.layouts.showTextWall("❌ Topic collection cancelled", { durationMs: 3000 });
        this.session.logger.info("Topic collection cancelled");
    }
}
