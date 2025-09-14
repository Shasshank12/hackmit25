# Transcript Processing Feature

This feature allows you to process lecture transcript files (.txt) to generate detailed study notes and flashcards using Claude AI.

## Features

- **Detailed Notes Generation**: Convert raw transcripts into structured, comprehensive study notes
- **Intelligent Flashcard Creation**: Generate term/definition flashcards from the processed notes
- **Multiple Output Formats**: Save notes as Markdown and flashcards as JSON
- **Customizable Processing**: Control note style, flashcard difficulty, and focus areas
- **Quality Validation**: Built-in validation and suggestions for generated content

## Setup

### Prerequisites

1. **Anthropic API Key**: You need a Claude API key from Anthropic
   - Sign up at [console.anthropic.com](https://console.anthropic.com)
   - Create an API key and set it as an environment variable

2. **Dependencies**: Install the required packages
   ```bash
   npm install @anthropic-ai/sdk
   ```

### Configuration

Set your API key as an environment variable:

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

Or create a `.env` file:
```
ANTHROPIC_API_KEY=your-api-key-here
```

## Usage

### Basic Usage

```typescript
import { processTranscriptFile } from './src/transcript-to-notes';

// Process a transcript file
const result = await processTranscriptFile('lecture1.txt', {
  noteStyle: 'detailed',
  maxFlashcards: 20,
  flashcardDifficulty: 'intermediate'
});

console.log('Notes:', result.notes);
console.log('Flashcards:', result.flashcards);
```

### Advanced Usage

```typescript
import { TranscriptToNotesProcessor } from './src/transcript-to-notes';

const processor = new TranscriptToNotesProcessor();

// Full workflow with custom options
const result = await processor.processTranscriptFile('lecture.txt', {
  outputDir: './output',
  noteStyle: 'outline',
  maxFlashcards: 15,
  flashcardDifficulty: 'advanced',
  focusAreas: ['algorithms', 'data structures', 'complexity analysis'],
  saveNotes: true,
  saveFlashcards: true
});
```

### Command Line Demo

Run the demo script:

```bash
# Basic usage
ANTHROPIC_API_KEY=your_key npm run demo:transcript lecture1.txt

# Or if you have the key in your environment
npm run demo:transcript lecture1.txt
```

## API Reference

### Main Classes

#### `TranscriptToNotesProcessor`

Main orchestrator class for the transcript processing workflow.

**Constructor:**
```typescript
new TranscriptToNotesProcessor(anthropicApiKey?: string)
```

**Methods:**

- `processTranscriptFile(inputFilePath, options)` - Complete workflow
- `processTranscriptContent(content, sourceId, options)` - Process content directly
- `generateNotesOnly(inputFilePath, options)` - Generate only notes
- `generateFlashcardsOnly(inputFilePath, options)` - Generate only flashcards
- `validateConfiguration()` - Check API key availability

#### `TranscriptProcessor`

Handles note generation using Claude API.

**Methods:**
- `processTranscript(transcript, sourceFile, options)` - Generate structured notes
- `formatAsMarkdown(notes)` - Format notes as Markdown
- `validateApiKey()` - Check API key

#### `FlashcardGenerator`

Creates flashcards from processed notes.

**Methods:**
- `generateFlashcards(notes, options)` - Generate flashcards from notes
- `generateFlashcardsFromTranscript(transcript, sourceFile, options)` - Direct generation
- `exportFlashcards(flashcardSet, format)` - Export in different formats
- `validateFlashcards(flashcardSet)` - Quality validation

### Options

#### Processing Options

```typescript
{
  outputDir?: string;                    // Output directory
  noteStyle?: 'detailed' | 'concise' | 'outline';  // Note detail level
  maxFlashcards?: number;               // Max flashcards to generate
  flashcardDifficulty?: 'basic' | 'intermediate' | 'advanced';
  focusAreas?: string[];                // Topics to emphasize
  saveNotes?: boolean;                  // Save notes to file
  saveFlashcards?: boolean;             // Save flashcards to file
}
```

#### Note Styles

- **`detailed`**: Comprehensive notes with thorough explanations
- **`concise`**: Bullet-point style with key information
- **`outline`**: Hierarchical structure with clear organization

#### Flashcard Difficulties

- **`basic`**: Simple definitions and concepts
- **`intermediate`**: Balanced complexity with applications
- **`advanced`**: Complex relationships and analysis

### Output Formats

#### Notes Output (Markdown)

```markdown
# Lecture Notes

**Source:** lecture1.txt  
**Generated:** 2024-01-15

## Summary
Brief overview of the lecture content...

## Key Points
- Important concept 1
- Important concept 2
- ...

## Detailed Notes
### Topic 1
Detailed explanation...

### Topic 2
More detailed content...
```

#### Flashcards Output (JSON)

```json
{
  "title": "Flashcards - lecture1.txt",
  "description": "Study flashcards generated from lecture transcript",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "cards": [
    {
      "term": "Algorithm",
      "definition": "A step-by-step procedure for solving a problem..."
    },
    {
      "term": "What is Big O notation?",
      "definition": "A mathematical notation that describes the limiting behavior..."
    }
  ],
  "sourceNotes": "Generated from transcript analysis..."
}
```

## Examples

### Example 1: Computer Science Lecture

```typescript
const result = await processTranscriptFile('cs101-lecture.txt', {
  noteStyle: 'detailed',
  maxFlashcards: 25,
  flashcardDifficulty: 'intermediate',
  focusAreas: ['algorithms', 'data structures', 'time complexity'],
});

// Output files:
// - cs101-lecture_notes.md
// - cs101-lecture_flashcards.json
```

### Example 2: History Lecture

```typescript
const result = await processTranscriptFile('history-lecture.txt', {
  noteStyle: 'outline',
  maxFlashcards: 15,
  flashcardDifficulty: 'basic',
  focusAreas: ['dates', 'key figures', 'major events'],
});
```

### Example 3: Processing Content Directly

```typescript
const transcriptContent = "Today we'll discuss machine learning...";

const result = await processor.processTranscriptContent(
  transcriptContent,
  'ml-basics',
  {
    noteStyle: 'concise',
    maxFlashcards: 10,
    focusAreas: ['supervised learning', 'neural networks']
  }
);
```

## File Structure

The feature adds these new files to the project:

```
src/
├── agents/
│   ├── transcript-processor.ts     # Claude integration for notes
│   └── flashcard-generator.ts     # Flashcard generation
├── utils/
│   └── file-utils.ts              # File I/O utilities
├── transcript-to-notes.ts         # Main orchestrator
├── demo-transcript-processing.ts  # Demo script
└── types.ts                       # Updated with new types
```

## Error Handling

The feature includes comprehensive error handling:

- **File validation**: Checks for .txt extension and file existence
- **API errors**: Handles Claude API failures with descriptive messages
- **Content validation**: Validates generated flashcards for quality
- **Configuration checks**: Verifies API key availability

## Best Practices

1. **Transcript Quality**: Ensure transcripts are clear and well-formatted
2. **API Limits**: Be mindful of Claude API rate limits and token usage
3. **Focus Areas**: Use specific focus areas for better results
4. **File Management**: Organize output files in dedicated directories
5. **Quality Review**: Always review generated content for accuracy

## Troubleshooting

### Common Issues

1. **Missing API Key**
   ```
   Error: Missing required configuration: ANTHROPIC_API_KEY
   ```
   Solution: Set the `ANTHROPIC_API_KEY` environment variable

2. **File Not Found**
   ```
   Error: Input file does not exist: lecture.txt
   ```
   Solution: Check the file path and ensure the file exists

3. **Invalid File Type**
   ```
   Error: Input file must be a .txt file
   ```
   Solution: Convert your transcript to a .txt file

4. **Short Transcript Warning**
   ```
   Warning: Transcript seems very short, results may be limited
   ```
   Solution: Provide longer, more detailed transcripts for better results

### Getting Help

- Check the demo script for usage examples
- Review the generated files for quality
- Adjust processing options based on your needs
- Ensure your transcript is clear and well-structured

## Integration with Existing App

This feature is designed to work alongside the existing lecture assistant functionality. You can:

1. Use it as a standalone transcript processor
2. Integrate it into the existing lecture workflow
3. Add it as a post-processing step for recorded lectures
4. Use it to enhance the existing key term extraction

The feature maintains compatibility with existing types and patterns used in the codebase.
