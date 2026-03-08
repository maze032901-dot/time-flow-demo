"use client";

import { Plus, Filter, Clock, CheckSquare, Tag } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useShallow } from "zustand/react/shallow";
import { useTaskStore, taskSelectors } from "@/store/useTaskStore";
import type { TaskType, ScenarioTag } from "@/types/task";

const TYPE_CONFIG: Record<TaskType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  focus: {
    label: "专注",
    color: "#6366f1",
    bg: "#eef2ff",
    icon: <Clock size={11} />,
  },
  todo: {
    label: "待办",
    color: "#10b981",
    bg: "#d1fae5",
    icon: <CheckSquare size={11} />,
  },
};

const TAG_COLORS: Record<ScenarioTag, string> = {
  工作: "#f59e0b",
  学习: "#3b82f6",
  生活: "#10b981",
  其他: "#8b5cf6",
};

export default function TaskPool() {
  const tasks = useTaskStore(useShallow(taskSelectors.poolTasks));
  const addTask = useTaskStore((s) => s.addTask);

  const [filterType, setFilterType] = useState<TaskType | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered =
    filterType === "all" ? tasks : tasks.filter((t) => t.type === filterType);

  useEffect(() => {
    const handler = () => {
      setShowAddModal(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    };
    window.addEventListener("open-add-task", handler);
    return () => window.removeEventListener("open-add-task", handler);
  }, []);

  const handleAddTask = (data: { title: string; tag: ScenarioTag; duration: number }) => {
    addTask(data);
    setShowAddModal(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="shrink-0 flex flex-col items-center justify-center gap-2 border-b px-4"
        style={{
          height: "20%",
          minHeight: 72,
          borderColor: "var(--border-color)",
          backgroundColor: "var(--panel-bg)",
        }}
      >
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: "#6366f1", color: "#ffffff" }}
        >
          <Plus size={16} strokeWidth={2.5} />
          添加任务
        </button>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          或拖拽到左侧时间轴
        </p>
      </div>

      <div
        className="shrink-0 flex items-center gap-1 px-3 py-2 border-b"
        style={{
          borderColor: "var(--border-color)",
          backgroundColor: "var(--panel-bg)",
        }}
      >
        <Filter size={12} style={{ color: "var(--text-muted)" }} />
        {(["all", "focus", "todo"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor:
                filterType === type ? "var(--accent-light)" : "transparent",
              color:
                filterType === type ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {type === "all" ? "全部" : TYPE_CONFIG[type].label}
          </button>
        ))}
        <span
          className="ml-auto text-xs tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {filtered.length}
        </span>
      </div>

      <div
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0"
        style={{ backgroundColor: "var(--background)" }}
      >
        {filtered.map((task) => (
          <DraggableTaskCard key={task.id} task={task} />
        ))}
        {filtered.length === 0 && (
          <div
            className="text-center py-8 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            暂无任务
          </div>
        )}
      </div>

      {showAddModal && (
        <AddTaskModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddTask}
          inputRef={inputRef}
        />
      )}
    </div>
  );
}

function DraggableTaskCard({
  task,
}: {
  task: {
    id: string;
    title: string;
    type: TaskType;
    tag: ScenarioTag;
    duration?: number;
    isUnfinished?: boolean;
  };
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, data: { type: "task", task } });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TaskCard task={task} />
    </div>
  );
}

function TaskCard({
  task,
}: {
  task: {
    id: string;
    title: string;
    type: TaskType;
    tag: ScenarioTag;
    duration?: number;
    isUnfinished?: boolean;
  };
}) {
  const typeConf = TYPE_CONFIG[task.type];

  return (
    <div
      className="group p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all hover:shadow-sm"
      style={{
        borderColor: "var(--border-color)",
        backgroundColor: "var(--panel-bg)",
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug truncate">
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium"
              style={{ color: typeConf.color, backgroundColor: typeConf.bg }}
            >
              {typeConf.icon}
              {typeConf.label}
            </span>
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium"
              style={{
                color: TAG_COLORS[task.tag],
                backgroundColor: TAG_COLORS[task.tag] + "18",
              }}
            >
              <Tag size={9} />
              {task.tag}
            </span>
            {task.duration && (
              <span
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {task.duration}min
              </span>
            )}
            {task.isUnfinished && (
              <span className="inline-flex px-1.5 py-0.5 rounded-md text-xs font-semibold bg-red-50 text-red-500">
                未完成
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddTaskModal({
  onClose,
  onSubmit,
  inputRef,
}: {
  onClose: () => void;
  onSubmit: (data: { title: string; tag: ScenarioTag; duration: number }) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState<ScenarioTag>("工作");
  const [duration] = useState(25);

  const handleSubmit = () => {
    const t = title.trim();
    if (!t) return;
    onSubmit({ title: t, tag, duration });
  };

  return (
    <div
      className="absolute inset-0 flex items-end justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl p-5 shadow-xl"
        style={{ backgroundColor: "var(--panel-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-sm mb-4">新建任务</h3>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="任务名称..."
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none border focus:border-indigo-300 transition-colors"
          style={{ borderColor: "var(--border-color)" }}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <p className="mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          新任务默认创建为待办，拖拽到时间轴后自动转为专注任务。
        </p>
        <div className="flex gap-2 mt-2 flex-wrap">
          {(["工作", "学习", "生活", "其他"] as ScenarioTag[]).map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{
                backgroundColor: tag === t ? TAG_COLORS[t] + "30" : "transparent",
                color: tag === t ? TAG_COLORS[t] : "var(--text-muted)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-gray-50"
            style={{ color: "var(--text-secondary)" }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: "#6366f1" }}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
