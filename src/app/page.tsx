"use client";

import { useEffect, useState, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import TopHeader from "@/components/left-panel/TopHeader";
import { BASE_MINUTE_PX, PADDING_TOP } from "@/components/left-panel/timeAxisConstants";
import SmartControlBar from "@/components/left-panel/SmartControlBar";
import { useTaskStore } from "@/store/useTaskStore";
import type { Task } from "@/types/task";
import {
  getDropMinuteFromTranslatedRect,
  isPastDropMinute,
  minutesToTime,
} from "@/utils/timelineDnd";
import OnboardingGuide from '@/components/OnboardingModal';

const SCENARIO_COLORS: Record<string, string> = {
  工作: "#f59e0b",
  学习: "#3b82f6",
  生活: "#10b981",
  其他: "#8b5cf6",
};

const RightPanel = dynamic(() => import("@/components/right-panel/RightPanel"), {
  ssr: false,
});
const TimeAxis = dynamic(() => import("@/components/left-panel/TimeAxis"), {
  ssr: false,
});

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfDayMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function findCollision(
  tasks: Task[],
  droppingTaskId: string,
  dropDate: string,
  dropTime: string,
  duration: number
): Task | null {
  const newStart = timeToMinutes(dropTime);
  const newEnd = newStart + (duration || 25);

  return (
    tasks.find((t) => {
      if (t.id === droppingTaskId) return false;
      if (t.status !== "scheduled" && t.status !== "in_progress") return false;
      if (t.scheduledDate !== dropDate) return false;
      if (!t.scheduledTime) return false;
      const tStart = timeToMinutes(t.scheduledTime);
      const tEnd = tStart + (t.duration || 25);
      return newStart < tEnd && tStart < newEnd;
    }) ?? null
  );
}

export default function Home() {
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [shakeTaskId, setShakeTaskId] = useState<string | null>(null);
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);
  const [dropMinute, setDropMinute] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dropError, setDropError] = useState<string | null>(null);
  const scheduleTask = useTaskStore((s) => s.scheduleTask);
  const movePoolTask = useTaskStore((s) => s.movePoolTask);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef(0);
  const autoScrollLastRef = useRef(0);
  const selectedDate = toDateKey(currentDate);
  const today = new Date();
  const isPastDate = startOfDayMs(currentDate) < startOfDayMs(today);
  const isFutureDate = startOfDayMs(currentDate) > startOfDayMs(today);
  const isToday = !isPastDate && !isFutureDate;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key === "n") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("open-add-task"));
      }
      if ((e.metaKey || e.ctrlKey) && key === "b") {
        e.preventDefault();
        setRightPanelOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    let timer: number;
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const delay = nextMidnight.getTime() - now.getTime();
      timer = window.setTimeout(() => {
        setCurrentDate(new Date());
        schedule();
      }, delay);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { type?: string } | undefined;
    if (data?.type && data.type !== "pool-task") return;
    const taskId = String(event.active.id);
    const { tasks } = useTaskStore.getState();
    const task = tasks.find((t) => t.id === taskId) ?? null;
    setActiveDragTask(task);
  }

  const scrollToNow = () => {
    const container = timelineRef.current;
    if (!container) return;
    const nowMinutes = getNowMinutes();
    const minutePx = BASE_MINUTE_PX * zoom;
    const totalHeight = 24 * 60 * minutePx + PADDING_TOP * 2;
    const targetTop = nowMinutes * minutePx + PADDING_TOP;
    const maxScroll = Math.max(0, totalHeight - container.clientHeight);
    const nextScrollTop = Math.min(
      Math.max(0, targetTop - container.clientHeight / 2),
      maxScroll
    );
    container.scrollTo({ top: nextScrollTop, behavior: "smooth" });
  };

  const handleLocateNow = () => {
    setCurrentDate(new Date());
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToNow();
      });
    });
  };

  function stopAutoScroll() {
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
    autoScrollSpeedRef.current = 0;
    autoScrollLastRef.current = 0;
  }

  function startAutoScroll() {
    if (autoScrollRafRef.current) return;
    autoScrollRafRef.current = requestAnimationFrame(function step(now) {
      const container = timelineRef.current;
      if (!container) {
        autoScrollRafRef.current = null;
        return;
      }
      const last = autoScrollLastRef.current || now;
      const delta = Math.max(8, now - last);
      autoScrollLastRef.current = now;
      const speed = autoScrollSpeedRef.current;
      if (speed === 0) {
        autoScrollRafRef.current = null;
        return;
      }
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const next = Math.min(Math.max(0, container.scrollTop + speed * (delta / 16)), maxScroll);
      if (next === container.scrollTop && (next === 0 || next === maxScroll)) {
        stopAutoScroll();
        return;
      }
      container.scrollTop = next;
      autoScrollRafRef.current = requestAnimationFrame(step);
    });
  }

  function handleDragMove(event: DragMoveEvent) {
    const data = event.active.data.current as { type?: string } | undefined;
    if (
      data?.type &&
      data.type !== "pool-task" &&
      data.type !== "timeline-move" &&
      data.type !== "timeline-resize-top" &&
      data.type !== "timeline-resize-bottom"
    ) {
      return;
    }
    const overId = String(event.over?.id ?? "");
    if (overId !== "timeline" || !event.active.rect.current.translated) {
      setDropMinute(null);
      stopAutoScroll();
      return;
    }

    const container = timelineRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const translated = event.active.rect.current.translated;
    const centerY = translated.top + translated.height / 2;
    const threshold = 64;
    const maxSpeed = 18;
    let speed = 0;
    if (centerY < rect.top + threshold) {
      const t = (rect.top + threshold - centerY) / threshold;
      speed = -maxSpeed * Math.min(1, t * t);
    } else if (centerY > rect.bottom - threshold) {
      const t = (centerY - (rect.bottom - threshold)) / threshold;
      speed = maxSpeed * Math.min(1, t * t);
    }
    autoScrollSpeedRef.current = speed;
    if (speed === 0) stopAutoScroll();
    else startAutoScroll();

    if (data?.type === "pool-task") {
      const minutePx = BASE_MINUTE_PX * zoom;
      setDropMinute(
        getDropMinuteFromTranslatedRect(
          translated,
          rect,
          container.scrollTop,
          minutePx,
          PADDING_TOP
        )
      );
    }
  }

  function resetDragState() {
    setActiveDragTask(null);
    setDropMinute(null);
    stopAutoScroll();
  }

  function handleZoomChange(next: number) {
    const clamped = Math.max(0.7, Math.min(2.2, next));
    const container = timelineRef.current;
    if (!container) {
      setZoom(clamped);
      return;
    }
    const prevMinutePx = BASE_MINUTE_PX * zoom;
    const nextMinutePx = BASE_MINUTE_PX * clamped;
    const nowMinutes = getNowMinutes();
    const prevLineTop = PADDING_TOP + nowMinutes * prevMinutePx;
    const screenOffset = prevLineTop - container.scrollTop;
    const nextLineTop = PADDING_TOP + nowMinutes * nextMinutePx;
    const totalHeight = 24 * 60 * nextMinutePx + PADDING_TOP * 2;
    const maxScroll = Math.max(0, totalHeight - container.clientHeight);
    const nextScrollTop = nextLineTop - screenOffset;
    container.scrollTop = Math.min(Math.max(0, nextScrollTop), maxScroll);
    setZoom(clamped);
  }

  function handleDragEnd(event: DragEndEvent) {
    const data = event.active.data.current as { type?: string } | undefined;
    if (data?.type && data.type !== "pool-task") {
      resetDragState();
      return;
    }
    const { active, over } = event;
    if (!over) {
      resetDragState();
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const { tasks } = useTaskStore.getState();

    if (overId !== "timeline") {
      if (activeId === overId) return;
      const activeTask = tasks.find((t) => t.id === activeId);
      const overTask = tasks.find((t) => t.id === overId);
      if (!activeTask || !overTask) return;
      const canSortActive =
        activeTask.status === "unscheduled" || activeTask.status === "unfinished";
      const canSortOver =
        overTask.status === "unscheduled" || overTask.status === "unfinished";
      if (!canSortActive || !canSortOver) return;
      movePoolTask(activeId, overId);
      resetDragState();
      return;
    }

    const taskId = activeId;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || dropMinute === null) {
      resetDragState();
      return;
    }
    if (task.status !== "unscheduled" && task.status !== "unfinished") {
      resetDragState();
      return;
    }

    const dropTime = minutesToTime(dropMinute);
    if (isPastDropMinute(selectedDate, dropMinute)) {
      setDropError("Tasks must be scheduled in the future.");
      setTimeout(() => setDropError(null), 2200);
      resetDragState();
      return;
    }

    const conflicting = findCollision(
      tasks,
      taskId,
      selectedDate,
      dropTime,
      task.duration
    );

    if (conflicting) {
      setShakeTaskId(conflicting.id);
      setTimeout(() => setShakeTaskId(null), 650);
    } else {
      scheduleTask(taskId, selectedDate, dropTime);
    }
    resetDragState();
  }

  function handleDragCancel() {
    resetDragState();
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className="flex h-screen overflow-hidden min-w-0 w-full"
        style={{ backgroundColor: "var(--background)" }}
      >
        <main
          className="flex flex-col shrink min-w-0 flex-1"
          style={{
            minWidth: 0,
            backgroundColor: "var(--panel-bg)",
          }}
        >
          <OnboardingGuide />
          <TopHeader
            zoom={zoom}
            onZoomChange={handleZoomChange}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onLocateNow={handleLocateNow}
          />
          <TimeAxis
            shakeTaskId={shakeTaskId}
            zoom={zoom}
            dropMinute={dropMinute}
            dragDuration={activeDragTask?.duration ?? null}
            isDraggingTask={Boolean(activeDragTask)}
            timelineRef={timelineRef}
            selectedDate={selectedDate}
            isPastDate={isPastDate}
            isToday={isToday}
          />
          <SmartControlBar />
        </main>

        <aside
          className="relative z-40 shrink-0 border-l transition-[width] duration-300 ease-in-out"
          style={{
            width: rightPanelOpen ? "clamp(220px, 20vw, 400px)" : 14,
            borderColor: "var(--border-color)",
            backgroundColor: "var(--panel-bg)",
            maxHeight: "100vh",
          }}
        >
          <button
            onClick={() => setRightPanelOpen((v) => !v)}
            className="absolute left-0 top-3 -translate-x-1/2 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--panel-bg)",
              color: "var(--text-secondary)",
              boxShadow: "0 2px 8px rgba(15,23,42,0.12)",
            }}
            aria-label={rightPanelOpen ? "Collapse task panel" : "Expand task panel"}
            title={`${rightPanelOpen ? "Collapse" : "Expand"} task panel (Ctrl/Cmd + B)`}
          >
            {rightPanelOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
          <div
            className="h-full transition-opacity duration-200"
            style={{
              opacity: rightPanelOpen ? 1 : 0,
              pointerEvents: rightPanelOpen ? "auto" : "none",
            }}
          >
            <RightPanel />
          </div>
        </aside>
      </div>
      {dropError && (
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[95] px-4 py-2 rounded-xl text-sm font-medium"
          style={{
            backgroundColor: "#fff7ed",
            color: "#9a3412",
            border: "1px solid #fed7aa",
            boxShadow: "0 10px 20px rgba(154,52,18,0.15)",
          }}
        >
          {dropError}
        </div>
      )}
      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay dropAnimation={null} style={{ zIndex: 9999 }}>
            {activeDragTask ? (
              <DragGhost task={activeDragTask} />
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}

function DragGhost({ task }: { task: Task }) {
  const tagColor = SCENARIO_COLORS[task.tag] ?? "#94a3b8";
  return (
    <div
      className="rounded-xl border px-3 py-2 shadow-xl"
      style={{
        backgroundColor: "var(--panel-bg)",
        borderColor: "var(--border-color)",
        minWidth: 200,
      }}
    >
      <div className="flex items-center gap-2">
        {task.type === "todo" && (
          <span
            className="w-4 h-4 rounded border shrink-0"
            style={{ borderColor: "var(--border-color)" }}
          />
        )}
        <span className="text-sm font-medium truncate flex-1">{task.title}</span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{ color: tagColor, backgroundColor: `${tagColor}1f` }}
        >
          {task.tag}
        </span>
      </div>
    </div>
  );
}
