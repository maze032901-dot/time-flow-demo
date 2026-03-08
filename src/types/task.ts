/**
 * 任务类型
 * focus: 专注任务（青蛙图标 / 橙色）
 * todo:  待办任务（水滴图标 / 蓝色）
 */
export type TaskType = "focus" | "todo";

/**
 * 场景标签
 */
export type ScenarioTag = "工作" | "学习" | "生活" | "其他";

/**
 * 任务生命周期状态机
 *
 * unscheduled  ──►  scheduled  ──►  in_progress  ──►  completed
 *      ▲                                    │
 *      └────────────────────────────────────┘
 *                  unfinished（弹回右侧面板，带"未完成"标签）
 */
export type TaskStatus =
  | "unscheduled"   // 未排期：在右侧任务池中
  | "scheduled"     // 已排期：已拖拽到时间轴，等待开始
  | "in_progress"   // 进行中：当前专注中
  | "completed"     // 已完成：飞入收集瓶
  | "unfinished";   // 未完成：弹回右侧面板，带"未完成"标签

/** 任务实体 */
export interface Task {
  id: string;
  title: string;
  type: TaskType;
  tag: ScenarioTag;
  /** 预计耗时（分钟），默认 25 */
  duration: number;
  status: TaskStatus;

  /** 排期到时间轴上的时间，格式 "HH:MM" */
  scheduledTime?: string;
  /** 排期到时间轴上的日期，格式 "YYYY-MM-DD" */
  scheduledDate?: string;

  /** 实际开始时间 */
  startedAt?: number;
  /** 实际完成时间 */
  completedAt?: number;
  /** 标记为未完成的时间 */
  unfinishedAt?: number;

  /** 是否已完成（用于锁定时间轴交互） */
  isDone?: boolean;

  /**
   * 未完成标签：true 表示该任务曾被标记为未完成并弹回任务池
   * 用于在右侧面板渲染"未完成"徽章
   */
  isUnfinished?: boolean;
  isMissedFocus?: boolean;

  /** 任务创建时间 */
  createdAt: number;
}

/** 收集瓶记录（结算完成的任务快照） */
export interface CollectedBottle {
  taskId: string;
  title: string;
  type: TaskType;
  completedAt: number;
  duration: number;
}
