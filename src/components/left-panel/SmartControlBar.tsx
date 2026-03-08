"use client";

import { Play, Pause, SkipForward, TriangleAlert } from "lucide-react";
import { useState, useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useTaskStore, taskSelectors } from "@/store/useTaskStore";
import { playSound } from "@/utils/sound";
import type { Task } from "@/types/task";

import WaterBottleAnimation from "@/components/common/WaterBottleAnimation";

type Status = "idle" | "focusing" | "paused";
type ToastItem = {
  id: string;
  taskId: string;
  title: string;
  startsAt: string;
  minutesLeft: number;
};

function isTaskOverdue(task: Task): boolean {
  if (!task.scheduledTime || !task.scheduledDate) return false;
  const end = new Date(`${task.scheduledDate}T${task.scheduledTime}`);
  end.setMinutes(end.getMinutes() + (task.duration || 25));
  return end < new Date();
}

function getTaskWindow(task: Task) {
  if (!task.scheduledTime || !task.scheduledDate) return null;
  const start = new Date(`${task.scheduledDate}T${task.scheduledTime}`);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + (task.duration || 25));
  return { start, end };
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toTimeKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toTimeWithOffset(date: Date, offsetMinutes: number) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() + offsetMinutes);
  return toTimeKey(copy);
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
    osc.onended = () => ctx.close();
  } catch {}
}

async function ensureNotificationPermission() {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return await Notification.requestPermission();
}

function ElapsedTimeTimer({
  startedAt,
  isActive,
  onElapsedChange,
}: {
  startedAt?: number;
  isActive: boolean;
  onElapsedChange?: (elapsed: number) => void;
}) {
  const [elapsed, setElapsed] = useState(() =>
    startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTicker = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!startedAt || !isActive) {
      clearTicker();
      return;
    }
    clearTicker();
    intervalRef.current = setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);
    return clearTicker;
  }, [startedAt, isActive]);

  useEffect(() => {
    onElapsedChange?.(elapsed);
  }, [elapsed, onElapsedChange]);

  if (!startedAt) return null;
  return (
    <div
      className="px-3 py-1.5 rounded-xl text-sm font-semibold tabular-nums"
      style={{ color: "#0f172a", backgroundColor: "#e2e8f0" }}
    >
      {formatElapsed(elapsed)}
    </div>
  );
}

