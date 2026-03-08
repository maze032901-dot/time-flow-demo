"use client";

import { useRef, useEffect, useState } from "react";
import { useDndMonitor, useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useTaskStore, taskSelectors } from "@/store/useTaskStore";
import type { Task } from "@/types/task";
import {
  getDropMinuteFromTranslatedRect,
  isPastDropMinute,
  minutesToTime,
} from "@/utils/timelineDnd";

// ─────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────

export const BASE_MINUTE_PX = 80 / 60;
export const PADDING_TOP = 20;
export const LABEL_WIDTH = 64;

const TAG_COLORS: Record<string, string> = {
  工作: "#f59e0b",
  学习: "#3b82f6",
  生活: "#10b981",
  其他: "#8b5cf6",
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTop(minutes: number, minutePx: number): number {
  return minutes * minutePx + PADDING_TOP;
}

export function checkTimelineOverlap(
  projectedStart: number,
  projectedEnd: number,
  otherTasks: Array<{ start: number; end: number }>
) {
  if (projectedEnd <= projectedStart) return true;
  for (let i = 0; i < otherTasks.length; i += 1) {
    const other = otherTasks[i];
    if (projectedStart < other.end && other.start < projectedEnd) {
      return true;
    }
  }
  return false;
}

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function snapToEdges(value: number, edges: number[], threshold: number) {
  let closest = value;
  let closestDelta = threshold + 1;
  for (let i = 0; i < edges.length; i += 1) {
    const delta = Math.abs(edges[i] - value);
    if (delta < closestDelta) {
      closestDelta = delta;
      closest = edges[i];
    }
  }
  return closestDelta <= threshold ? closest : value;
}

function snapToGrid(value: number, step: number, threshold: number) {
  const snapped = Math.round(value / step) * step;
  return Math.abs(snapped - value) <= threshold ? snapped : value;
}

// ─────────────────────────────────────────────
// TimeAxis
// ─────────────────────────────────────────────

export interface TimeAxisProps {
  shakeTaskId?: string | null;
  zoom: number;
  dropMinute: number | null;
  dragDuration: number | null;
  isDraggingTask: boolean;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  selectedDate: string;
  isPastDate: boolean;
  isToday: boolean;
}

function toTimeLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const bigint = parseInt(value.length === 3 ? value.split("").map((c) => c + c).join("") : value, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function TimeAxis({
  shakeTaskId,
  zoom,
  dropMinute,
  dragDuration,
  isDraggingTask,
  timelineRef,
  selectedDate,
  isPastDate,
  isToday,
}: TimeAxisProps) {
  const scheduledTasks = useTaskStore(useShallow(taskSelectors.scheduledTasks));
  const allTasks = useTaskStore((s) => s.tasks);
  const cleanupExpiredTasks = useTaskStore((s) => s.cleanupExpiredTasks);
  const unscheduleTask = useTaskStore((s) => s.unscheduleTask);
  const nowRef = useRef<HTMLDivElement>(null);
  const previousDateRef = useRef<string | null>(null);
  const [nowMinutes, setNowMinutes] = useState(getCurrentMinutes);
  const { setNodeRef, isOver } = useDroppable({ id: "timeline" });

  useEffect(() => {
    const id = setInterval(() => setNowMinutes(getCurrentMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  const minutePx = BASE_MINUTE_PX * zoom;
  const totalHeight = 24 * 60 * minutePx + PADDING_TOP * 2;
  const minorStep = zoom >= 1.4 ? 15 : zoom >= 1.1 ? 30 : 60;
  const gridMinutes = Array.from(
    { length: Math.ceil(1440 / minorStep) + 1 },
    (_, i) => i * minorStep
  ).filter((m) => m <= 1440);
  const dropHeight = Math.max((dragDuration ?? 25) * minutePx, 24);
  const dropTop = dropMinute !== null ? minutesToTop(dropMinute, minutePx) : null;
  const dropTint = dropMinute !== null ? hexToRgba("#6366f1", 0.18) : null;
  const visibleTasks = scheduledTasks.filter(
    (task) => task.scheduledDate === selectedDate
  );
  const [activeTimeline, setActiveTimeline] = useState<{
    taskId: string;
    mode: "move" | "resize-top" | "resize-bottom";
    originStart: number;
    originEnd: number;
  } | null>(null);
  const [projection, setProjection] = useState<{
    taskId: string;
    start: number;
    end: number;
    forbidden: boolean;
    reason: "overlap" | "past" | null;
  } | null>(null);
  const [timelineDropError, setTimelineDropError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(
    null
  );
  const [edgeControl, setEdgeControl] = useState<{
    visible: boolean;
    top: number;
    placement: "top" | "bottom";
  }>({
    visible: false,
    top: 0,
    placement: "top",
  });

  const renderAxisFloatingTime = (
    minutes: number,
    textColor: string,
    backgroundColor: string
  ) => (
    <div
      className="absolute left-0 right-0 flex items-center pointer-events-none"
      style={{ top: `${minutesToTop(minutes, minutePx)}px`, zIndex: 21 }}
    >
      <span
        className="w-16 shrink-0 text-right pr-3 select-none"
        style={{ fontSize: "11px", marginTop: "-8px" }}
      >
        <span
          className="inline-block px-1.5 py-0.5 rounded-md font-semibold tabular-nums"
          style={{ color: textColor, backgroundColor }}
        >
          {toTimeLabel(minutes)}
        </span>
      </span>
      <div className="flex-1 mr-3" />
    </div>
  );

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onEscape);
    };
  }, [contextMenu]);

  useDndMonitor({
    onDragStart: (event) => {
      const data = event.active.data.current as
        | { type: string; taskId: string }
        | undefined;
      if (!data?.type?.startsWith("timeline-")) return;
      const task = visibleTasks.find((t) => t.id === data.taskId);
      if (!task?.scheduledTime || task.isDone) return;
      const originStart = timeToMinutes(task.scheduledTime);
      const originEnd = originStart + (task.duration || 25);
      setActiveTimeline({
        taskId: task.id,
        mode:
          data.type === "timeline-resize-top"
            ? "resize-top"
            : data.type === "timeline-resize-bottom"
              ? "resize-bottom"
              : "move",
        originStart,
        originEnd,
      });
      setProjection({
        taskId: task.id,
        start: originStart,
        end: originEnd,
        forbidden: false,
        reason: null,
      });
    },
    onDragMove: (event) => {
      if (!activeTimeline) return;
      const deltaMinutes = Math.round(event.delta.y / minutePx);
      const otherTasks = visibleTasks
        .filter((t) => t.id !== activeTimeline.taskId && t.scheduledTime)
        .map((t) => {
          const start = timeToMinutes(t.scheduledTime as string);
          const end = start + (t.duration || 25);
          return { start, end };
        });
      const edges = otherTasks.flatMap((t) => [t.start, t.end]);
      const minDuration = 5;
      const edgeThreshold = 8;
      const gridStep = 15;
      const gridThreshold = 6;
      let start = activeTimeline.originStart;
      let end = activeTimeline.originEnd;
      if (activeTimeline.mode === "move") {
        const duration = end - start;
        const container = timelineRef.current;
        const translated = event.active.rect.current.translated;
        let nextStart = start + deltaMinutes;
        if (container && translated) {
          const rect = container.getBoundingClientRect();
          const projectedCenterMinute = getDropMinuteFromTranslatedRect(
            translated,
            rect,
            container.scrollTop,
            minutePx,
            PADDING_TOP
          );
          nextStart = projectedCenterMinute - Math.round(duration / 2);
        }
        let nextEnd = end + deltaMinutes;
        nextEnd = nextStart + duration;
        if (nextStart < 0) {
          nextEnd -= nextStart;
          nextStart = 0;
        }
        if (nextEnd > 1440) {
          const overflow = nextEnd - 1440;
          nextStart -= overflow;
          nextEnd = 1440;
        }
        const snapStart = snapToEdges(nextStart, edges, edgeThreshold);
        const snapEnd = snapToEdges(nextEnd, edges, edgeThreshold);
        if (Math.abs(snapStart - nextStart) <= Math.abs(snapEnd - nextEnd)) {
          nextStart = snapStart;
          nextEnd = nextStart + duration;
        } else {
          nextEnd = snapEnd;
          nextStart = nextEnd - duration;
        }
        const gridStart = snapToGrid(nextStart, gridStep, gridThreshold);
        const gridEnd = snapToGrid(nextEnd, gridStep, gridThreshold);
        if (Math.abs(gridStart - nextStart) <= Math.abs(gridEnd - nextEnd)) {
          nextStart = gridStart;
          nextEnd = nextStart + duration;
        } else {
          nextEnd = gridEnd;
          nextStart = nextEnd - duration;
        }
        start = Math.max(0, Math.min(1440 - duration, nextStart));
        end = start + duration;
      } else if (activeTimeline.mode === "resize-top") {
        const nextStartRaw = start + deltaMinutes;
        // 1. 先不设上下限，允许自由拖动
        let nextStart = nextStartRaw;
        // 2. 边缘吸附（如果需要）
        nextStart = snapToEdges(nextStart, edges, edgeThreshold);
        // 3. 移除 gridStep 吸附，实现 1 分钟精确控制
        // nextStart = snapToGrid(nextStart, gridStep, gridThreshold);
        
        // 4. 最后做逻辑约束：不能小于 0，且不能超过结束时间（预留 minDuration）
        nextStart = Math.max(0, Math.min(end - minDuration, nextStart));
        
        start = nextStart;
      } else {
        const nextEndRaw = end + deltaMinutes;
        // 1. 先不设上下限
        let nextEnd = nextEndRaw;
        // 2. 边缘吸附
        nextEnd = snapToEdges(nextEnd, edges, edgeThreshold);
        // 3. 移除 gridStep 吸附，实现 1 分钟精确控制
        // nextEnd = snapToGrid(nextEnd, gridStep, gridThreshold);
        
        // 4. 最后做逻辑约束：不能超过 1440，且不能小于开始时间（预留 minDuration）
        nextEnd = Math.min(1440, Math.max(start + minDuration, nextEnd));
        
        end = nextEnd;
      }
      const overlap = checkTimelineOverlap(start, end, otherTasks);
      const past = isPastDropMinute(selectedDate, start);
      const forbidden = overlap || past;
      const reason = past ? "past" : overlap ? "overlap" : null;
      setProjection({ taskId: activeTimeline.taskId, start, end, forbidden, reason });
    },
    onDragEnd: (event) => {
      if (!activeTimeline) return;
      const overId = String(event.over?.id ?? "");
      if (
        overId &&
        overId !== "timeline" &&
        (overId === "taskpool" ||
          allTasks.some(
            (task) =>
              task.id === overId &&
              (task.status === "unscheduled" || task.status === "unfinished")
          ))
      ) {
        unscheduleTask(activeTimeline.taskId);
        setActiveTimeline(null);
        setProjection(null);
        return;
      }
      if (!projection || projection.forbidden) {
        if (projection?.reason === "past") {
          setTimelineDropError("Tasks must be scheduled in the future.");
          setTimeout(() => setTimelineDropError(null), 2200);
        }
        setActiveTimeline(null);
        setProjection(null);
        return;
      }
      const updatedStart = projection.start;
      const updatedEnd = projection.end;
      const duration = Math.max(5, updatedEnd - updatedStart);
      const { updateTask, rescheduleTask } = useTaskStore.getState();
      rescheduleTask(activeTimeline.taskId, selectedDate, minutesToTime(updatedStart));
      updateTask(activeTimeline.taskId, { duration });
      setActiveTimeline(null);
      setProjection(null);
    },
    onDragCancel: () => {
      setActiveTimeline(null);
      setProjection(null);
    },
  });

  useEffect(() => {
    const container = timelineRef.current;
    if (!container) return;
    if (!previousDateRef.current) {
      previousDateRef.current = selectedDate;
      return;
    }
    if (previousDateRef.current === selectedDate) return;
    previousDateRef.current = selectedDate;

    const tasksOnDate = scheduledTasks
      .filter((task) => task.scheduledDate === selectedDate && task.scheduledTime)
      .sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""));
    const targetMinutes = isToday
      ? getCurrentMinutes()
      : tasksOnDate.length > 0
        ? timeToMinutes(tasksOnDate[0].scheduledTime as string)
        : getCurrentMinutes();

    const targetTop = minutesToTop(targetMinutes, minutePx);
    let rafA = 0;
    let rafB = 0;
    rafA = requestAnimationFrame(() => {
      rafB = requestAnimationFrame(() => {
        const maxScroll = Math.max(0, totalHeight - container.clientHeight);
        const nextScrollTop = Math.min(
          Math.max(0, targetTop - container.clientHeight / 2),
          maxScroll
        );
        container.scrollTo({ top: nextScrollTop, behavior: "smooth" });
      });
    });
    return () => {
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
    };
  }, [selectedDate, isToday, minutePx, totalHeight, scheduledTasks, timelineRef]);

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden"
      style={{ backgroundColor: "var(--background)" }}
      onMouseMoveCapture={(event) => {
        const container = event.currentTarget;
        const rect = container.getBoundingClientRect();
        const yInViewport = event.clientY - rect.top;
        const edgeThreshold = 28;
        const isDraggingTimelineTask = Boolean(activeTimeline) || isDraggingTask;
        if (!isDraggingTimelineTask) {
          if (edgeControl.visible) {
            setEdgeControl({ visible: false, top: 0, placement: "top" });
          }
          return;
        }
        if (yInViewport <= edgeThreshold) {
          setEdgeControl({
            visible: true,
            top: container.scrollTop + 16,
            placement: "top",
          });
          return;
        }
        if (yInViewport >= rect.height - edgeThreshold) {
          setEdgeControl({
            visible: true,
            top: container.scrollTop + rect.height - 16,
            placement: "bottom",
          });
          return;
        }
        if (edgeControl.visible) {
          setEdgeControl({ visible: false, top: 0, placement: "top" });
        }
      }}
      onMouseLeave={() => {
        if (edgeControl.visible) {
          setEdgeControl({ visible: false, top: 0, placement: "top" });
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY });
      }}
      ref={(node) => {
        timelineRef.current = node;
        setNodeRef(node);
      }}
    >
      <div className="relative" style={{ height: `${totalHeight}px` }}>
        {gridMinutes.map((minutes) => {
          const isHour = minutes % 60 === 0;
          const label = isHour ? toTimeLabel(minutes) : "";
          return (
          <div
            key={`grid-${minutes}`}
            className="absolute left-0 right-0 flex items-center pointer-events-none"
            style={{ top: `${minutesToTop(minutes, minutePx)}px` }}
          >
            <span
              className="w-16 shrink-0 text-right pr-3 select-none"
              style={{
                color: isHour ? "var(--text-secondary)" : "transparent",
                fontSize: "11px",
                marginTop: "-8px",
              }}
            >
              {label}
            </span>
            <div
              className="flex-1 mr-3"
              style={{
                height: 1,
                borderTop: isHour
                  ? "1px solid var(--border-color)"
                  : "1px dashed #e9e6e1",
              }}
            />
          </div>
        )})}

        {/* 24:00 line */}
        <div
          className="absolute left-0 right-0 flex items-center pointer-events-none"
          style={{ top: `${minutesToTop(1440, minutePx)}px` }}
        >
          <span className="w-16 shrink-0 text-right pr-3 text-[11px] select-none" style={{ color: "var(--text-secondary)" }}>
            24:00
          </span>
          <div className="flex-1 mr-3 border-t" style={{ borderColor: "var(--border-color)" }} />
        </div>

        {isDraggingTask && isOver && dropTop !== null && (
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: `${dropTop}px`,
              height: `${dropHeight}px`,
              zIndex: 12,
            }}
          >
            <div
              className="absolute left-[72px] right-[14px] rounded-xl border"
              style={{
                height: "100%",
                borderColor: "rgba(99,102,241,0.5)",
                backgroundColor: dropTint ?? "rgba(99,102,241,0.12)",
                boxShadow: "0 6px 16px rgba(99,102,241,0.18)",
              }}
            />
          </div>
        )}

        {isDraggingTask &&
          isOver &&
          dropMinute !== null &&
          renderAxisFloatingTime(dropMinute, "#4f46e5", "rgba(238,242,255,0.92)")}
        {activeTimeline && projection && (
          renderAxisFloatingTime(
            projection.start,
            projection.forbidden ? "#b91c1c" : "#4f46e5",
            projection.forbidden ? "rgba(254,226,226,0.92)" : "rgba(238,242,255,0.92)"
          )
        )}

        {/* Scheduled task cards */}
        {visibleTasks.map(
          (task) =>
            task.scheduledTime && (
              <ScheduledCard
                key={task.id}
                task={task}
                isShaking={shakeTaskId === task.id}
                minutePx={minutePx}
                isPastDate={isPastDate}
                projection={projection?.taskId === task.id ? projection : null}
                isActive={activeTimeline?.taskId === task.id}
              />
            )
        )}

        {/* Current time indicator (red line + dot) */}
        {isToday && (
          <div
            ref={nowRef}
            className="absolute left-0 right-0 flex items-center pointer-events-none"
            style={{ top: `${minutesToTop(nowMinutes, minutePx)}px`, zIndex: 30 }}
          >
            <div className="w-16 shrink-0 flex justify-end pr-[9px]">
              <div
                className="w-3 h-3 rounded-full bg-red-500 shrink-0"
                style={{
                  boxShadow: "0 0 0 3px rgba(239,68,68,0.2), 0 0 8px rgba(239,68,68,0.4)",
                }}
              />
            </div>
            <div
              className="flex-1 mr-3"
              style={{
                height: 2,
                background: "linear-gradient(to right, #ef4444 0%, rgba(239,68,68,0.2) 100%)",
              }}
            />
          </div>
        )}
        {edgeControl.visible && (
          <div
            className="pointer-events-none absolute z-[60] rounded-full p-1 flex flex-col items-center gap-0.5"
            style={{
              left: LABEL_WIDTH + 8,
              top: `${edgeControl.top - 20}px`,
              backgroundColor: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(15,23,42,0.12)",
              boxShadow: "0 6px 14px rgba(15,23,42,0.16)",
            }}
          >
            <button
              className="pointer-events-auto w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-100 active:scale-95 transition-all"
              style={{ color: "#111827" }}
              onClick={() =>
                timelineRef.current?.scrollBy({ top: -120, behavior: "smooth" })
              }
              aria-label="向上滚动时间轴"
              title="向上滚动"
            >
              <ChevronUp
                size={12}
                style={{ opacity: edgeControl.placement === "top" ? 1 : 0.5 }}
              />
            </button>
            <div className="w-3.5 h-[2px] rounded-full bg-slate-300" />
            <button
              className="pointer-events-auto w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-100 active:scale-95 transition-all"
              style={{ color: "#111827" }}
              onClick={() =>
                timelineRef.current?.scrollBy({ top: 120, behavior: "smooth" })
              }
              aria-label="向下滚动时间轴"
              title="向下滚动"
            >
              <ChevronDown
                size={12}
                style={{ opacity: edgeControl.placement === "bottom" ? 1 : 0.5 }}
              />
            </button>
          </div>
        )}
      </div>
      {contextMenu && (
        <div
          className="fixed z-[95] w-56 rounded-xl border p-1.5 shadow-xl"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            borderColor: "var(--border-color)",
            backgroundColor: "var(--panel-bg)",
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            className="w-full px-2.5 py-2 rounded-lg text-sm text-left transition-colors hover:bg-gray-50"
            style={{ color: "var(--text-secondary)" }}
            onClick={() => {
              cleanupExpiredTasks();
              setContextMenu(null);
            }}
          >
            Clean Expired Tasks & Return to Pool
          </button>
        </div>
      )}
      {timelineDropError && (
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[96] px-4 py-2 rounded-xl text-sm font-medium"
          style={{
            backgroundColor: "#fff7ed",
            color: "#9a3412",
            border: "1px solid #fed7aa",
            boxShadow: "0 10px 20px rgba(154,52,18,0.15)",
          }}
        >
          {timelineDropError}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ScheduledCard — task block on timeline
// ─────────────────────────────────────────────

function ScheduledCard({
  task,
  isShaking,
  minutePx,
  isPastDate,
  projection,
  isActive,
}: {
  task: Task;
  isShaking: boolean;
  minutePx: number;
  isPastDate: boolean;
  projection: { start: number; end: number; forbidden: boolean } | null;
  isActive: boolean;
}) {
  const unscheduleTask = useTaskStore((s) => s.unscheduleTask);
  const isLocked = Boolean(task.isDone);
  const {
    setNodeRef: dragRef,
    listeners: dragListeners,
    attributes: dragAttributes,
  } = useDraggable({
    id: `timeline:${task.id}`,
    data: { type: "timeline-move", taskId: task.id },
    disabled: isLocked,
  });
  const {
    setNodeRef: resizeTopRef,
    listeners: resizeTopListeners,
    attributes: resizeTopAttributes,
  } = useDraggable({
    id: `resize-top:${task.id}`,
    data: { type: "timeline-resize-top", taskId: task.id },
    disabled: isLocked,
  });
  const {
    setNodeRef: resizeBottomRef,
    listeners: resizeBottomListeners,
    attributes: resizeBottomAttributes,
  } = useDraggable({
    id: `resize-bottom:${task.id}`,
    data: { type: "timeline-resize-bottom", taskId: task.id },
    disabled: isLocked,
  });

  if (!task.scheduledTime) return null;

  const startMin = projection ? projection.start : timeToMinutes(task.scheduledTime);
  const endMin = projection ? projection.end : startMin + (task.duration || 25);
  const top = minutesToTop(startMin, minutePx);
  const height = Math.max((endMin - startMin) * minutePx, 24);

  const tagColor = TAG_COLORS[task.tag] ?? "#6b7280";
  const isScheduled = task.status === "scheduled";
  const isCompletedFocus =
    task.type === "focus" && task.status === "completed" && Boolean(task.isDone);
  const tintAlpha = isPastDate ? 0.08 : 0.14;
  const isForbidden = projection?.forbidden ?? false;

  return (
    <div
      className={`group absolute rounded-xl border overflow-hidden${isShaking ? " animate-shake" : ""}`}
      style={{
        left: LABEL_WIDTH + 6,
        right: 14,
        top: `${top + 1}px`,
        height: `${height - 2}px`,
        zIndex: isActive ? 40 : 10,
        borderColor: isCompletedFocus
          ? "#22c55e"
          : isForbidden
          ? "#ef4444"
          : isShaking
            ? "#ef4444"
            : "var(--border-color)",
        backgroundColor: isCompletedFocus
          ? "rgba(220,252,231,0.8)"
          : isForbidden
          ? "rgba(254,226,226,0.8)"
          : isShaking
            ? "#fff1f2"
            : hexToRgba(tagColor, tintAlpha),
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        opacity: isPastDate ? 0.65 : 1,
        cursor: isLocked ? "not-allowed" : isForbidden ? "not-allowed" : "grab",
      }}
    >
      <div
        className="absolute left-0 right-0 top-0 h-1"
        style={{ backgroundColor: isCompletedFocus ? "#22c55e" : tagColor }}
      />
      {!isLocked && (
        <>
          <div
            ref={dragRef}
            {...dragListeners}
            {...dragAttributes}
            className="absolute left-1.5 right-1.5 top-5 bottom-5 rounded-lg cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
          />
          <div
            ref={resizeTopRef}
            {...resizeTopListeners}
            {...resizeTopAttributes}
            className="absolute left-0 right-0 top-0 h-4 cursor-ns-resize z-50 flex justify-center items-start pt-0.5 group/resize hover:bg-black/5 transition-colors"
            style={{ touchAction: "none" }}
          >
            <div className="bg-white/90 rounded-full shadow-sm p-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-black/5">
              <ChevronsUpDown size={10} className="text-gray-500" />
            </div>
          </div>
          <div
            ref={resizeBottomRef}
            {...resizeBottomListeners}
            {...resizeBottomAttributes}
            className="absolute left-0 right-0 bottom-0 h-4 cursor-ns-resize z-50 flex justify-center items-end pb-0.5 group/resize hover:bg-black/5 transition-colors"
            style={{ touchAction: "none" }}
          >
            <div className="bg-white/90 rounded-full shadow-sm p-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-black/5">
              <ChevronsUpDown size={10} className="text-gray-500" />
            </div>
          </div>
        </>
      )}
      <div className="absolute inset-0 pt-1 pl-3 pr-1.5 flex items-center gap-1.5">
        <span
          className="flex-1 font-semibold truncate"
          style={{
            color: isPastDate ? "var(--text-secondary)" : "var(--foreground)",
            fontSize: 11,
            textDecoration: isPastDate ? "line-through" : "none",
          }}
        >
          {task.title}
        </span>
        {task.isDone && (
          <span
            className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{
              backgroundColor: isCompletedFocus ? "#bbf7d0" : "#dcfce7",
              color: "#15803d",
            }}
          >
            {isCompletedFocus ? "Focus 已完成" : "Done"}
          </span>
        )}
        {height > 36 && (
          <span className="shrink-0 tabular-nums text-[10px]" style={{ color: "var(--text-muted)" }}>
            {Math.round(endMin - startMin)}m
          </span>
        )}
        {isScheduled && !isLocked && (
          <button
            className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
            style={{ color: "#ef4444", fontSize: 15, lineHeight: 1 }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => unscheduleTask(task.id)}
            title="移出时间轴"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
