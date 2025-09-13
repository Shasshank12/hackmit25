# Lecture Assistant - MentraOS Smart Glasses App

A smart glasses application built for MentraOS that helps students during lectures by providing live captioning, key term extraction, and intelligent note-taking features.

## Features

- **Lecture Recording**: Records audio and generates transcripts of lectures
- **Live Captioning**: Real-time speech-to-text display on smart glasses
- **Key Term Extraction**: Automatically identifies and defines important academic terms
- **Head Gesture Control**: Switch between live captions and key terms display by tilting your head
- **Database Storage**: Saves key terms and definitions for later review
- **Button Control**: Start/stop lecture mode with smart glasses button

## How It Works

### Lecture Mode States

1. **Main Menu**: Default state showing app title and instructions
2. **Live Captions Mode**: Shows real-time transcription of the lecture (normal head position)
3. **Key Terms Mode**: Displays the 3 most recent key terms with definitions (head tilted)

### Controls

- **Button Press**: Toggle lecture mode on/off
- **Voice Commands**: "start lecture" or "stop lecture"
- **Head Tilt**: Switch between live captions and key terms display

## Setup Instructions

### Prerequisites

- Node.js (v18.0.0 or later)
- MentraOS SDK access
- Compatible smart glasses (Even Realities G1, Vuzix Z100, or Mentra Live)

### Installation

1. Clone and navigate to the project:

   ```bash
   cd lecture-assistant
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your MentraOS API key:

   ```
   PORT=3000
   PACKAGE_NAME=com.hackmit.lectureassistant
   MENTRAOS_API_KEY=your_api_key_from_console
   DATABASE_URL=your_database_url_here
   ```

4. Build the project:
   ```bash
   npm run build
   ```

### Development

Run in development mode with hot reload:

```bash
npm run dev
```

### Production

Build and start the production server:

```bash
npm run build
npm start
```

### Testing with ngrok

To test on actual smart glasses devices, expose your local server:

```bash
npx ngrok http 3000
```

Use the provided ngrok URL to connect your smart glasses to the app.

## Architecture

### Core Components

- **`index.ts`**: Main application server and session management
- **`LectureManager.ts`**: Handles lecture recording, speech recognition, and state management
- **`KeyTermExtractor.ts`**: NLP processing for identifying and defining key terms
- **`DatabaseManager.ts`**: Data persistence for sessions and key terms

### Key Features Implementation

#### Speech Recognition

- Continuous audio processing during lecture mode
- Real-time transcript generation
- Simulated speech recognition for development (replace with actual API in production)

#### Key Term Extraction

- Pattern matching for academic terminology
- Contextual definition lookup
- Confidence scoring and ranking
- Real-time processing of new transcript segments

#### Head Gesture Detection

- Accelerometer data processing
- Tilt threshold configuration
- State switching between UI modes

#### Database Storage

- In-memory storage for development
- Designed for easy integration with PostgreSQL, MongoDB, or other databases
- Session and key term persistence
- User statistics and search functionality

## Customization

### Adding New Key Terms

Edit the `definitions` object in `KeyTermExtractor.ts`:

```typescript
const definitions: { [key: string]: string } = {
  "your-term": "Your definition here",
  // ... other terms
};
```

### Adjusting Head Tilt Sensitivity

Modify the `tiltThreshold` in the `isHeadTilted` method:

```typescript
const tiltThreshold = 0.3; // Increase for less sensitivity, decrease for more
```

### Configuring Speech Recognition

Replace the simulated speech recognition in `LectureManager.ts` with actual APIs:

- Google Speech-to-Text API
- Azure Speech Services
- Amazon Transcribe
- OpenAI Whisper API

## Production Considerations

1. **Speech Recognition**: Integrate with professional speech-to-text services
2. **Key Term Extraction**: Use advanced NLP models (GPT, BERT, or custom models)
3. **Database**: Implement proper database connection (PostgreSQL, MongoDB)
4. **Security**: Add authentication and user management
5. **Performance**: Optimize for low-latency processing on smart glasses hardware
6. **Privacy**: Ensure secure handling of audio data and transcripts

## API Integration Examples

### Google Speech-to-Text

```typescript
import { SpeechClient } from "@google-cloud/speech";
const client = new SpeechClient();
```

### OpenAI GPT for Key Terms

```typescript
import { OpenAI } from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

## License

MIT License - feel free to modify and distribute as needed.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues with MentraOS SDK, visit: https://docs.mentra.glass/
For app-specific issues, please open a GitHub issue.
