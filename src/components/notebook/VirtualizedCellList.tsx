import { CellData } from "@runt/schema";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Cell } from "./cell/Cell.js";
import { CellBetweener } from "./cell/CellBetweener.js";

interface VirtualizedCellListProps {
  cells: readonly CellData[];
  focusedCellId: string | null;
  onAddCell: (
    cellId?: string,
    cellType?: "code" | "markdown" | "sql" | "ai",
    position?: "before" | "after"
  ) => void;
  onDeleteCell: (cellId: string) => void;
  onMoveUp: (cellId: string) => void;
  onMoveDown: (cellId: string) => void;
  onFocusNext: (cellId: string) => void;
  onFocusPrevious: (cellId: string) => void;
  onFocus: (cellId: string) => void;
  contextSelectionMode?: boolean;
  // Virtualization config
  itemHeight?: number;
  overscan?: number;
  threshold?: number; // Number of cells before virtualization kicks in
}

const MemoizedCell = React.memo(Cell, (prevProps, nextProps) => {
  // Only re-render if cell data, autoFocus, or contextSelectionMode changes
  return (
    prevProps.cell.id === nextProps.cell.id &&
    prevProps.cell.source === nextProps.cell.source &&
    prevProps.cell.executionState === nextProps.cell.executionState &&
    prevProps.cell.executionCount === nextProps.cell.executionCount &&
    prevProps.cell.cellType === nextProps.cell.cellType &&
    prevProps.cell.sourceVisible === nextProps.cell.sourceVisible &&
    prevProps.cell.outputVisible === nextProps.cell.outputVisible &&
    prevProps.cell.aiContextVisible === nextProps.cell.aiContextVisible &&
    prevProps.cell.aiProvider === nextProps.cell.aiProvider &&
    prevProps.cell.aiModel === nextProps.cell.aiModel &&
    prevProps.autoFocus === nextProps.autoFocus &&
    prevProps.contextSelectionMode === nextProps.contextSelectionMode
  );
});