function ExpiredTaskBubblePortal({
  anchorRef,
  visible,
  expiredTaskCount,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  visible: boolean;
  expiredTaskCount: number;
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const updatePosition = () => {
      const anchorElement = anchorRef.current;
      if (!anchorElement) return;
      const rect = anchorElement.getBoundingClientRect();
      setPosition({
        left: rect.left + rect.width / 2,
        top: rect.top - 14,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [visible, anchorRef]);

  if (typeof document === "undefined" || !visible || !position) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[120] -translate-x-1/2 -translate-y-full px-3 py-2 rounded-2xl text-xs leading-5 shadow-2xl"
      style={{
        left: position.left,
        top: position.top,
        color: "#fff",
        backgroundColor: "rgba(239, 68, 68, 0.9)",
        boxShadow: "0 14px 26px rgba(185,28,28,0.42)",
      }}
    >
      有 {expiredTaskCount} 个专注任务没有在专注时间内开启，可以调整时间重新开始专注哦～
      <span
        className="absolute top-full left-1/2 -translate-x-1/2 border-[7px] border-transparent"
        style={{ borderTopColor: "rgba(239, 68, 68, 0.9)" }}
      />
    </div>,
    document.body
  );
}

function ToastStack({
  items,
  onStart,
  onDismiss,
}: {
  items: ToastItem[];
  onStart: (taskId: string) => void;
  onDismiss: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[95] flex flex-col gap-3 w-[min(92vw,560px)]">
      {items.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-4 px-5 py-4 rounded-2xl border shadow-2xl"
          style={{
            backgroundColor: "var(--panel-bg)",
            borderColor: "var(--border-color)",
            boxShadow: "0 12px 28px rgba(15,23,42,0.18)",
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold truncate">{toast.title}</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {toast.startsAt} 开始 · {toast.minutesLeft <= 0 ? "现在开始" : `${toast.minutesLeft} 分钟后`}
            </p>
          </div>
          <button
            onClick={() => onStart(toast.taskId)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ backgroundColor: "#6366f1", color: "#fff" }}
          >
            立即开始专注
          </button>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-sm px-3 py-2 rounded-xl transition-colors hover:bg-gray-50"
            style={{ color: "var(--text-muted)" }}
          >
            稍后
          </button>
        </div>
      ))}
    </div>
  );
}

function useTaskNotifications(
  scheduledTasks: Task[],
  onStart: (taskId: string) => void
) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const firedRef = useRef<Set<string>>(new Set());
  const firedStartRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const tick = async () => {
      const now = new Date();
      const nowDate = toDateKey(now);
      const nowMs = now.getTime();
      const dueTasks = scheduledTasks.filter((task) => {
        if (
          task.status !== "scheduled" ||
          task.type !== "focus" ||
          !task.scheduledDate ||
          !task.scheduledTime ||
          task.scheduledDate !== nowDate
        ) {
          return false;
        }
        const start = new Date(`${task.scheduledDate}T${task.scheduledTime}`).getTime();
        const diff = start - nowMs;
        return diff >= 0 && diff <= 2 * 60 * 1000;
      });
      for (const task of dueTasks) {
        if (!task.scheduledDate || !task.scheduledTime) continue;
        const startsAt = task.scheduledTime;
        const start = new Date(`${task.scheduledDate}T${task.scheduledTime}`).getTime();
        const minutesLeft = Math.max(0, Math.ceil((start - nowMs) / 60000));
        const key = `${task.id}-${task.scheduledDate}-${task.scheduledTime}`;
        if (firedRef.current.has(key)) continue;
        firedRef.current.add(key);
        setToasts((prev) => [
          ...prev.filter((item) => item.id !== key),
          {
            id: key,
            taskId: task.id,
            title: task.title,
            startsAt,
            minutesLeft,
          },
        ]);
        playSound("notice");
        setTimeout(() => {
          setToasts((prev) => prev.filter((item) => item.id !== key));
        }, 12000);
        if (document.hidden) {
          const permission = await ensureNotificationPermission();
          if (permission === "granted") {
            new Notification("任务开始提醒", {
              body: `${task.title} · ${task.scheduledTime} 开始`,
            });
            playChime();
          }
        }
      }

      const startingTasks = scheduledTasks.filter((task) => {
        if (
          task.status !== "scheduled" ||
          task.type !== "focus" ||
          !task.scheduledDate ||
          !task.scheduledTime ||
          task.scheduledDate !== nowDate
        ) {
          return false;
        }
        const start = new Date(`${task.scheduledDate}T${task.scheduledTime}`).getTime();
        const diff = nowMs - start;
        return diff >= 0 && diff <= 30_000;
      });
      for (const task of startingTasks) {
        if (!task.scheduledDate || !task.scheduledTime) continue;
        const startsAt = task.scheduledTime;
        const startKey = `${task.id}-${task.scheduledDate}-${task.scheduledTime}-start`;
        if (firedStartRef.current.has(startKey)) continue;
        firedStartRef.current.add(startKey);
        setToasts((prev) => [
          ...prev.filter((item) => item.id !== startKey),
          {
            id: startKey,
            taskId: task.id,
            title: task.title,
            startsAt,
            minutesLeft: 0,
          },
        ]);
        playSound("notice");
        setTimeout(() => {
          setToasts((prev) => prev.filter((item) => item.id !== startKey));
        }, 12000);
        if (document.hidden) {
          const permission = await ensureNotificationPermission();
          if (permission === "granted") {
            new Notification("专注已开始提醒", {
              body: `${task.title} · 已开始专注`,
            });
            playChime();
          }
        }
      }
    };
    tick();
    const id = setInterval(tick, 5_000);
    return () => clearInterval(id);
  }, [scheduledTasks]);

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((item) => item.id !== id));

  const startFromToast = (taskId: string) => {
    onStart(taskId);
    setToasts((prev) => prev.filter((item) => item.taskId !== taskId));
  };

  return { toasts, dismiss, startFromToast };
}

