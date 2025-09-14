/**
 * Configuration settings for the lecture assistant application
 */

export const ENV_CONFIG = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  MENTRAOS_API_KEY:
    process.env.MENTRAOS_API_KEY ||
    "697793ee97a6e87a48fe3ae4be6f358798c3103d36522073b70f4b2c95be2964",
  PORT: parseInt(process.env.PORT || "3000"),
  PACKAGE_NAME: process.env.PACKAGE_NAME || "com.hackmit.lectureassistant",
};

// Display duration for UI elements (in milliseconds)
export const DISPLAY_DURATION_MS = {
  SHORT: 2000,
  MEDIUM: 4000,
  LONG: 6000,
  KEYWORD_DEFINITION: 5000, // Duration to show keyword definitions
};

// Keyword generation settings
export const KEYWORD_CONFIG = {
  MAX_KEYWORDS_PER_TOPIC: 10,
  MIN_KEYWORD_LENGTH: 2,
  MAX_KEYWORD_LENGTH: 50,
};

// Topic collection settings
export const TOPIC_CONFIG = {
  MAX_RETRIES: 3,
  CONFIRMATION_TIMEOUT: 10000,
};