export const VirtualizedCellList: React.FC<VirtualizedCellListProps> = ({
  cells,
  focusedCellId,
  onAddCell,
  onDeleteCell,
  onMoveUp,
  onMoveDown,
  onFocusNext,
  onFocusPrevious,
  onFocus,
  contextSelectionMode = false,
  itemHeight = 200, // Estimated height per cell
  overscan = 5, // Extra items to render outside viewport
  threshold = 100, // Enable virtualization when cells > threshold
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const cellHeights = useRef<Map<string, number>>(new Map());
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [heightsVersion, setHeightsVersion] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [forceRenderCells, setForceRenderCells] = useState<Set<string>>(
    new Set()
  );

  // Cells are already sorted by database query (orderBy("position", "asc"))
  const memoizedCells = useMemo(() => cells, [cells]);

  // Check if we should use virtualization
  const shouldVirtualize = memoizedCells.length > threshold;

  // Calculate cumulative heights for positioning
  const cellPositions = useMemo(() => {
    const positions = new Map<string, { top: number; height: number }>();
    let cumulativeHeight = 0;
    const CELL_SPACING = 16; // 1rem spacing between cells

    memoizedCells.forEach((cell) => {
      const height = cellHeights.current.get(cell.id) || itemHeight;
      positions.set(cell.id, { top: cumulativeHeight, height });
      cumulativeHeight += height + CELL_SPACING;
    });

    return { positions, totalHeight: cumulativeHeight };
  }, [memoizedCells, itemHeight, heightsVersion]);

  // Calculate visible range for virtualization using actual heights
  const visibleRange = useMemo(() => {
    if (!shouldVirtualize || !isInitialized)
      return { start: 0, end: memoizedCells.length };

    // If containerHeight is 0 (initial load), show first few cells as fallback
    if (containerHeight === 0) {
      return { start: 0, end: Math.min(overscan * 2, memoizedCells.length) };
    }

    const viewportTop = scrollTop;
    const viewportBottom = scrollTop + containerHeight;
    let start = 0;
    let end = memoizedCells.length;

    // Find first visible cell
    for (let i = 0; i < memoizedCells.length; i++) {
      const cell = memoizedCells[i];
      const position = cellPositions.positions.get(cell.id);
      if (position && position.top + position.height >= viewportTop) {
        start = Math.max(0, i - overscan);
        break;
      }
    }

    // Find last visible cell
    for (let i = start; i < memoizedCells.length; i++) {
      const cell = memoizedCells[i];
      const position = cellPositions.positions.get(cell.id);
      if (position && position.top > viewportBottom) {
        end = Math.min(i + overscan, memoizedCells.length);
        break;
      }
    }

    return { start, end };
  }, [
    shouldVirtualize,
    isInitialized,
    scrollTop,
    containerHeight,
    overscan,
    memoizedCells,
    cellPositions.positions,
  ]);

  // Get visible cells
  const visibleCells = useMemo(() => {
    if (!shouldVirtualize || !isInitialized) return memoizedCells;
    return memoizedCells.slice(visibleRange.start, visibleRange.end);
  }, [
    shouldVirtualize,
    isInitialized,
    memoizedCells,
    visibleRange.start,
    visibleRange.end,
  ]);

  // Calculate spacers for invisible cells
  const spacers = useMemo(() => {
    if (!shouldVirtualize || !isInitialized)
      return { topSpacer: 0, bottomSpacer: 0 };

    const { start, end } = visibleRange;

    // Calculate top spacer height (sum of heights of cells before visible range)
    let topSpacer = 0;
    if (start > 0) {
      for (let i = 0; i < start; i++) {
        const cell = memoizedCells[i];
        const height =
          cellPositions.positions.get(cell.id)?.height || itemHeight;
        topSpacer += height + 16; // 16px for spacing
      }
    }

    // Calculate bottom spacer height (sum of heights of cells after visible range)
    let bottomSpacer = 0;
    if (end < memoizedCells.length) {
      for (let i = end; i < memoizedCells.length; i++) {
        const cell = memoizedCells[i];
        const height =
          cellPositions.positions.get(cell.id)?.height || itemHeight;
        bottomSpacer += height + 16; // 16px for spacing
      }
    }

    return { topSpacer, bottomSpacer };
  }, [
    shouldVirtualize,
    isInitialized,
    visibleRange,
    memoizedCells,
    cellPositions.positions,
    itemHeight,
  ]);

  // Handle scroll events
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (shouldVirtualize) {
        const scrollTop = e.currentTarget.scrollTop;
        requestAnimationFrame(() => {
          setScrollTop(scrollTop);
        });
      }
    },
    [shouldVirtualize]
  );

  // Observe container height changes
  useLayoutEffect(() => {
    if (!shouldVirtualize) return;

    const container = containerRef.current;
    if (!container) return;

    // Set initial height immediately
    const initialHeight = container.getBoundingClientRect().height;
    if (initialHeight > 0) {
      setContainerHeight(initialHeight);
    }

    // Cleanup previous observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }

    resizeObserverRef.current = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height);
        }
      });
    });

    resizeObserverRef.current.observe(container);
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [shouldVirtualize]);

  // Auto-scroll to focused cell
  useEffect(() => {
    if (!shouldVirtualize || !focusedCellId || !containerRef.current) return;

    const position = cellPositions.positions.get(focusedCellId);
    if (!position) return;

    const cellTop = position.top;
    const cellBottom = cellTop + position.height;
    const viewportTop = scrollTop;
    const viewportBottom = scrollTop + containerHeight;

    // Check if cell is outside viewport
    if (cellTop < viewportTop || cellBottom > viewportBottom) {
      requestAnimationFrame(() => {
        const targetScroll =
          cellTop - containerHeight / 2 + position.height / 2;
        containerRef.current?.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: "smooth",
        });
      });
    }
  }, [
    shouldVirtualize,
    focusedCellId,
    cellPositions.positions,
    scrollTop,
    containerHeight,
  ]);

  // Track execution count changes to force re-render cells that are off-screen
  useEffect(() => {
    if (!shouldVirtualize || !isInitialized) return;

    const cellsToForceRender = new Set<string>();

    memoizedCells.forEach((cell, index) => {
      const isVisible = index >= visibleRange.start && index < visibleRange.end;
      const wasForced = forceRenderCells.has(cell.id);

      // If cell is not visible and has execution count, force render it off-screen
      if (!isVisible && (cell.executionCount ?? 0) > 0) {
        cellsToForceRender.add(cell.id);
      }

      // Keep previously forced cells
      if (wasForced) {
        cellsToForceRender.add(cell.id);
      }
    });

    setForceRenderCells(cellsToForceRender);
  }, [
    shouldVirtualize,
    isInitialized,
    memoizedCells,
    visibleRange,
    forceRenderCells,
  ]);

  // Measure cell heights when they render
  const measureCellHeight = useCallback(
    (cellId: string, element: HTMLDivElement | null) => {
      if (element) {
        cellRefs.current.set(cellId, element);

        // Use ResizeObserver to track height changes
        const observer = new ResizeObserver(() => {
          const height = element.getBoundingClientRect().height;
          const currentHeight = cellHeights.current.get(cellId);

          if (Math.abs(height - (currentHeight || 0)) > 1) {
            // Only update if significant change
            cellHeights.current.set(cellId, height);
            // Force re-render to update positions
            setHeightsVersion((prev) => prev + 1);
          }
        });

        observer.observe(element);
        return () => observer.disconnect();
      } else {
        cellRefs.current.delete(cellId);
        cellHeights.current.delete(cellId);
      }
    },
    []
  );

  // Initialize height measurements
  useEffect(() => {
    if (!shouldVirtualize) {
      setIsInitialized(true);
      return;
    }

    // Wait for all cells to be measured before enabling virtualization
    const allCellsMeasured = memoizedCells.every(
      (cell) =>
        cellHeights.current.has(cell.id) || cellRefs.current.has(cell.id)
    );

    if (allCellsMeasured && memoizedCells.length > 0) {
      setIsInitialized(true);
    }
  }, [shouldVirtualize, memoizedCells, cellHeights, cellRefs]);

  const cellElements = useMemo(
    () =>
      visibleCells.map((cell, index) => (
        <div key={cell.id} ref={(el) => measureCellHeight(cell.id, el)}>
          <ErrorBoundary fallback={<div>Error rendering cell</div>}>
            {index === 0 && (
              <CellBetweener
                cell={cell}
                onAddCell={onAddCell}
                position="before"
              />
            )}
            <MemoizedCell
              cell={cell}
              onDeleteCell={() => onDeleteCell(cell.id)}
              onMoveUp={() => onMoveUp(cell.id)}
              onMoveDown={() => onMoveDown(cell.id)}
              onFocusNext={() => onFocusNext(cell.id)}
              onFocusPrevious={() => onFocusPrevious(cell.id)}
              onFocus={() => onFocus(cell.id)}
              autoFocus={cell.id === focusedCellId}
              contextSelectionMode={contextSelectionMode}
            />
            <CellBetweener cell={cell} onAddCell={onAddCell} position="after" />
          </ErrorBoundary>
        </div>
      )),
    [
      visibleCells,
      measureCellHeight,
      focusedCellId,
      contextSelectionMode,
      onAddCell,
      onDeleteCell,
      onMoveUp,
      onMoveDown,
      onFocusNext,
      onFocusPrevious,
      onFocus,
    ]
  );

  // Render off-screen cells for height measurement when they have execution updates
  const offScreenCells = useMemo(() => {
    if (!shouldVirtualize || !isInitialized) return null;

    const offScreenElements = Array.from(forceRenderCells)
      .filter((cellId) => !visibleCells.some((cell) => cell.id === cellId))
      .map((cellId) => {
        const cell = memoizedCells.find((c) => c.id === cellId);
        if (!cell) return null;

        return (
          <div
            key={`offscreen-${cellId}`}
            ref={(el) => measureCellHeight(cellId, el)}
            style={{
              position: "absolute",
              top: "-9999px",
              left: "-9999px",
              visibility: "hidden",
              pointerEvents: "none",
            }}
          >
            <ErrorBoundary
              fallback={<div>Error rendering off-screen cell</div>}
            >
              <MemoizedCell
                cell={cell}
                onDeleteCell={() => onDeleteCell(cell.id)}
                onMoveUp={() => onMoveUp(cell.id)}
                onMoveDown={() => onMoveDown(cell.id)}
                onFocusNext={() => onFocusNext(cell.id)}
                onFocusPrevious={() => onFocusPrevious(cell.id)}
                onFocus={() => onFocus(cell.id)}
                autoFocus={false}
                contextSelectionMode={contextSelectionMode}
              />
            </ErrorBoundary>
          </div>
        );
      })
      .filter(Boolean);

    return offScreenElements.length > 0 ? offScreenElements : null;
  }, [
    shouldVirtualize,
    isInitialized,
    forceRenderCells,
    visibleCells,
    memoizedCells,
    measureCellHeight,
    contextSelectionMode,
    onDeleteCell,
    onMoveUp,
    onMoveDown,
    onFocusNext,
    onFocusPrevious,
    onFocus,
  ]);

  // If we have fewer cells than threshold, render normally
  if (!shouldVirtualize) {
    return (
      <div ref={containerRef} style={{ paddingLeft: "1rem" }}>
        {cellElements}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        paddingLeft: "1rem",
        position: "relative",
      }}
      onScroll={handleScroll}
    >
      <div className="text-muted-foreground bg-background sticky top-0 z-50 text-xs">
        {cells.length} cells, {visibleCells.length} visible, visibleRange:{" "}
        {visibleRange.start} - {visibleRange.end}, initialized:{" "}
        {isInitialized ? "yes" : "no"}
      </div>

      {/* Off-screen cells for height measurement */}
      {offScreenCells}

      {/* Top spacer for invisible cells before visible range */}
      {spacers.topSpacer > 0 && <div style={{ height: spacers.topSpacer }} />}

      {/* Visible cells */}
      {cellElements}

      {/* Bottom spacer for invisible cells after visible range */}
      {spacers.bottomSpacer > 0 && (
        <div style={{ height: spacers.bottomSpacer }} />
      )}
    </div>
  );
};
