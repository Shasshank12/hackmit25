import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Utility functions for file operations related to transcript processing
 */
export class FileUtils {
  /**
   * Read a transcript file (.txt)
   */
  static async readTranscriptFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.trim();
    } catch (error) {
      throw new Error(`Failed to read transcript file: ${error}`);
    }
  }

  /**
   * Save processed notes to a file
   */
  static async saveNotesToFile(
    notes: string,
    outputPath: string
  ): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(dirname(outputPath), { recursive: true });
      
      // Write notes to file
      await fs.writeFile(outputPath, notes, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save notes file: ${error}`);
    }
  }

  /**
   * Save flashcards to a JSON file
   */
  static async saveFlashcardsToFile(
    flashcards: any,
    outputPath: string
  ): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(dirname(outputPath), { recursive: true });
      
      // Write flashcards to JSON file
      const jsonContent = JSON.stringify(flashcards, null, 2);
      await fs.writeFile(outputPath, jsonContent, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save flashcards file: ${error}`);
    }
  }

  /**
   * Generate output file paths based on input file path
   */
  static generateOutputPaths(inputPath: string): {
    notesPath: string;
    flashcardsPath: string;
  } {
    const baseName = inputPath.replace(/\.[^/.]+$/, '');
    return {
      notesPath: `${baseName}_notes.md`,
      flashcardsPath: `${baseName}_flashcards.json`,
    };
  }

  /**
   * Check if file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate file extension
   */
  static validateTranscriptFile(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.txt');
  }
}
