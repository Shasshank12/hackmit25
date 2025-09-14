# Prism - HackMIT '25

An intelligent smart glasses application built for MentraOS that transforms the learning experience through real-time transcription, AI-powered note generation, and interactive study tools.

## Overview

Prism is a comprehensive learning ecosystem that captures lectures, processes content with AI, and creates interactive study materials - all optimized for hands-free operation on smart glasses.

## How It Works

### Real-Time Lecture Capture
- **Voice-Activated Recording**: Start/stop with simple voice commands
- **Smart Keyword Detection**: Automatic identification and definition of academic terms
- **Non-Intrusive Display**: Captions and definitions without disrupting focus

### AI-Powered Content Processing
- **Intelligent Note Generation**: Claude Sonnet 4 transforms raw transcripts into structured study notes
- **Automatic Flashcard Creation**: AI generates term/definition pairs for active learning
- **Topic Classification**: Automatic subject and academic level detection
- **Multi-Format Output**: Markdown notes and JSON flashcards

### Interactive Study System
- **Spaced Repetition Quiz**: Queue-based algorithm ensures mastery of difficult concepts
- **Voice Interaction**: Natural language quiz responses
- **Progress Tracking**: Session statistics and completion metrics
- **Smart Answer Validation**: Fuzzy matching for flexible response recognition

## Architecture

### System Design
```
Smart Glasses (MentraOS) → Voice Input/Visual Output
         ↓
Application Layer (Node.js/TypeScript) → Session & Event Management
         ↓
Agent System → Topic Detection | Keyword Extraction | AI Processing
         ↓
Storage Layer → Local Files | Claude Sonnet 4 | JSON Configs
```

### Core Components
- **TopicCollector**: Identifies lecture subject and academic level
- **KeywordGenerator**: Real-time academic term detection and definition
- **TranscriptProcessor**: AI-powered conversion of transcripts to structured notes
- **FlashcardGenerator**: Creates interactive study materials from processed content
- **QuizManager**: Orchestrates spaced repetition learning sessions

## Installation & Setup

### Prerequisites
- Node.js (v18.0.0 or later)
- MentraOS SDK access
- Compatible smart glasses (Even Realities G1, Vuzix Z100, or Mentra Live)
- Anthropic API key for Claude Sonnet 4

### Quick Start

1. **Clone and navigate to the project:**
   ```bash
   cd lecture-assistant
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   export MENTRAOS_API_KEY=your_mentra_api_key
   export ANTHROPIC_API_KEY=your_claude_api_key
   export PORT=3000
   ```

4. **Start the application:**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm run build && npm start
   ```

### Smart Glasses Setup

1. **Expose local server:**
   ```bash
   npx ngrok http 3000
   ```

2. **Connect smart glasses to the ngrok URL**

3. **Begin using voice commands:**
   - "start lecture" - Begin recording
   - "stop lecture" - End session and save transcript

## Usage Workflows

### During Lectures
1. Put on smart glasses and start the app
2. Say "start lecture" to begin recording
3. View real-time captions and keyword definitions
4. Say "stop lecture" to save complete transcript

### Post-Lecture Processing
```bash
# Generate AI-powered notes and flashcards
npm run demo:transcript your-transcript.txt
```

### Study Sessions
```bash
# Interactive flashcard quiz
npm run demo:quiz your-flashcards.json
```

## Output Files & Organization

### Directory Structure
```
lecture-assistant/
├── transcripts/           # Raw lecture recordings with timestamps
├── notes/                 # AI-generated study notes (Markdown)
│   ├── subject/
│   │   └── YYYY-MM-DD_topic_notes.md
├── flashcards/           # Interactive study cards (JSON)
│   ├── subject/
│   │   └── YYYY-MM-DD_topic_flashcards.json
├── keyword-mappings.json # Academic term definitions database
└── transcript.txt        # Latest lecture recording
```

### File Formats

**Raw Transcripts (.txt)**
```
# Lecture Transcript
Generated: 2024-01-15T10:30:00.000Z

[10:30:15] Welcome to today's lecture on machine learning...
[10:30:22] We'll start with basic concepts and definitions...
```

**AI-Generated Notes (.md)**
```markdown
# Lecture Notes
**Source:** ml-lecture.txt
**Generated:** 2024-01-15

## Summary
Overview of machine learning fundamentals...

