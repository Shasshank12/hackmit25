// Core conversation types
export interface TranscriptSegment {
    type: 'transcript';
    text: string;
    timestamp: number;
}

export interface KeyTermSegment {
    type: 'key_term';
    term: string;
    definition: string;
    confidence: number;
    timestamp: number;
    context: string;
}

// Action types for agent responses
export enum Action {
    SHOW_TERM = 'show_term',           // Display key term definition
    SHOW_CAPTION = 'show_caption',     // Display live caption
    SILENT = 'silent',                 // Stay quiet
    PROCESS = 'process',               // Process transcript for key terms
}

// Agent types
export enum AgentType {
    LectureProcessor = 'LectureProcessor',    // Main transcript processor
    KeyTermDetector = 'KeyTermDetector',      // Detects academic terms
    DefinitionProvider = 'DefinitionProvider', // Provides definitions
    CaptionManager = 'CaptionManager',        // Manages live captions
}

// Agent response types
export interface AgentShowTerm {
    type: Action.SHOW_TERM;
    reasoning: string;
    timestamp: number;
    output: {
        term: string;
        definition: string;
        context: string;
    };
    confidence: number;
    metadata: {
        agentType: AgentType;
        source?: string;
    };
}

export interface AgentShowCaption {
    type: Action.SHOW_CAPTION;
    reasoning: string;
    timestamp: number;
    output: string; // Caption text
    metadata: {
        agentType: AgentType;
    };
}

export interface AgentSilent {
    type: Action.SILENT;
    reasoning: string;
    timestamp: number;
}

export interface AgentProcess {
    type: Action.PROCESS;
    reasoning: string;
    timestamp: number;
    payload: {
        transcript: string;
        extractKeyTerms: boolean;
    };
}

// Union type for all agent responses
export type AgentResponse = AgentShowTerm | AgentShowCaption | AgentSilent | AgentProcess;

// The main conversation flow
export type Conversation = (TranscriptSegment | KeyTermSegment | AgentResponse)[];

// Lecture session data
export interface LectureSession {
    id: string;
    userId: string;
    startTime: Date;
    endTime?: Date;
    duration: number;
    transcript: string;
    keyTermsCount: number;
    status: 'active' | 'completed' | 'paused';
}

// Key term interface
export interface KeyTerm {
    term: string;
    definition: string;
    confidence: number;
    timestamp: Date;
    context: string;
    category?: string;
}

// Stored key term with additional metadata
export interface StoredKeyTerm extends KeyTerm {
    id: string;
    sessionId: string;
    userId: string;
}

// Sensor data interface
export interface SensorData {
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

// Display modes
export enum DisplayMode {
    MAIN_MENU = 'main_menu',
    LIVE_CAPTIONS = 'live_captions',
    KEY_TERMS = 'key_terms',
    LECTURE_COMPLETE = 'lecture_complete'
}

// Event interfaces
export interface ButtonEvent {
    action: string;
    button?: string;
}

export interface VoiceEvent {
    transcript: string;
    confidence?: number;
}

export interface SensorEvent {
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
