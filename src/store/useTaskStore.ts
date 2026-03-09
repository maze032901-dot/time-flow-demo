import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { devtools } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Task, CollectedBottle, ScenarioTag } from "@/types/task";
import { playSound } from "@/utils/sound";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface TaskState {
  /** 所有任务（包含各生命周期状态） */
  tasks: Task[];

  /**
   * 收集瓶：结算阶段，完成的任务快照飞入此列表
   * 对应 UI 中底部的「水瓶收集」区域
   */
  collection: CollectedBottle[];

  /**
   * 当前进行中的任务 ID（同一时刻最多一个）
   * null 表示当前没有正在进行的任务
   */
  activeTaskId: string | null;
}

// ---------------------------------------------------------------------------
// Actions shape
// ---------------------------------------------------------------------------

interface TaskActions {
  // ── 任务 CRUD ──────────────────────────────────────────────────────────

  /** 新建任务（初始状态：unscheduled，进入右侧任务池） */
  addTask: (payload: {
    title: string;
    tag: ScenarioTag;
    duration?: number;
    parentId?: string;
  }) => void;

  /** 删除任务（任意状态均可删除） */
  removeTask: (taskId: string) => void;

  /** 更新任务基础信息（标题 / 标签 / 时长） */
  updateTask: (
    taskId: string,
    patch: Partial<
      Pick<
        Task,
        | "title"
        | "tag"
        | "duration"
        | "type"
        | "status"
        | "isDone"
        | "isUnfinished"
        | "isMissedFocus"
        | "completedAt"
        | "startedAt"
        | "scheduledDate"
        | "scheduledTime"
      >
    >
  ) => void;
  movePoolTask: (activeTaskId: string, overTaskId: string) => void;
  rescheduleTask: (
    taskId: string,
    scheduledDate: string,
    scheduledTime: string
  ) => void;
  cleanupExpiredTasks: () => void;

  // ── 状态机转换 ──────────────────────────────────────────────────────────

  /**
   * unscheduled → scheduled
   * 用户将任务拖拽到时间轴上时调用
   */
  scheduleTask: (
    taskId: string,
    scheduledDate: string,
    scheduledTime: string
  ) => void;

  /**
   * scheduled → unscheduled
   * 用户将任务从时间轴上移回任务池时调用
   */
  unscheduleTask: (taskId: string) => void;

  /**
   * scheduled → in_progress
   * 点击「开始专注」时调用；同一时刻只能有一个任务进行中
   */
  startTask: (taskId: string) => void;

  /**
   * in_progress → completed
   * 专注计时结束 / 用户手动完成时调用。
   * 结算：将任务快照写入 collection，activeTaskId 清空。
   */
  completeTask: (taskId: string) => void;

  /**
   * in_progress → unfinished
   * 用户跳过 / 中途放弃时调用。
   * 结算：任务弹回右侧面板，打上 isUnfinished 标签，activeTaskId 清空。
   */
  bounceTask: (taskId: string) => void;

  // ── 结算阶段 ──────────────────────────────────────────────────────────

  /**
   * 批量结算当天所有 in_progress 任务：
   *   - completed 的任务 → 飞入 collection
   *   - 仍是 in_progress 的任务 → 自动 bounce（标记 unfinished，弹回任务池）
   * 通常在日切换或手动触发「结算」时调用。
   */
  settleSession: () => void;

  /** 清空收集瓶（开始新的一天） */
  clearCollection: () => void;
}

// ---------------------------------------------------------------------------
// Derived selectors（工厂函数，组件内按需调用）
// ---------------------------------------------------------------------------

export const taskSelectors = {
  /** 右侧任务池：unscheduled 或 unfinished 的任务 */
  poolTasks: (state: TaskState) =>
    state.tasks.filter((t) => t.status === "unscheduled"),

  /** 时间轴上的任务：scheduled 或 in_progress */
  scheduledTasks: (state: TaskState) =>
    state.tasks.filter(
      (t) =>
        t.status === "scheduled" ||
        t.status === "in_progress" ||
        t.status === "completed"
    ),

  /** 已完成任务 */
  completedTasks: (state: TaskState) =>
    state.tasks.filter((t) => t.status === "completed"),

  /** 当前进行中的任务实体 */
  activeTask: (state: TaskState) =>
    state.tasks.find(
      (t) => t.id === state.activeTaskId && t.status === "in_progress"
    ) ?? null,
};

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

type TaskStore = TaskState & TaskActions;

