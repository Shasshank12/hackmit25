/**
 * Type definitions for the lecture assistant application
 */

export enum AcademicLevel {
  ELEMENTARY = "elementary",
  MIDDLE_SCHOOL = "middle_school",
  HIGH_SCHOOL = "high_school",
  UNDERGRADUATE = "undergraduate",
  GRADUATE = "graduate",
  PROFESSIONAL = "professional",
  COLLEGE = "college", // Alias for undergraduate
}

export interface LectureTopic {
  subject: string;
  subtopic: string;
  academicLevel: AcademicLevel;
  level: AcademicLevel; // Alias for compatibility
  keywords?: string[];
  timestamp?: Date;
}

export interface TopicCollectionState {
  isCollecting: boolean;
  currentStep: string;
  collectedData: {
    subject?: string;
    subtopic?: string;
    level?: AcademicLevel;
  };
}

export enum TopicCollectionStep {
  SUBJECT = "subject",
  SUBTOPIC = "subtopic",
  LEVEL = "level",
  CONFIRM = "confirm",
}

export enum Action {
  START_COLLECTION = "start_collection",
  CONFIRM_TOPIC = "confirm_topic",
  RESTART_COLLECTION = "restart_collection",
  CANCEL_COLLECTION = "cancel_collection",
}

export enum AgentType {
  TOPIC_COLLECTOR = "topic_collector",
  KEYWORD_GENERATOR = "keyword_generator",
}

export interface AgentResponse {
  type: AgentType;
  action: Action;
  data?: any;
  message?: string;
}
