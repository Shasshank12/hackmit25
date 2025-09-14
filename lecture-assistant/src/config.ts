// Configuration constants for the Lecture Assistant
export const TRANSCRIPT_BUFFER_LENGTH = 100; // Number of transcript segments to keep
export const KEY_TERMS_HISTORY_LENGTH = 50;
export const UTTERANCE_TIMEOUT_MS = 3000;
export const KEY_TERM_CACHE_SIZE = 10;
export const SIMILARITY_THRESHOLD = 0.75;
export const DISPLAY_DURATION_MS = 5000;

// Agent Settings Configuration
export const AGENT_SETTINGS = {
  key_term_frequency: {
    type: "select" as const,
    default: "high",
    label: "Key Term Detection",
    description: "How frequently to detect and display key terms",
    options: [
      { label: "Off", value: "off" },
      { label: "Standard", value: "standard" },
      { label: "High", value: "high" },
    ],
  },
  auto_definitions: {
    type: "switch" as const,
    default: true,
    label: "Auto Definitions",
    description: "Automatically show definitions for detected key terms",
  },
  live_captions: {
    type: "switch" as const,
    default: true,
    label: "Live Captions",
    description: "Show real-time speech transcription",
  },
} as const;

export type AgentSettingsKey = keyof typeof AGENT_SETTINGS;

// Environment configuration
export const ENV_CONFIG = {
  PORT: parseInt(process.env.PORT || "3000"),
  PACKAGE_NAME: process.env.PACKAGE_NAME || "com.hackmit.lectureassistant",
  MENTRAOS_API_KEY:
    process.env.MENTRAOS_API_KEY ||
    "697793ee97a6e87a48fe3ae4be6f358798c3103d36522073b70f4b2c95be2964",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  NODE_ENV: process.env.NODE_ENV || "development",
};
