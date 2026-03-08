"use client";

import { Plus, Sparkles, Droplets, Pencil, Trash2, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useShallow } from "zustand/react/shallow";
import { useTaskStore, taskSelectors } from "@/store/useTaskStore";
import type { Task, TaskType, ScenarioTag } from "@/types/task";

const TYPE_CONFIG: Record<
  TaskType,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  focus: {
    label: "Focus",
    color: "#8b5cf6",
    bg: "#f5f3ff",
    icon: <span className="text-sm">🐸</span>,
  },
  todo: {
    label: "Todo",
    color: "#3b82f6",
    bg: "#eff6ff",
    icon: <Droplets size={14} strokeWidth={2} />,
  },
};

const SCENARIO_CONFIG: Record<
  ScenarioTag,
  { label: string; color: string }
> = {
  工作: { label: "Work", color: "#f59e0b" },
  学习: { label: "Study", color: "#3b82f6" },
  生活: { label: "Home", color: "#10b981" },
  其他: { label: "Other", color: "#8b5cf6" },
};

type PoolTask = {
  id: string;
  title: string;
  type: TaskType;
  tag: ScenarioTag;
  duration?: number;
  isUnfinished?: boolean;
};

type ContextMenuState = {
  taskId: string;
  x: number;
  y: number;
};