export function getNextValidTask(tasks: Task[], now: Date) {
  const nowMs = now.getTime();
  const candidates = tasks.filter((task) => task.status === "scheduled");
  let overlapping: Task | null = null;
  let upcoming: Task | null = null;
  let upcomingStart = Infinity;

  for (const task of candidates) {
    const window = getTaskWindow(task);
    if (!window) continue;
    const startMs = window.start.getTime();
    const endMs = window.end.getTime();
    if (endMs <= nowMs) continue;
    if (startMs <= nowMs && nowMs < endMs) {
      if (!overlapping || startMs < getTaskWindow(overlapping)!.start.getTime()) {
        overlapping = task;
      }
      continue;
    }
    if (startMs >= nowMs && startMs < upcomingStart) {
      upcomingStart = startMs;
      upcoming = task;
    }
  }

  return overlapping ?? upcoming;
}

function useTaskGarbageCollection(cleanup: () => void) {
  useEffect(() => {
    const run = () => cleanup();
    run();
    const id = setInterval(run, 60_000);
    const onFocus = () => run();
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cleanup]);
}

export default function SmartControlBar() {
  const [isPaused, setIsPaused] = useState(false);
  const [expiredTaskCount, setExpiredTaskCount] = useState(0);
  const [showExpiredBubble, setShowExpiredBubble] = useState(false);
  const [elapsedSnapshot, setElapsedSnapshot] = useState<{ key: string; seconds: number }>({
    key: "",
    seconds: 0,
  });
  const expiredBellRef = useRef<HTMLDivElement | null>(null);

  const activeTask = useTaskStore(taskSelectors.activeTask);
  const scheduledTasks = useTaskStore(useShallow(taskSelectors.scheduledTasks));
  const collectionCount = useTaskStore((s) => s.collection.length);
  const startTask = useTaskStore((s) => s.startTask);
  const completeTask = useTaskStore((s) => s.completeTask);
  const bounceTask = useTaskStore((s) => s.bounceTask);
  const rescheduleTask = useTaskStore((s) => s.rescheduleTask);
  const cleanupExpiredTasks = useTaskStore((s) => s.cleanupExpiredTasks);

  const now = new Date();
  const nextTask = getNextValidTask(scheduledTasks, now);
  const canStartNext = Boolean(nextTask);
  const { toasts, dismiss, startFromToast } = useTaskNotifications(
    scheduledTasks,
    startTask
  );
  useTaskGarbageCollection(cleanupExpiredTasks);

  useEffect(() => {
    useTaskStore.setState((state) => {
      state.tasks.forEach((task) => {
        if (task.status === "in_progress") {
          task.status = "scheduled";
          task.startedAt = undefined;
          task.isDone = false;
          task.isMissedFocus = false;
        }
        if (task.status === "unfinished") {
          task.status = "scheduled";
          task.isUnfinished = false;
        }
      });
      state.activeTaskId = null;
      const now = new Date();
      const today = toDateKey(now);
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayKey = toDateKey(yesterday);
      state.tasks = state.tasks.filter(
        (task) => !task.id.startsWith("preview-focus-")
      );
      const plan = [
        { id: "demo-1", offset: 5, duration: 20, missed: false, completed: false },
        { id: "demo-2", offset: 30, duration: 25, missed: false, completed: true },
        { id: "demo-3", offset: 70, duration: 20, missed: false, completed: false },
        { id: "demo-4", offset: -40, duration: 15, missed: true, completed: false },
        
      ];
      plan.forEach((item) => {
        const target = state.tasks.find((task) => task.id === item.id);
        if (!target) return;
        target.type = "focus";
        target.status = item.completed ? "completed" : "scheduled";
        target.duration = item.duration;
        target.scheduledDate = today;
        target.scheduledTime = toTimeWithOffset(now, item.offset);
        target.isMissedFocus = item.missed;
        target.isDone = item.completed;
        target.isUnfinished = false;
        target.completedAt = item.completed ? Date.now() : undefined;
        target.startedAt = undefined;
      });

      const yesterdayPlan = [
        {
          id: "demo-y1",
          title: "整理笔记与待办",
          tag: "工作" as const,
          duration: 25,
          status: "completed" as const,
          scheduledTime: "09:00",
          completedAt: Date.now() - 85000000,
        },
        {
          id: "demo-y2",
          title: "阅读《深度工作》",
          tag: "学习" as const,
          duration: 30,
          status: "completed" as const,
          scheduledTime: "14:00",
          completedAt: Date.now() - 82000000,
        },
        {
          id: "demo-y3",
          title: "夜跑 5 公里",
          tag: "生活" as const,
          duration: 40,
          status: "completed" as const,
          scheduledTime: "20:00",
          completedAt: Date.now() - 79000000,
        },
        {
          id: "demo-y4",
          title: "写周报",
          tag: "工作" as const,
          duration: 20,
          status: "scheduled" as const,
          scheduledTime: "16:00",
        },
      ];
      yesterdayPlan.forEach((item) => {
        const target = state.tasks.find((task) => task.id === item.id);
        if (target) {
          target.type = "focus";
          target.status = item.status;
          target.tag = item.tag;
          target.duration = item.duration;
          target.scheduledDate = yesterdayKey;
          target.scheduledTime = item.scheduledTime;
          target.completedAt = "completedAt" in item ? item.completedAt : undefined;
          target.isUnfinished = false;
          target.isDone = item.status === "completed";
          return;
        }
        state.tasks.push({
          id: item.id,
          title: item.title,
          type: "focus",
          tag: item.tag,
          duration: item.duration,
          status: item.status,
          scheduledDate: yesterdayKey,
          scheduledTime: item.scheduledTime,
          createdAt: Date.now() - 86400000,
          completedAt: "completedAt" in item ? item.completedAt : undefined,
          isUnfinished: false,
          isDone: item.status === "completed",
        });
      });
    });
  }, []);

  useEffect(() => {
    const check = () =>
      setExpiredTaskCount(
        scheduledTasks.filter(
          (t) => t.type === "focus" && t.status === "scheduled" && isTaskOverdue(t)
        ).length
      );
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [scheduledTasks]);

  useEffect(() => {
    const onShortcut = () => {
      if (activeTask) {
        setIsPaused((value) => !value);
      } else if (canStartNext && nextTask) {
        setIsPaused(false);
        startTask(nextTask.id);
      }
    };
    const handler = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !e.repeat &&
        !(e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")
      ) {
        e.preventDefault();
        onShortcut();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTask, canStartNext, nextTask, startTask]);

  const handleStart = () => {
    if (canStartNext && nextTask) {
      setIsPaused(false);
      startTask(nextTask.id);
    }
  };

  const handleBringForward = () => {
    if (!nextTask) return;
    const now = new Date();
    const scheduledDate = toDateKey(now);
    const scheduledTime = toTimeKey(now);
    rescheduleTask(nextTask.id, scheduledDate, scheduledTime);
    setIsPaused(false);
    startTask(nextTask.id);
  };

  const handlePause = () => {
    setIsPaused((value) => !value);
  };

  const handleCompleteFocus = () => {
    if (!activeTask || activeTask.type !== "focus") return;
    completeTask(activeTask.id);
    setIsPaused(false);
    setElapsedSnapshot({ key: "", seconds: 0 });
  };

  const handleSkip = () => {
    if (activeTask) bounceTask(activeTask.id);
    setIsPaused(false);
    setElapsedSnapshot({ key: "", seconds: 0 });
  };

  const displayTask = activeTask ?? nextTask;
  const status: Status = activeTask ? (isPaused ? "paused" : "focusing") : "idle";
  const currentTimerKey = activeTask
    ? `${activeTask.id}-${activeTask.startedAt ?? 0}`
    : "";
  const canShowCompleteCta =
    Boolean(activeTask) &&
    activeTask?.type === "focus" &&
    elapsedSnapshot.key === currentTimerKey &&
    elapsedSnapshot.seconds >= (activeTask?.duration || 25) * 60;

  return (
    <div
      className="shrink-0 border-t flex items-center px-4 gap-3 flex-wrap"
      style={{
        height: "var(--control-bar-height)",
        borderColor: "var(--border-color)",
        backgroundColor: "var(--panel-bg)",
      }}
    >
      {/* Status indicator */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{
            backgroundColor:
              status === "focusing" ? "#eef2ff" : "var(--background)",
          }}
        >
          <div
            className="w-2 h-2 rounded-full transition-colors"
            style={{
              backgroundColor:
                status === "focusing"
                  ? "#6366f1"
                  : status === "paused"
                    ? "#f59e0b"
                    : "#d1d5db",
            }}
          />
          <span
            className="text-sm font-medium whitespace-nowrap"
            style={{
              color:
                status === "focusing"
                  ? "#6366f1"
                  : "var(--text-secondary)",
            }}
          >
            {status === "focusing"
              ? "专注中"
              : status === "paused"
                ? "已暂停"
                : "待机"}
          </span>
        </div>

        <div className="flex-1 min-w-0 px-2">
          <p
            className="text-sm truncate"
            style={{ color: "var(--text-muted)" }}
          >
            {displayTask
              ? `${displayTask.type === "focus" ? "🐸" : "💧"} ${displayTask.title}`
              : "拖拽时间轴上的任务开始专注"}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {!activeTask ? (
          <>
            <button
              onClick={handleStart}
              disabled={!canStartNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: canStartNext ? "#6366f1" : "#c7c9f8",
                color: "#ffffff",
              }}
              title={!canStartNext && nextTask ? "任务已过期，无法开始" : "开始专注"}
            >
              <Play size={16} fill="currentColor" />
              开始专注
            </button>
            <button
              onClick={handleBringForward}
              disabled={!nextTask}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "#0ea5e9",
                color: "#ffffff",
              }}
              title="立刻开始下一个任务"
            >
              <Play size={14} />
              立即开始
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handlePause}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all active:scale-95"
              style={{
                backgroundColor: status === "paused" ? "#6366f1" : "#fef3c7",
                color: status === "paused" ? "#fff" : "#92400e",
              }}
            >
              {status === "paused" ? (
                <><Play size={14} fill="currentColor" />继续</>
              ) : (
                <><Pause size={14} />暂停</>
              )}
            </button>
            <ElapsedTimeTimer
              key={`${activeTask?.id ?? "none"}-${activeTask?.startedAt ?? 0}`}
              startedAt={activeTask?.startedAt}
              isActive={Boolean(activeTask) && !isPaused}
              onElapsedChange={(elapsed) =>
                setElapsedSnapshot({ key: currentTimerKey, seconds: elapsed })
              }
            />
            {canShowCompleteCta && activeTask?.type === "focus" && (
              <button
                onClick={handleCompleteFocus}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 animate-pulse"
                style={{ backgroundColor: "#22c55e", color: "#fff" }}
                title="专注时间已完成，点击完成任务"
              >
                完成任务
              </button>
            )}
            <button
              onClick={handleSkip}
              className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors"
              style={{ color: "var(--text-muted)" }}
              title="跳过"
            >
              <SkipForward size={16} />
            </button>
          </>
        )}
      </div>

      {/* Overdue Bell + Collection */}
      <div className="flex items-center gap-1 shrink-0">
        <div
          ref={expiredBellRef}
          className="relative flex items-center gap-1.5 px-2.5 py-2 rounded-xl transition-colors hover:bg-gray-50"
          title={`过期任务 ${expiredTaskCount}`}
          onMouseEnter={() => setShowExpiredBubble(true)}
          onMouseLeave={() => setShowExpiredBubble(false)}
          onFocus={() => setShowExpiredBubble(true)}
          onBlur={() => setShowExpiredBubble(false)}
        >
          <TriangleAlert
            size={16}
            style={{ color: expiredTaskCount > 0 ? "#ef4444" : "var(--text-muted)" }}
          />
          <span
            className="min-w-5 h-5 px-1 rounded-full text-[11px] font-semibold flex items-center justify-center tabular-nums"
            style={{
              backgroundColor: expiredTaskCount > 0 ? "#fee2e2" : "#f3f4f6",
              color: expiredTaskCount > 0 ? "#b91c1c" : "#6b7280",
            }}
          >
            {expiredTaskCount}
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
          title="水瓶收集库"
        >
          <WaterBottleAnimation percentageFilled={Math.min(100, collectionCount * 12)} />
          <span
            className="text-xs font-medium tabular-nums"
            style={{ color: "var(--text-secondary)" }}
          >
            {collectionCount}
          </span>
        </div>
      </div>

      <ExpiredTaskBubblePortal
        anchorRef={expiredBellRef}
        visible={showExpiredBubble}
        expiredTaskCount={expiredTaskCount}
      />
      <ToastStack items={toasts} onStart={startFromToast} onDismiss={dismiss} />
    </div>
  );
}
