import { Action, AgentType, type AgentResponse, DisplayMode } from "../types";
import { DISPLAY_DURATION_MS } from "../config";

/**
 * Agent responsible for managing live captions and display modes
 */
export class CaptionManager {
  private currentDisplayMode: DisplayMode = DisplayMode.MAIN_MENU;
  private isDisplaying: boolean = false;
  private displayTimer: NodeJS.Timeout | null = null;
  private currentDisplayText: string | null = null;

  /**
   * Show live captions
   */
  showLiveCaptions(text: string, timestamp: number): AgentResponse {
    if (
      this.isDisplaying &&
      this.currentDisplayMode === DisplayMode.KEY_TERMS
    ) {
      // Don't interrupt key term display
      return {
        type: Action.SILENT,
        reasoning:
          "Key terms are being displayed, not interrupting with captions",
        timestamp,
      };
    }

    const formattedText = this.formatCaptionText(text);

    this.setDisplay(
      formattedText,
      DisplayMode.LIVE_CAPTIONS,
      DISPLAY_DURATION_MS
    );

    return {
      type: Action.SHOW_CAPTION,
      reasoning: "Displaying live captions for ongoing lecture",
      timestamp,
      output: formattedText,
      metadata: {
        agentType: AgentType.CaptionManager,
      },
    };
  }

  /**
   * Show key term definition
   */
  showKeyTerm(
    term: string,
    definition: string,
    context: string,
    timestamp: number
  ): AgentResponse {
    if (
      this.isDisplaying &&
      this.currentDisplayMode === DisplayMode.KEY_TERMS
    ) {
      // Don't interrupt existing key term display
      return {
        type: Action.SILENT,
        reasoning: "Another key term is being displayed",
        timestamp,
      };
    }

    const formattedDisplay = this.formatKeyTermDisplay(
      term,
      definition,
      context
    );

    this.setDisplay(
      formattedDisplay,
      DisplayMode.KEY_TERMS,
      DISPLAY_DURATION_MS
    );

    return {
      type: Action.SHOW_TERM,
      reasoning: "Displaying key term definition",
      timestamp,
      output: {
        term,
        definition,
        context,
      },
      confidence: 0.9,
      metadata: {
        agentType: AgentType.CaptionManager,
      },
    };
  }

  /**
   * Format caption text for display
   */
  private formatCaptionText(text: string): string {
    // Truncate to reasonable length for glasses display
    const maxWords = 30;
    const words = text.trim().split(/\s+/);

    if (words.length <= maxWords) {
      return `🎓 Live: ${text}`;
    }

    const truncated = words.slice(-maxWords).join(" ");
    return `🎓 Live: ...${truncated}`;
  }

  /**
   * Format key term display
   */
  private formatKeyTermDisplay(
    term: string,
    definition: string,
    context: string
  ): string {
    // Truncate definition to fit display
    const maxDefinitionLength = 100;
    let truncatedDefinition = definition;

    if (definition.length > maxDefinitionLength) {
      truncatedDefinition =
        definition.substring(0, maxDefinitionLength).trim() + "...";
    }

    return `🔑 ${term}\n\n${truncatedDefinition}`;
  }

  /**
   * Set display with timeout
   */
  private setDisplay(
    text: string,
    mode: DisplayMode,
    durationMs: number
  ): void {
    // Clear existing timer
    if (this.displayTimer) {
      clearTimeout(this.displayTimer);
    }

    this.isDisplaying = true;
    this.currentDisplayMode = mode;
    this.currentDisplayText = text;

    // Set timer to clear display
    this.displayTimer = setTimeout(() => {
      this.clearDisplay();
    }, durationMs);
  }

  /**
   * Clear current display
   */
  private clearDisplay(): void {
    this.isDisplaying = false;
    this.currentDisplayMode = DisplayMode.MAIN_MENU;
    this.currentDisplayText = null;

    if (this.displayTimer) {
      clearTimeout(this.displayTimer);
      this.displayTimer = null;
    }
  }

  /**
   * Force clear display (for external control)
   */
  forceClear(): void {
    this.clearDisplay();
  }

  /**
   * Check if display is currently busy
   */
  isDisplayBusy(): boolean {
    return this.isDisplaying;
  }

  /**
   * Get current display mode
   */
  getCurrentDisplayMode(): DisplayMode {
    return this.currentDisplayMode;
  }

  /**
   * Get current display text
   */
  getCurrentDisplayText(): string | null {
    return this.currentDisplayText;
  }

  /**
   * Show main menu
   */
  showMainMenu(timestamp: number): AgentResponse {
    const menuText =
      "🎓 Lecture Assistant\n\nPress button or say 'start lecture' to begin\n\nReady to capture knowledge!";

    this.setDisplay(menuText, DisplayMode.MAIN_MENU, 0); // No timeout for main menu

    return {
      type: Action.SHOW_CAPTION,
      reasoning: "Displaying main menu",
      timestamp,
      output: menuText,
      metadata: {
        agentType: AgentType.CaptionManager,
      },
    };
  }

  /**
   * Show lecture complete summary
   */
  showLectureComplete(
    duration: number,
    keyTermsCount: number,
    timestamp: number
  ): AgentResponse {
    const minutes = Math.round(duration / 60);
    const summaryText = `📚 Lecture Complete!\n\nDuration: ${minutes} min\nKey Terms: ${keyTermsCount}\n\nPress button for new lecture`;

    this.setDisplay(summaryText, DisplayMode.LECTURE_COMPLETE, 10000); // 10 second display

    return {
      type: Action.SHOW_CAPTION,
      reasoning: "Displaying lecture completion summary",
      timestamp,
      output: summaryText,
      metadata: {
        agentType: AgentType.CaptionManager,
      },
    };
  }

  /**
   * Handle head tilt for key terms view
   */
  handleHeadTilt(
    recentKeyTerms: Array<{ term: string; definition: string }>,
    timestamp: number
  ): AgentResponse {
    if (recentKeyTerms.length === 0) {
      const noTermsText =
        "🔑 No Key Terms Yet\n\nKeep listening to detect academic concepts!";

      this.setDisplay(noTermsText, DisplayMode.KEY_TERMS, 3000);

      return {
        type: Action.SHOW_CAPTION,
        reasoning: "No key terms available to display",
        timestamp,
        output: noTermsText,
        metadata: {
          agentType: AgentType.CaptionManager,
        },
      };
    }

    // Show most recent key terms
    const termsToShow = recentKeyTerms.slice(0, 3);
    let display = "🔑 Recent Key Terms\n\n";

    termsToShow.forEach((term, index) => {
      display += `${index + 1}. ${term.term}\n`;
      // Truncate definition for display
      const shortDef =
        term.definition.length > 50
          ? term.definition.substring(0, 47) + "..."
          : term.definition;
      display += `   ${shortDef}\n\n`;
    });

    display += "(Straighten head for captions)";

    this.setDisplay(display, DisplayMode.KEY_TERMS, 8000); // 8 second display

    return {
      type: Action.SHOW_CAPTION,
      reasoning: "Displaying recent key terms on head tilt",
      timestamp,
      output: display,
      metadata: {
        agentType: AgentType.CaptionManager,
      },
    };
  }
}