const pad2 = (value: number) => String(value).padStart(2, "0");
const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const now = new Date();
const todayKey = toLocalDateKey(now);
const currentMinutes = now.getHours() * 60 + now.getMinutes();
const timeFromNowOffset = (offsetMinutes: number) => {
  const minutes = Math.max(0, Math.min(1439, currentMinutes + offsetMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
};

// 使用固定 ID 和时间戳，避免 SSR 与客户端模块加载时 nanoid/Date.now 产生不同值导致 hydration 不匹配
const INITIAL_DEMO_TASKS: Task[] = [
  {
    id: "demo-1",
    title: "番茄专注：整理今天最重要的三件事",
    type: "focus",
    tag: "工作",
    duration: 25,
    status: "scheduled",
    scheduledDate: todayKey,
    scheduledTime: timeFromNowOffset(3),
    createdAt: Date.now(),
  },
  {
    id: "demo-2",
    title: "深度学习章节精读",
    type: "focus",
    tag: "学习",
    duration: 35,
    status: "scheduled",
    scheduledDate: todayKey,
    scheduledTime: timeFromNowOffset(30),
    createdAt: Date.now(),
  },
  {
    id: "demo-3",
    title: "复盘与写作冲刺",
    type: "focus",
    tag: "工作",
    duration: 20,
    status: "scheduled",
    scheduledDate: todayKey,
    scheduledTime: timeFromNowOffset(70),
    createdAt: Date.now(),
  },
  {
    id: "demo-4",
    title: "错过示例：晨间英语听力",
    type: "focus",
    tag: "生活",
    duration: 20,
    status: "scheduled",
    scheduledDate: todayKey,
    scheduledTime: timeFromNowOffset(-50),
    isMissedFocus: true,
    createdAt: Date.now(),
  },
  {
    id: "demo-5",
    title: "喝水休息",
    type: "focus",
    tag: "生活",
    duration: 10,
    status: "unscheduled",
    scheduledTime:timeFromNowOffset(-100),
    createdAt: Date.now(),
  },
];
export const useTaskStore = create<TaskStore>()(
  devtools(
    persist(
      immer((set) => ({
      // ── Initial state ──────────────────────────────────────────────────

      tasks: INITIAL_DEMO_TASKS,
      collection: [],
      activeTaskId: null,

      // ── Task CRUD ──────────────────────────────────────────────────────

      addTask: ({ title, tag, duration = 25, parentId }) =>
        set(
          (state) => {
            state.tasks.push({
              id: nanoid(),
              title,
              type: "todo",
              tag,
              duration,
              status: "unscheduled",
              createdAt: Date.now(),
              parentId,
            });
          },
          false,
          "addTask"
        ),

      removeTask: (taskId) =>
        set(
          (state) => {
            const idx = state.tasks.findIndex((t) => t.id === taskId);
            if (idx !== -1) {
              state.tasks.splice(idx, 1);
              if (state.activeTaskId === taskId) state.activeTaskId = null;
            }
          },
          false,
          "removeTask"
        ),

      updateTask: (taskId, patch) =>
        set(
          (state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task) {
              const wasCompleted = task.status === "completed";
              Object.assign(task, patch);
              if (!wasCompleted && patch.status === "completed") {
                playSound("finish");
                
                // If this is a subtask, check if all siblings are now completed
                if (task.parentId) {
                   const siblings = state.tasks.filter(t => t.parentId === task.parentId);
                   const allCompleted = siblings.length > 0 && siblings.every(t => t.status === "completed");
                   if (allCompleted) {
                       const parentTask = state.tasks.find(t => t.id === task.parentId);
                       if (parentTask && parentTask.status !== "completed") {
                           parentTask.status = "completed";
                           parentTask.completedAt = Date.now();
                           parentTask.isDone = true;
                           parentTask.isUnfinished = false;
                       }
                   }
                }
              }
            }
          },
          false,
          "updateTask"
        ),

      movePoolTask: (activeTaskId, overTaskId) =>
        set(
          (state) => {
            if (activeTaskId === overTaskId) return;
            const poolIndexes: number[] = [];
            state.tasks.forEach((task, index) => {
              if (task.status === "unscheduled" || task.status === "unfinished") {
                poolIndexes.push(index);
              }
            });
            const poolTasks = poolIndexes.map((index) => state.tasks[index]);
            const fromIndex = poolTasks.findIndex((task) => task.id === activeTaskId);
            const toIndex = poolTasks.findIndex((task) => task.id === overTaskId);
            if (fromIndex === -1 || toIndex === -1) return;
            const [movedTask] = poolTasks.splice(fromIndex, 1);
            poolTasks.splice(toIndex, 0, movedTask);
            poolIndexes.forEach((stateIndex, poolIndex) => {
              state.tasks[stateIndex] = poolTasks[poolIndex];
            });
          },
          false,
          "movePoolTask"
        ),

      rescheduleTask: (taskId, scheduledDate, scheduledTime) =>
        set(
          (state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task && task.status === "scheduled") {
              task.scheduledDate = scheduledDate;
              task.scheduledTime = scheduledTime;
              task.isDone = false;
              task.isMissedFocus = false;
            }
          },
          false,
          "rescheduleTask"
        ),

      cleanupExpiredTasks: () =>
        set(
          (state) => {
            const now = Date.now();
            const todayKey = toLocalDateKey(new Date());
            state.tasks.forEach((task) => {
              if (task.status !== "scheduled") return;
              if (!task.scheduledDate || !task.scheduledTime) return;
              if (task.scheduledDate !== todayKey) return;
              const start = new Date(`${task.scheduledDate}T${task.scheduledTime}`);
              const end = new Date(start);
              end.setMinutes(end.getMinutes() + (task.duration || 25));
              if (end.getTime() <= now) {
                if (task.type === "focus") {
                  task.status = "scheduled";
                  task.isMissedFocus = true;
                } else {
                  task.status = "unscheduled";
                  task.type = "todo";
                  task.scheduledDate = undefined;
                  task.scheduledTime = undefined;
                }
                task.startedAt = undefined;
                task.completedAt = undefined;
                task.unfinishedAt = undefined;
                task.isUnfinished = false;
                task.isDone = false;
              }
            });
          },
          false,
          "cleanupExpiredTasks"
        ),

      // ── State machine ──────────────────────────────────────────────────

      scheduleTask: (taskId, scheduledDate, scheduledTime) =>
        set(
          (state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            // 允许从 unscheduled 或 unfinished 状态进入 scheduled
            if (
              task &&
              (task.status === "unscheduled" || task.status === "unfinished")
            ) {
              task.status = "scheduled";
              task.type = "focus";
              task.scheduledDate = scheduledDate;
              task.scheduledTime = scheduledTime;
              task.isDone = false;
              task.isUnfinished = false;
              task.isMissedFocus = false;
            }
          },
          false,
          "scheduleTask"
        ),

      unscheduleTask: (taskId) =>
        set(
          (state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task && task.status === "scheduled") {
              task.status = "unscheduled";
              task.scheduledDate = undefined;
              task.scheduledTime = undefined;
            }
          },
          false,
          "unscheduleTask"
        ),

      startTask: (taskId) =>
        set(
          (state) => {
            // 同一时刻只能有一个任务进行中：先暂停当前活跃任务（退回 scheduled）
            if (state.activeTaskId && state.activeTaskId !== taskId) {
              const current = state.tasks.find(
                (t) => t.id === state.activeTaskId
              );
              if (current && current.status === "in_progress") {
                current.status = "scheduled";
              }
            }

            const task = state.tasks.find((t) => t.id === taskId);
            if (task && task.status === "scheduled") {
              const now = new Date();
              const nowDate = toLocalDateKey(now);
              const nowTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
              task.status = "in_progress";
              task.startedAt = now.getTime();
              if (task.type === "focus") {
                task.scheduledDate = nowDate;
                task.scheduledTime = nowTime;
              }
              task.isMissedFocus = false;
              state.activeTaskId = taskId;
              playSound("begin");
            }
          },
          false,
          "startTask"
        ),

      completeTask: (taskId) =>
        set(
          (state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task && task.status === "in_progress") {
              task.status = "completed";
              task.completedAt = Date.now();
              task.isDone = true;
              task.isMissedFocus = false;
              playSound("finish");

              if (task.parentId) {
                const siblings = state.tasks.filter((t) => t.parentId === task.parentId);
                const allCompleted =
                  siblings.length > 0 && siblings.every((t) => t.status === "completed");
                if (allCompleted) {
                  const parentTask = state.tasks.find((t) => t.id === task.parentId);
                  if (parentTask && parentTask.status !== "completed") {
                    parentTask.status = "completed";
                    parentTask.completedAt = Date.now();
                    parentTask.isDone = true;
                    parentTask.isUnfinished = false;
                  }
                }
              }

              // 写入收集瓶
              state.collection.push({
                taskId: task.id,
                title: task.title,
                type: task.type,
                completedAt: task.completedAt,
                duration: task.duration,
              });

              if (state.activeTaskId === taskId) state.activeTaskId = null;
            }
          },
          false,
          "completeTask"
        ),

      bounceTask: (taskId) =>
        set(
          (state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task && task.status === "in_progress") {
              task.status = "scheduled";
              task.isUnfinished = false;
              task.isMissedFocus = true;
              task.unfinishedAt = Date.now();
              task.isDone = false;
              task.startedAt = undefined;

              if (state.activeTaskId === taskId) state.activeTaskId = null;
            }
          },
          false,
          "bounceTask"
        ),

      // ── Settlement ────────────────────────────────────────────────────

      settleSession: () =>
        set(
          (state) => {
            const now = Date.now();

            state.tasks.forEach((task) => {
              if (task.status === "in_progress") {
                task.status = "scheduled";
                task.isUnfinished = false;
                task.isMissedFocus = true;
                task.unfinishedAt = now;
                task.startedAt = undefined;
              }
            });

            state.activeTaskId = null;
          },
          false,
          "settleSession"
        ),

      clearCollection: () =>
        set(
          (state) => {
            state.collection = [];
          },
          false,
          "clearCollection"
        ),
      })),
      {
        name: "maoping-task-store",
        skipHydration: true,
        storage:
          typeof window !== "undefined"
            ? createJSONStorage(() => localStorage)
            : createJSONStorage(() => ({
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
              })),
        partialize: (s) => ({ tasks: s.tasks, collection: s.collection, activeTaskId: s.activeTaskId }),
      }
    ),
    { name: "TaskStore" }
  )
);
