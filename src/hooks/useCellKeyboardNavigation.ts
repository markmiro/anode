import { useCallback } from "react";

interface CellKeyboardNavigationOptions {
  onFocusNext?: () => void;
  onFocusPrevious?: () => void;
  onExecute?: () => void;
  onUpdateSource?: () => void;
  onDeleteCell?: () => void;
}

// New event type for keydown
export interface CellKeyDownEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  selectionStart: number;
  selectionEnd: number;
  value: string;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

export const useCellKeyboardNavigation = ({
  onFocusNext,
  onFocusPrevious,
  onDeleteCell,
  onExecute,
  onUpdateSource,
}: CellKeyboardNavigationOptions) => {
  const handleKeyDown = useCallback(
    ({
      key,
      ctrlKey = false,
      metaKey = false,
      selectionStart,
      selectionEnd,
      value,
      preventDefault = () => {},
      stopPropagation = () => {},
    }: CellKeyDownEvent) => {
      // console.log("e", arguments[0]);

      if (
        key === "Backspace" &&
        selectionStart === selectionEnd &&
        selectionStart === 0
      ) {
        preventDefault();
        onDeleteCell?.();
        onFocusPrevious?.();
        return;
      }

      // Handle Home/End keys to prevent page navigation
      if (key === "Home" || key === "End") {
        // Let the editor handle Home/End internally, but stop propagation to prevent page scroll
        stopPropagation();
        return;
      }

      // Handle arrow key navigation between cells
      if (key === "ArrowUp" && selectionStart === selectionEnd) {
        // Check if cursor is at the beginning of the first line
        const beforeCursor = value.substring(0, selectionStart);
        const currentLineIndex = beforeCursor.split("\n").length - 1;
        const lastNewlineIndex = beforeCursor.lastIndexOf("\n");
        const positionInLine =
          lastNewlineIndex === -1
            ? selectionStart
            : selectionStart - lastNewlineIndex - 1;

        if (currentLineIndex === 0) {
          // We're on the first line
          if (positionInLine === 0) {
            // At the very beginning - move to previous cell
            if (onFocusPrevious) {
              preventDefault();
              onUpdateSource?.();
              onFocusPrevious();
              return;
            }
          } else {
            // Not at beginning of first line - move to beginning
            preventDefault();
            // setSelectionRange(0, 0) is not available here; the editor should handle this
            return;
          }
        }
      } else if (key === "ArrowDown" && selectionStart === selectionEnd) {
        // Check if cursor is at the end of the last line
        const lines = value.split("\n");
        const beforeCursor = value.substring(0, selectionStart);
        const currentLineIndex = beforeCursor.split("\n").length - 1;
        const currentLine = lines[currentLineIndex];
        const lastNewlineIndex = beforeCursor.lastIndexOf("\n");
        const positionInLine =
          lastNewlineIndex === -1
            ? selectionStart
            : selectionStart - lastNewlineIndex - 1;

        if (currentLineIndex === lines.length - 1) {
          // We're on the last line
          if (positionInLine === currentLine.length) {
            // At the very end - move to next cell
            if (onFocusNext) {
              preventDefault();
              onUpdateSource?.();
              onFocusNext();
              return;
            }
          } else {
            // Not at end of last line - move to end
            preventDefault();
            // setSelectionRange(value.length, value.length) is not available here; the editor should handle this
            return;
          }
        }
      }

      // Handle execution shortcuts
      if (key === "Enter" && ctrlKey && !metaKey) {
        // Ctrl+Enter: Run cell but stay in current cell
        preventDefault();
        onUpdateSource?.();
        onExecute?.();
        // Don't move to next cell - stay in current cell
      } else if (key === "Enter" && metaKey && !ctrlKey) {
        // Cmd+Enter: Run cell and move to next (or create new cell if at end)
        preventDefault();
        onUpdateSource?.();
        onExecute?.();
        if (onFocusNext) {
          onFocusNext(); // Move to next cell (or create new if at end)
        }
      }
      // Shift+Enter now creates a newline (default behavior) - no special handling needed
    },
    [onFocusNext, onFocusPrevious, onExecute, onUpdateSource]
  );

  return { handleKeyDown };
};
