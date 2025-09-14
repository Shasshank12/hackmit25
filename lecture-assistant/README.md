# Simple Lecture Recorder - MentraOS Smart Glasses App

A minimal smart glasses application built for MentraOS that records lecture transcripts and saves them to a file.

## Features

- **Voice-Activated Recording**: Start and stop recording with simple voice commands
- **Real-time Transcription**: Records speech as it happens during lectures
- **File Output**: Automatically saves complete transcript to `transcript.txt`
- **Simple Interface**: Clean, distraction-free recording experience

## How It Works

### Recording Process

1. **Ready State**: App shows instructions and waits for voice command
2. **Recording State**: Actively listening and transcribing speech to memory
3. **Complete State**: Saves full transcript to file and returns to ready state

### Voice Commands

- **"start lecture"** or **"begin lecture"**: Start recording
- **"stop lecture"** or **"end lecture"**: Stop recording and save transcript

## Setup Instructions

### Prerequisites

- Node.js (v18.0.0 or later)
- MentraOS SDK access
- Compatible smart glasses (Even Realities G1, Vuzix Z100, or Mentra Live)

### Installation

1. Navigate to the project:

   ```bash
   cd lecture-assistant
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set environment variables:

   ```bash
   export MENTRAOS_API_KEY=your_api_key_from_console
   export PORT=3000
   ```

4. Build and start:
   ```bash
   npm run build
   npm start
   ```

### Development

Run in development mode:

```bash
npm run dev
```

### Testing with Smart Glasses

1. Use ngrok to expose your local server:

   ```bash
   npx ngrok http 3000
   ```

2. Connect your smart glasses to the ngrok URL
3. Say "start lecture" to begin recording
4. Say "stop lecture" to save the transcript

## Output

The app creates a `transcript.txt` file in the project directory with:

- Timestamp header
- Chronological transcript with timestamps for each utterance
- Complete lecture content ready for review

## Architecture

### Simple Design

- **`src/index.ts`**: Complete application in a single file
- **Voice Recognition**: Built-in MentraOS transcription
- **File Storage**: Direct file system writing
- **No Database**: Transcript saved directly to text file

## File Format

```
# Lecture Transcript
Generated: 2024-01-15T10:30:00.000Z

[2024-01-15T10:30:15.123Z] Welcome to today's lecture on machine learning.
[2024-01-15T10:30:22.456Z] We'll start with basic concepts and definitions.
[2024-01-15T10:30:35.789Z] Machine learning is a subset of artificial intelligence...
```

## License

MIT License - feel free to modify and distribute as needed.

## Support

For issues with MentraOS SDK, visit: https://docs.mentra.glass/
