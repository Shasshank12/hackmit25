import { KeyTerm } from "./KeyTermExtractor";

export interface LectureSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  transcript: string;
  keyTermsCount: number;
}

export interface StoredKeyTerm extends KeyTerm {
  id: string;
  sessionId: string;
  userId: string;
}

export class DatabaseManager {
  private sessions: Map<string, LectureSession> = new Map();
  private keyTerms: Map<string, StoredKeyTerm[]> = new Map();

  constructor() {
    // In a real implementation, this would connect to a database like:
    // - PostgreSQL
    // - MongoDB
    // - SQLite
    // - Firebase Firestore
    console.log(
      "Database manager initialized (using in-memory storage for demo)"
    );
  }

  public async saveLectureSession(session: LectureSession): Promise<void> {
    try {
      this.sessions.set(session.id, session);
      console.log(`Saved lecture session: ${session.id}`);
    } catch (error) {
      console.error("Error saving lecture session:", error);
      throw error;
    }
  }

  public async saveKeyTerms(
    sessionId: string,
    userId: string,
    keyTerms: KeyTerm[]
  ): Promise<void> {
    try {
      const storedKeyTerms: StoredKeyTerm[] = keyTerms.map((term, index) => ({
        ...term,
        id: `${sessionId}-${index}`,
        sessionId,
        userId,
      }));

      // Store key terms by session ID
      this.keyTerms.set(sessionId, storedKeyTerms);

      console.log(
        `Saved ${keyTerms.length} key terms for session: ${sessionId}`
      );
    } catch (error) {
      console.error("Error saving key terms:", error);
      throw error;
    }
  }

  public async getLectureSession(
    sessionId: string
  ): Promise<LectureSession | null> {
    try {
      return this.sessions.get(sessionId) || null;
    } catch (error) {
      console.error("Error retrieving lecture session:", error);
      throw error;
    }
  }

  public async getKeyTermsForSession(
    sessionId: string
  ): Promise<StoredKeyTerm[]> {
    try {
      return this.keyTerms.get(sessionId) || [];
    } catch (error) {
      console.error("Error retrieving key terms:", error);
      throw error;
    }
  }

  public async getUserSessions(userId: string): Promise<LectureSession[]> {
    try {
      const userSessions: LectureSession[] = [];

      for (const session of this.sessions.values()) {
        if (session.userId === userId) {
          userSessions.push(session);
        }
      }

      return userSessions.sort(
        (a, b) => b.startTime.getTime() - a.startTime.getTime()
      );
    } catch (error) {
      console.error("Error retrieving user sessions:", error);
      throw error;
    }
  }

  public async getUserKeyTerms(
    userId: string,
    limit: number = 50
  ): Promise<StoredKeyTerm[]> {
    try {
      const userKeyTerms: StoredKeyTerm[] = [];

      for (const sessionTerms of this.keyTerms.values()) {
        const userTermsInSession = sessionTerms.filter(
          (term) => term.userId === userId
        );
        userKeyTerms.push(...userTermsInSession);
      }

      return userKeyTerms
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
    } catch (error) {
      console.error("Error retrieving user key terms:", error);
      throw error;
    }
  }

  public async searchKeyTerms(
    query: string,
    userId?: string
  ): Promise<StoredKeyTerm[]> {
    try {
      const allKeyTerms: StoredKeyTerm[] = [];

      for (const sessionTerms of this.keyTerms.values()) {
        allKeyTerms.push(...sessionTerms);
      }

      const filteredTerms = allKeyTerms.filter((term) => {
        const matchesQuery =
          term.term.toLowerCase().includes(query.toLowerCase()) ||
          term.definition.toLowerCase().includes(query.toLowerCase()) ||
          term.context.toLowerCase().includes(query.toLowerCase());

        const matchesUser = !userId || term.userId === userId;

        return matchesQuery && matchesUser;
      });

      return filteredTerms.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error("Error searching key terms:", error);
      throw error;
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    try {
      this.sessions.delete(sessionId);
      this.keyTerms.delete(sessionId);
      console.log(`Deleted session: ${sessionId}`);
    } catch (error) {
      console.error("Error deleting session:", error);
      throw error;
    }
  }

  public async getStatistics(userId: string): Promise<{
    totalSessions: number;
    totalKeyTerms: number;
    averageSessionDuration: number;
    mostCommonTerms: { term: string; count: number }[];
  }> {
    try {
      const userSessions = await this.getUserSessions(userId);
      const userKeyTerms = await this.getUserKeyTerms(userId);

      const totalSessions = userSessions.length;
      const totalKeyTerms = userKeyTerms.length;

      const averageSessionDuration =
        totalSessions > 0
          ? userSessions.reduce((sum, session) => sum + session.duration, 0) /
            totalSessions
          : 0;

      // Count term frequency
      const termCounts = new Map<string, number>();
      userKeyTerms.forEach((term) => {
        const count = termCounts.get(term.term) || 0;
        termCounts.set(term.term, count + 1);
      });

      const mostCommonTerms = Array.from(termCounts.entries())
        .map(([term, count]) => ({ term, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalSessions,
        totalKeyTerms,
        averageSessionDuration,
        mostCommonTerms,
      };
    } catch (error) {
      console.error("Error getting statistics:", error);
      throw error;
    }
  }
}
