import React, { useLayoutEffect, useRef, useState } from "react";

/** Fixed-height windowing. The full collection remains available; only viewport rows mount. */
export function VirtualHistory<T>({
  items,
  label,
  columns = 1,
  rowHeight = 36,
  renderItem,
  empty,
  className = "",
}: {
  items: readonly T[];
  label: string;
  columns?: number;
  rowHeight?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  empty: React.ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLOListElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 400 });
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () =>
      setViewport((old) =>
        old.height === element.clientHeight
          ? old
          : { ...old, height: element.clientHeight },
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const totalRows = Math.ceil(items.length / columns);
  const firstRow = Math.max(
    0,
    Math.min(totalRows - 1, Math.floor(viewport.top / rowHeight) - 4),
  );
  const lastRow = Math.min(
    totalRows,
    firstRow + Math.ceil(viewport.height / rowHeight) + 9,
  );
  const start = firstRow * columns,
    end = Math.min(items.length, lastRow * columns);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const max = Math.max(0, totalRows * rowHeight - element.clientHeight);
    if (element.scrollTop > max) {
      element.scrollTop = max;
      setViewport((old) => ({ ...old, top: max }));
    }
  }, [totalRows, rowHeight]);
  return (
    <ol
      ref={root}
      aria-label={label}
      data-virtual-history
      className={`scroll-quiet min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 ${className}`}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`,
        alignContent: "start",
        // Windowing owns the scroll offset; browser anchoring can undo Home/End jumps
        // when the focused row is replaced by a spacer.
        overflowAnchor: "none",
      }}
      onScroll={(event) => {
        const top = event.currentTarget.scrollTop;
        setViewport((old) => ({ ...old, top }));
      }}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest("input,textarea,select"))
          return;
        const current = Number(
          (event.target as HTMLElement)
            .closest("[data-virtual-index]")
            ?.getAttribute("data-virtual-index") ?? 0,
        );
        const page =
          Math.max(1, Math.floor(viewport.height / rowHeight)) * columns;
        const offsets: Record<string, number> = {
          ArrowDown: columns,
          ArrowUp: -columns,
          ArrowRight: 1,
          ArrowLeft: -1,
          PageDown: page,
          PageUp: -page,
        };
        if (
          !(event.key in offsets) &&
          event.key !== "Home" &&
          event.key !== "End"
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        const index = Math.max(
          0,
          Math.min(
            items.length - 1,
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? items.length - 1
                : current + (offsets[event.key] ?? 0),
          ),
        );
        const element = root.current;
        if (!element || !items.length) return;
        const top = Math.floor(index / columns) * rowHeight;
        if (top < element.scrollTop) element.scrollTop = top;
        else if (top + rowHeight > element.scrollTop + element.clientHeight)
          element.scrollTop = top + rowHeight - element.clientHeight;
        setViewport((old) => ({ ...old, top: element.scrollTop }));
        requestAnimationFrame(() =>
          element
            .querySelector<HTMLElement>(
              `[data-virtual-index="${index}"] button`,
            )
            ?.focus({ preventScroll: true }),
        );
      }}
    >
      {items.length === 0 ? (
        <li
          className="px-5 py-3 text-[12.5px] text-ink-3"
          style={{ gridColumn: "1/-1" }}
        >
          {empty}
        </li>
      ) : (
        <>
          {start > 0 && (
            <li
              aria-hidden
              role="presentation"
              style={{ height: firstRow * rowHeight, gridColumn: "1/-1" }}
            />
          )}
          {items.slice(start, end).map((item, offset) => (
            <li
              key={(item as { id?: string }).id ?? start + offset}
              data-virtual-row
              data-virtual-index={start + offset}
              aria-posinset={start + offset + 1}
              aria-setsize={items.length}
              className="group relative"
              style={{ height: rowHeight }}
            >
              {renderItem(item, start + offset)}
            </li>
          ))}
          {lastRow < totalRows && (
            <li
              aria-hidden
              role="presentation"
              style={{
                height: (totalRows - lastRow) * rowHeight,
                gridColumn: "1/-1",
              }}
            />
          )}
        </>
      )}
    </ol>
  );
}