export default function RightPanel() {
  const poolTasks = useTaskStore(useShallow(taskSelectors.poolTasks));
  const completedTasks = useTaskStore(useShallow(taskSelectors.completedTasks));
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const removeTask = useTaskStore((s) => s.removeTask);

  const [showModal, setShowModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [panelMode, setPanelMode] = useState<"pool" | "done">("pool");
  const [filterType, setFilterType] = useState<"all" | TaskType>("all");
  const [filterScenario, setFilterScenario] = useState<ScenarioTag | "all">("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodeRef: setPoolDropRef, isOver: isOverPool } = useDroppable({
    id: "taskpool",
  });

  const doneTasks = completedTasks.filter((task) => task.type === "todo");
  const sourceTasks = panelMode === "done" ? doneTasks : poolTasks;
  const filtered = sourceTasks.filter((t) => {
    const typeMatch = filterType === "all" || t.type === filterType;
    const scenarioMatch = filterScenario === "all" || t.tag === filterScenario;
    return typeMatch && scenarioMatch;
  });
  const typeCounts = {
    all: sourceTasks.length,
    focus: sourceTasks.filter((task) => task.type === "focus").length,
    todo: sourceTasks.filter((task) => task.type === "todo").length,
  };
  const scenarioCounts: Record<ScenarioTag, number> = {
    工作: sourceTasks.filter((task) => task.tag === "工作").length,
    学习: sourceTasks.filter((task) => task.tag === "学习").length,
    生活: sourceTasks.filter((task) => task.tag === "生活").length,
    其他: sourceTasks.filter((task) => task.tag === "其他").length,
  };
  const editingTask = poolTasks.find((task) => task.id === editingTaskId) ?? null;

  useEffect(() => {
    const handler = () => {
      setShowModal(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    };
    window.addEventListener("open-add-task", handler);
    return () => window.removeEventListener("open-add-task", handler);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const onPointerDown = () => setContextMenu(null);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [contextMenu]);

  const handleAddTask = (data: {
    title: string;
    tag: ScenarioTag;
    duration: number;
  }) => {
    addTask(data);
    setShowModal(false);
  };

  const openContextMenuAt = (taskId: string, x: number, y: number) => {
    const menuWidth = 188;
    const menuHeight = 108;
    setContextMenu({
      taskId,
      x: Math.min(x, window.innerWidth - menuWidth - 12),
      y: Math.min(y, window.innerHeight - menuHeight - 12),
    });
  };

  const handleContextMenuOpen = (event: React.MouseEvent, taskId: string) => {
    event.preventDefault();
    event.stopPropagation();
    openContextMenuAt(taskId, event.clientX, event.clientY);
  };

  const handleDeleteTask = (taskId: string) => {
    removeTask(taskId);
    setContextMenu(null);
  };

  const handleRestoreDoneTask = (taskId: string) => {
    updateTask(taskId, {
      status: "unscheduled",
      isDone: false,
      isUnfinished: false,
      startedAt: undefined,
      completedAt: undefined,
      scheduledDate: undefined,
      scheduledTime: undefined,
    });
  };

  const handleOpenEdit = (taskId: string) => {
    setEditingTaskId(taskId);
    setContextMenu(null);
  };

  const handleConvertToTodo = (taskId: string) => {
    updateTask(taskId, { type: "todo" });
    setContextMenu(null);
  };

  const handleSubmitEdit = (patch: {
    title: string;
    tag: ScenarioTag;
    duration: number;
  }) => {
    if (!editingTaskId) return;
    updateTask(editingTaskId, patch);
    setEditingTaskId(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      <div
        className="shrink-0 border-b px-4 pt-3 pb-2.5"
        style={{
          borderColor: "var(--border-color)",
          backgroundColor: "var(--panel-bg)",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            Task Pool
          </h2>
          <div className="group relative shrink-0 h-12 w-[52px] hover:w-[104px] transition-[width] duration-300 ease-out">
            <button
              onClick={() => setShowModal(true)}
              className="z-20 absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-[1.03] active:scale-95"
              style={{
                backgroundColor: "#4f46e5",
                color: "#fff",
                boxShadow: "0 10px 22px rgba(79,70,229,0.35)",
              }}
              aria-label="Add task"
              title="Add task (Ctrl/Cmd + N)"
            >
              <Plus size={18} strokeWidth={2.8} />
            </button>
            <button
              onClick={() => setShowAiModal(true)}
              className="z-10 absolute top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out hover:scale-[1.04] active:scale-95 right-4 group-hover:right-0"
              style={{
                backgroundColor: "#4f46e5",
                color: "#fff",
                boxShadow: "0 10px 20px rgba(14,165,233,0.32)",
              }}
              aria-label="Open AI panel"
              title="Open AI panel"
            >
              <Sparkles size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Or drag cards to the timeline
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <FilterPill
            active={panelMode === "pool"}
            onClick={() => setPanelMode("pool")}
            label="pool"
            activeColor="#6366f1"
            count={poolTasks.length}
          />
          <FilterPill
            active={panelMode === "done"}
            onClick={() => setPanelMode("done")}
            label="done"
            activeColor="#22c55e"
            count={doneTasks.length}
          />
        </div>
      </div>

      <div
        className="shrink-0 px-3 pt-3 pb-2 space-y-2 border-b"
        style={{
          borderColor: "var(--border-color)",
          backgroundColor: "var(--panel-bg)",
        }}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium mr-1" style={{ color: "var(--text-muted)" }}>
            Type:
          </span>
          {(["all", "focus", "todo"] as const).map((t) => (
            <FilterPill
              key={t}
              active={filterType === t}
              onClick={() => setFilterType(t)}
              label={t === "all" ? "All" : TYPE_CONFIG[t].label}
              activeColor={t === "all" ? "#6366f1" : TYPE_CONFIG[t].color}
              count={typeCounts[t]}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium mr-1" style={{ color: "var(--text-muted)" }}>
            Scenario:
          </span>
          <FilterPill
            active={filterScenario === "all"}
            onClick={() => setFilterScenario("all")}
            label="All"
            activeColor="#6366f1"
            count={sourceTasks.length}
          />
          {(Object.keys(SCENARIO_CONFIG) as ScenarioTag[]).map((tag) => (
            <FilterPill
              key={tag}
              active={filterScenario === tag}
              onClick={() => setFilterScenario(tag)}
              label={SCENARIO_CONFIG[tag].label}
              activeColor={SCENARIO_CONFIG[tag].color}
              count={scenarioCounts[tag]}
            />
          ))}
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto px-3 py-3 min-h-0"
        style={{ backgroundColor: "var(--background)" }}
        ref={panelMode === "pool" ? setPoolDropRef : undefined}
      >
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 gap-2"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="text-2xl">🫧</span>
            <p className="text-xs">
              {panelMode === "done" ? "No done todos" : "No tasks yet"}
            </p>
          </div>
        ) : panelMode === "pool" ? (
          <SortableContext
            items={filtered.map((task) => task.id)}
            strategy={verticalListSortingStrategy}
          >
            <div
              className="space-y-2 rounded-lg transition-colors"
              style={{ backgroundColor: isOverPool ? "rgba(99,102,241,0.08)" : "transparent" }}
            >
              {filtered.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  contextMenuOpen={contextMenu?.taskId === task.id}
                  onContextMenu={handleContextMenuOpen}
                  onKeyboardContextMenu={openContextMenuAt}
                />
              ))}
            </div>
          </SortableContext>
        ) : (
          <div className="space-y-2">
            {filtered.map((task) => (
              <DoneTaskCard
                key={task.id}
                task={task}
                onRestore={handleRestoreDoneTask}
                onDelete={handleDeleteTask}
              />
            ))}
          </div>
        )}
      </div>

      {panelMode === "pool" && contextMenu && (
        <TaskContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          task={poolTasks.find((task) => task.id === contextMenu.taskId) ?? null}
          onEdit={handleOpenEdit}
          onDelete={handleDeleteTask}
          onConvertToTodo={handleConvertToTodo}
        />
      )}

      {showModal && (
        <AddTaskModal
          onClose={() => setShowModal(false)}
          onSubmit={handleAddTask}
          inputRef={inputRef}
        />
      )}

      {showAiModal && <AiPreviewModal onClose={() => setShowAiModal(false)} />}

      {editingTask && (
        <EditTaskModal
          key={editingTask.id}
          task={editingTask}
          onClose={() => setEditingTaskId(null)}
          onSubmit={handleSubmitEdit}
        />
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  activeColor,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  activeColor: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1"
      style={{
        backgroundColor: active ? `${activeColor}20` : "transparent",
        color: active ? activeColor : "var(--text-muted)",
        border: `1px solid ${active ? `${activeColor}50` : "transparent"}`,
      }}
    >
      {label}
      <span
        className="min-w-4 h-4 px-1 rounded-full text-[10px] leading-4 tabular-nums"
        style={{
          color: active ? activeColor : "var(--text-muted)",
          backgroundColor: active ? `${activeColor}1f` : "#f3f4f6",
        }}
      >
        {count ?? 0}
      </span>
    </button>
  );
}

function DoneTaskCard({
  task,
  onRestore,
  onDelete,
}: {
  task: Task;
  onRestore: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const scenarioConf = SCENARIO_CONFIG[task.tag];
  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{ borderColor: "var(--border-color)", backgroundColor: "var(--panel-bg)" }}
    >
      <div className="flex items-start gap-2">
        <div className="w-1.5 rounded-full self-stretch" style={{ backgroundColor: scenarioConf.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{task.title}</p>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span
              className="inline-flex px-1.5 py-0.5 rounded text-xs"
              style={{ color: scenarioConf.color, backgroundColor: `${scenarioConf.color}20` }}
            >
              {scenarioConf.label}
            </span>
            {task.duration && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {task.duration}m
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onRestore(task.id)}
            className="px-2 py-1 rounded-md text-xs font-medium transition-colors hover:bg-indigo-50"
            style={{ color: "#4f46e5" }}
          >
            Restore
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 rounded-md transition-colors hover:bg-red-50"
            style={{ color: "#ef4444" }}
            aria-label="Delete done task"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableTaskCard({
  task,
  onContextMenu,
  onKeyboardContextMenu,
  contextMenuOpen,
}: {
  task: PoolTask;
  onContextMenu: (event: React.MouseEvent, taskId: string) => void;
  onKeyboardContextMenu: (taskId: string, x: number, y: number) => void;
  contextMenuOpen: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: "pool-task", task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 60 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onContextMenu={(event) => onContextMenu(event, task.id)}
      onKeyDown={(event) => {
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          onKeyboardContextMenu(task.id, rect.left + rect.width / 2, rect.top + 16);
        }
      }}
      {...listeners}
      {...attributes}
    >
      <TaskCard task={task} isDragging={isDragging} contextMenuOpen={contextMenuOpen} />
    </div>
  );
}

function TaskCard({
  task,
  isDragging,
  contextMenuOpen,
}: {
  task: PoolTask;
  isDragging: boolean;
  contextMenuOpen: boolean;
}) {
  const typeConf = TYPE_CONFIG[task.type];
  const scenarioConf = SCENARIO_CONFIG[task.tag];
  const removeTask = useTaskStore((s) => s.removeTask);
  const [isChecked, setIsChecked] = useState(false);
  const removeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isChecked) return;
    removeTimerRef.current = window.setTimeout(() => {
      removeTask(task.id);
    }, 320);
    return () => {
      if (removeTimerRef.current) window.clearTimeout(removeTimerRef.current);
    };
  }, [isChecked, removeTask, task.id]);

  return (
    <div
      className="relative flex overflow-hidden rounded-xl border cursor-grab active:cursor-grabbing transition-all hover:shadow-sm"
      style={{
        borderColor: isDragging ? `${scenarioConf.color}80` : "var(--border-color)",
        backgroundColor: isDragging ? `${scenarioConf.color}14` : "var(--panel-bg)",
        boxShadow: isDragging
          ? `0 10px 22px ${scenarioConf.color}2c`
          : contextMenuOpen
            ? "0 6px 14px rgba(15,23,42,0.08)"
            : undefined,
        opacity: isChecked ? 0 : 1,
        transform: isChecked ? "scale(0.98)" : "scale(1)",
        transition: "opacity 220ms ease, transform 220ms ease, box-shadow 150ms ease",
      }}
    >
      <div
        className="w-1 shrink-0 rounded-l-xl"
        style={{
          backgroundColor: scenarioConf.color,
          width: isDragging ? 6 : 4,
          transition: "width 150ms ease",
        }}
      />

      <div className="flex-1 px-3 py-2.5 min-w-0">
        <div className="flex items-start gap-2">
          {task.type === "todo" && (
            <button
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                if (!isChecked) setIsChecked(true);
              }}
              className="w-4 h-4 rounded border mt-1 shrink-0 flex items-center justify-center transition-all"
              style={{
                borderColor: isChecked ? "#34d399" : "var(--border-color)",
                backgroundColor: isChecked ? "#d1fae5" : "var(--panel-bg)",
                boxShadow: isChecked ? "0 0 0 3px rgba(52,211,153,0.25)" : "none",
                transform: isChecked ? "scale(0.92)" : "scale(1)",
              }}
              aria-label="Complete todo"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-3 h-3"
                style={{
                  stroke: "#059669",
                  strokeWidth: 2.5,
                  fill: "none",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeDasharray: 24,
                  strokeDashoffset: isChecked ? 0 : 24,
                  opacity: isChecked ? 1 : 0,
                  transform: isChecked ? "scale(1)" : "scale(0.6)",
                  transition:
                    "stroke-dashoffset 240ms ease, opacity 200ms ease, transform 200ms ease",
                }}
              >
                <path d="M5 12l4 4L19 7" />
              </svg>
            </button>
          )}
          <span
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded-lg"
            style={{ backgroundColor: typeConf.bg, color: typeConf.color }}
          >
            {typeConf.icon}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug line-clamp-2">
              <span
                style={{
                  textDecoration: isChecked ? "line-through" : "none",
                  color: isChecked ? "var(--text-muted)" : "inherit",
                  transition: "color 220ms ease, text-decoration-color 220ms ease",
                }}
              >
                {task.title}
              </span>
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ color: typeConf.color, backgroundColor: typeConf.bg }}
              >
                {typeConf.label}
              </span>
              <span
                className="inline-flex px-1.5 py-0.5 rounded text-xs"
                style={{
                  color: scenarioConf.color,
                  backgroundColor: `${scenarioConf.color}20`,
                }}
              >
                {scenarioConf.label}
              </span>
              {task.duration && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {task.duration}m
                </span>
              )}
              {task.isUnfinished && (
                <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-500 border border-red-200">
                  Unfinished
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskContextMenu({
  x,
  y,
  task,
  onEdit,
  onDelete,
  onConvertToTodo,
}: {
  x: number;
  y: number;
  task: PoolTask | null;
  onEdit: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onConvertToTodo: (taskId: string) => void;
}) {
  if (!task) return null;
  return (
    <div
      className="fixed z-[90] w-44 rounded-xl border p-1.5 shadow-xl"
      style={{
        top: y,
        left: x,
        borderColor: "var(--border-color)",
        backgroundColor: "var(--panel-bg)",
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        className="w-full px-2.5 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors hover:bg-gray-50"
        style={{ color: "var(--text-secondary)" }}
        onClick={() => onEdit(task.id)}
      >
        <Pencil size={14} />
        Edit
      </button>
      <button
        className="w-full px-2.5 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors hover:bg-red-50"
        style={{ color: "#ef4444" }}
        onClick={() => onDelete(task.id)}
      >
        <Trash2 size={14} />
        Delete
      </button>
      {task.type === "focus" && (
        <button
          className="w-full px-2.5 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors hover:bg-gray-50"
          style={{ color: "var(--text-secondary)" }}
          onClick={() => onConvertToTodo(task.id)}
        >
          <Droplets size={14} />
          Convert to Todo
        </button>
      )}
    </div>
  );
}

function AddTaskModal({
  onClose,
  onSubmit,
  inputRef,
}: {
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    tag: ScenarioTag;
    duration: number;
  }) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState<ScenarioTag>("工作");
  const [duration, setDuration] = useState(25);

  const handleSubmit = () => {
    const t = title.trim();
    if (!t) return;
    onSubmit({
      title: t,
      tag,
      duration: Math.max(5, Math.min(240, Number.isFinite(duration) ? duration : 25)),
    });
  };

  return (
    <div
      className="absolute inset-0 flex items-end z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl p-5 shadow-xl"
        style={{ backgroundColor: "var(--panel-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">New Task</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title..."
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none border transition-colors mb-4"
          style={{ borderColor: "var(--border-color)" }}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        <div className="mb-4 px-3 py-2 rounded-xl border text-xs font-medium" style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)", backgroundColor: "var(--background)" }}>
          New tasks are created as Todo and become Focus after dropping on timeline.
        </div>

        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
          Scenario
        </p>
        <div className="flex gap-2 mb-4 flex-wrap">
          {(Object.keys(SCENARIO_CONFIG) as ScenarioTag[]).map((t) => {
            const conf = SCENARIO_CONFIG[t];
            const active = tag === t;
            return (
              <button
                key={t}
                onClick={() => setTag(t)}
                className="flex-1 min-w-[60px] py-2 rounded-xl text-sm font-medium border transition-all"
                style={{
                  borderColor: active ? conf.color : "var(--border-color)",
                  backgroundColor: active ? `${conf.color}18` : "transparent",
                  color: active ? conf.color : "var(--text-secondary)",
                }}
              >
                {conf.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
          Duration (minutes)
        </p>
        <input
          type="number"
          min={5}
          max={240}
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value))}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none border transition-colors mb-4"
          style={{ borderColor: "var(--border-color)" }}
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-gray-50"
            style={{ color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{ backgroundColor: "#6366f1" }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function EditTaskModal({
  task,
  onClose,
  onSubmit,
}: {
  task: PoolTask;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    tag: ScenarioTag;
    duration: number;
  }) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [tag, setTag] = useState<ScenarioTag>(task.tag);
  const [duration, setDuration] = useState(task.duration ?? 25);

  const handleSubmit = () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;
    onSubmit({
      title: normalizedTitle,
      tag,
      duration: Math.max(5, Math.min(240, Number.isFinite(duration) ? duration : 25)),
    });
  };

  return (
    <div
      className="absolute inset-0 flex items-end z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl p-5 shadow-xl"
        style={{ backgroundColor: "var(--panel-bg)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Edit Task</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Task title..."
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none border transition-colors mb-4"
          style={{ borderColor: "var(--border-color)" }}
          autoFocus
          onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
        />

        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
          Scenario
        </p>
        <div className="flex gap-2 mb-4 flex-wrap">
          {(Object.keys(SCENARIO_CONFIG) as ScenarioTag[]).map((itemTag) => {
            const conf = SCENARIO_CONFIG[itemTag];
            const active = tag === itemTag;
            return (
              <button
                key={itemTag}
                onClick={() => setTag(itemTag)}
                className="flex-1 min-w-[60px] py-2 rounded-xl text-sm font-medium border transition-all"
                style={{
                  borderColor: active ? conf.color : "var(--border-color)",
                  backgroundColor: active ? `${conf.color}18` : "transparent",
                  color: active ? conf.color : "var(--text-secondary)",
                }}
              >
                {conf.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
          Duration (minutes)
        </p>
        <input
          type="number"
          min={5}
          max={240}
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value))}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none border transition-colors mb-4"
          style={{ borderColor: "var(--border-color)" }}
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-gray-50"
            style={{ color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{ backgroundColor: "#6366f1" }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function AiPreviewModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(15,23,42,0.25)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border p-3 shadow-xl"
        style={{
          borderColor: "var(--border-color)",
          backgroundColor: "var(--panel-bg)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-2 top-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: "var(--text-muted)" }}
          aria-label="Close AI modal"
        >
          <X size={16} />
        </button>
        <img
          src="/AI_UI.png"
          alt="AI Placeholder"
          className="w-full h-56 object-cover rounded-xl"
        />
      </div>
    </div>
  );
}