## Key Points
- Machine learning is a subset of artificial intelligence
- Supervised vs unsupervised learning approaches
- Real-world applications and use cases

## Detailed Notes
### Introduction to Machine Learning
[Comprehensive structured content with examples and explanations]
```

**Flashcard Sets (.json)**
```json
{
  "title": "Machine Learning Basics",
  "description": "Study cards from ML lecture",
  "cards": [
    {
      "term": "What is supervised learning?",
      "definition": "Machine learning using labeled training data to make predictions on new data"
    }
  ]
}
```

## Advanced Features

### Customizable Processing
```bash
# Different note styles
npm run demo:transcript lecture.txt --style detailed|concise|outline

# Flashcard difficulty levels
npm run demo:transcript lecture.txt --difficulty basic|intermediate|advanced

# Focus on specific topics
npm run demo:transcript lecture.txt --focus "algorithms,data structures"
```

### Quiz Algorithm
The system implements a spaced repetition algorithm:
```
while (flashcards remaining):
    card = queue.pop()
    display on glasses
    get voice answer
    if incorrect: queue.push(card)  # Try again later
    else: mark complete
show completion celebration
```

## Development

### Project Structure
```
src/
├── agents/              # AI processing components
│   ├── topic-collector.ts
│   ├── keyword-generator.ts
│   ├── transcript-processor.ts
│   └── flashcard-generator.ts
├── quiz/               # Interactive learning system
│   ├── flashcard-quiz.ts
│   └── quiz-manager.ts
├── utils/              # Utility functions
├── types.ts            # Type definitions
├── config.ts           # Configuration management
└── index.ts            # Main application server
```

### Available Commands
```bash
npm run dev                    # Development server with hot reload
npm run build                  # Build for production
npm run demo:transcript <file> # Process transcript with AI
npm run demo:quiz <file>       # Interactive flashcard quiz
```

### Environment Variables
```bash
MENTRAOS_API_KEY=your_mentra_api_key    # Required: Smart glasses integration
ANTHROPIC_API_KEY=your_claude_api_key   # Required: AI processing
PORT=3000                               # Optional: Server port
NODE_ENV=development|production         # Optional: Environment mode
```

## Technical Specifications

### AI Integration
- **Primary AI**: Claude Sonnet 4 for note generation and flashcard creation
- **Processing**: Real-time keyword detection with confidence scoring
- **Validation**: 70% similarity threshold for quiz answer matching

### Smart Glasses Optimization
- **Display**: Text formatted for small screen readability
- **Voice Commands**: Natural language processing for all interactions
- **Performance**: Optimized for low-latency processing on glasses hardware
- **Battery**: Efficient processing to minimize power consumption

### Data Privacy
- **Local Storage**: All data stored on device, not in cloud
- **File-Based**: No external databases required
- **Secure**: API keys stored in environment variables only

## Use Cases

### For Students
- **Active Learning**: Real-time assistance during lectures
- **Study Preparation**: AI-generated notes and flashcards
- **Exam Review**: Spaced repetition for long-term retention
- **Accessibility**: Support for hearing or attention difficulties

### For Educators
- **Content Analysis**: Understanding challenging concepts
- **Material Generation**: Automatic study aid creation
- **Student Support**: Enhanced accessibility and engagement

### For Institutions
- **Scalable Learning**: Consistent note-taking across courses
- **Analytics**: Understanding learning patterns and needs
- **Technology Integration**: Modern tools for educational enhancement

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with proper TypeScript typing
4. Add tests for new functionality
5. Submit a pull request with detailed description

## License

MIT License - See LICENSE file for details

## Support & Resources

- **MentraOS SDK**: [docs.mentra.glass](https://docs.mentra.glass/)
- **Anthropic Claude**: [console.anthropic.com](https://console.anthropic.com)
- **Issues**: Open GitHub issues for bug reports or feature requests
- **Documentation**: See `TRANSCRIPT_PROCESSING.md` for detailed AI processing info

## Roadmap

- [ ] Multi-language support for international students
- [ ] Integration with popular note-taking apps (Notion, Obsidian)
- [ ] Advanced analytics and learning pattern recognition
- [ ] Collaborative study sessions with shared flashcards
- [ ] Integration with Learning Management Systems (LMS)

---

*Transform your learning experience with AI-powered smart glasses technology. Capture knowledge, process intelligently, and study effectively - all hands-free.*