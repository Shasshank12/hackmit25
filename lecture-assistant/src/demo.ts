#!/usr/bin/env tsx

/**
 * Demo script to test the Lecture Assistant functionality
 * This simulates the core features without requiring actual smart glasses hardware
 */

import { LectureManager } from "./LectureManager";
import { KeyTermExtractor } from "./KeyTermExtractor";
import { DatabaseManager } from "./DatabaseManager";

async function runDemo() {
  console.log("🎓 Lecture Assistant Demo");
  console.log("========================\n");

  // Initialize components
  const lectureManager = new LectureManager();
  const keyTermExtractor = new KeyTermExtractor();
  const databaseManager = new DatabaseManager();

  // Simulate starting a lecture
  console.log("1. Starting lecture mode...");
  await lectureManager.startLecture("demo-session-001");
  console.log("✅ Lecture started\n");

  // Wait for some simulated transcript
  console.log("2. Waiting for lecture content...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Get the current transcript
  const transcript = lectureManager.getCurrentTranscript();
  console.log("📝 Current transcript:");
  console.log(transcript.substring(0, 200) + "...\n");

  // Extract key terms
  console.log("3. Extracting key terms...");
  const keyTerms = await keyTermExtractor.extractKeyTerms(transcript);
  console.log(`✅ Found ${keyTerms.length} key terms:\n`);

  keyTerms.slice(0, 3).forEach((term, index) => {
    console.log(`${index + 1}. ${term.term}`);
    console.log(`   Definition: ${term.definition}`);
    console.log(`   Confidence: ${Math.round(term.confidence * 100)}%\n`);
  });

  // Save to database
  console.log("4. Saving to database...");
  await databaseManager.saveKeyTerms("demo-session-001", "demo-user", keyTerms);
  console.log("✅ Key terms saved\n");

  // Stop the lecture
  console.log("5. Stopping lecture...");
  const lectureData = await lectureManager.stopLecture();

  if (lectureData) {
    console.log(`✅ Lecture stopped`);
    console.log(
      `📊 Duration: ${Math.round(lectureData.duration / 60)} minutes`
    );
    console.log(`📝 Total words: ${lectureData.transcript.split(" ").length}`);
  }

  // Demonstrate recent key terms feature
  console.log("\n6. Testing recent key terms feature...");
  const recentTerms = await keyTermExtractor.getRecentKeyTerms(3);
  console.log("🔑 Most recent key terms:");

  recentTerms.forEach((term, index) => {
    console.log(
      `${index + 1}. ${term.term} - ${term.definition.substring(0, 50)}...`
    );
  });

  // Get user statistics
  console.log("\n7. User statistics:");
  const stats = await databaseManager.getStatistics("demo-user");
  console.log(`📈 Total sessions: ${stats.totalSessions}`);
  console.log(`📚 Total key terms: ${stats.totalKeyTerms}`);
  console.log(
    `⏱️  Average session: ${Math.round(
      stats.averageSessionDuration / 60
    )} minutes`
  );

  if (stats.mostCommonTerms.length > 0) {
    console.log("🔥 Most common terms:");
    stats.mostCommonTerms.slice(0, 3).forEach((item, index) => {
      console.log(`${index + 1}. ${item.term} (${item.count} times)`);
    });
  }

  console.log("\n✨ Demo completed successfully!");
  console.log("🚀 Ready to deploy to MentraOS smart glasses!");
}

// Run the demo
runDemo().catch(console.error);
