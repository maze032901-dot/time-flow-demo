"use client";

import React, { useState } from "react";
import { X, Sparkles, RefreshCw, Send, Lock, Unlock, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useTaskStore, taskSelectors } from "@/store/useTaskStore";
import { useShallow } from "zustand/react/shallow";
import type { Task, ScenarioTag } from "@/types/task";

type SubTask = {
  id: string;
  title: string;
  sourceTitle: string;
  sourceTaskId: string;
};

export default function AiTaskDecompositionModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const poolTasks = useTaskStore(useShallow(taskSelectors.poolTasks));
  // Mock data for source tasks if pool is empty
  const mockTasks: Task[] = [
    {
      id: "mock1",
      title: "Trip to Japan",
      type: "todo",
      tag: "生活",
      duration: 120,
      status: "unscheduled",
      createdAt: Date.now(),
    },
    {
      id: "mock2",
      title: "Q2 Product Launch",
      type: "todo",
      tag: "工作",
      duration: 240,
      status: "unscheduled",
      createdAt: Date.now(),
    },
    {
      id: "mock3",
      title: "Buy groceries",
      type: "todo",
      tag: "生活",
      duration: 30,
      status: "unscheduled",
      createdAt: Date.now(),
    },
  ];

  const displayTasks = poolTasks.length > 0 ? poolTasks : mockTasks;

  const [selectedSourceTasks, setSelectedSourceTasks] = useState<string[]>([]);
  const [unlockedAtomicTasks, setUnlockedAtomicTasks] = useState<string[]>([]);

  // Split into complex (can be decomposed) and atomic
  const complexTasks = displayTasks.filter((t) => t.duration > 60 || ["Trip to Japan", "Q2 Product Launch", "Research flights"].some(k => t.title.includes(k)) || unlockedAtomicTasks.includes(t.id));
  const atomicTasks = displayTasks.filter((t) => !complexTasks.includes(t));

  // Lab State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSubTasks, setGeneratedSubTasks] = useState<SubTask[]>([]);
  const [selectedSubTaskIds, setSelectedSubTaskIds] = useState<string[]>([]);
  const [currentSourceTaskIndex, setCurrentSourceTaskIndex] = useState(0);

  const toggleSourceTask = (id: string) => {
    setSelectedSourceTasks((prev) => {
      const isSelecting = !prev.includes(id);
      const newSelection = isSelecting ? [...prev, id].slice(-3) : prev.filter((tId) => tId !== id);
      
      // Ensure index is within bounds of new selection
      if (currentSourceTaskIndex >= newSelection.length) {
         setCurrentSourceTaskIndex(Math.max(0, newSelection.length - 1));
      }
      return newSelection;
    });
  };

  const toggleAtomicLock = (id: string) => {
    setUnlockedAtomicTasks((prev) =>
      prev.includes(id) ? prev.filter((tId) => tId !== id) : [...prev, id]
    );
  };

  const handleGenerate = () => {
    if (selectedSourceTasks.length === 0) return;
    setIsGenerating(true);
    setGeneratedSubTasks([]);
    setSelectedSubTaskIds([]);
    setCurrentSourceTaskIndex(0);
    
    setTimeout(() => {
      const mockResults: SubTask[] = [];
      
      selectedSourceTasks.forEach((taskId, index) => {
          const sourceTitle = displayTasks.find(t => t.id === taskId)?.title || "Task";
          // Generate slightly different mock tasks based on index to differentiate
          mockResults.push(
            { id: `sub1-${taskId}`, title: `Step 1: Research & Planning`, sourceTitle, sourceTaskId: taskId },
            { id: `sub2-${taskId}`, title: `Step 2: Resource Allocation`, sourceTitle, sourceTaskId: taskId },
            { id: `sub3-${taskId}`, title: `Step 3: Execution phase`, sourceTitle, sourceTaskId: taskId },
            { id: `sub4-${taskId}`, title: `Step 4: Review and Finalize`, sourceTitle, sourceTaskId: taskId },
          );
      });

      setGeneratedSubTasks(mockResults);
      setSelectedSubTaskIds([]); // Unselected by default
      setIsGenerating(false);
    }, 1500);
  };

  const handleToggleSubTask = (id: string) => {
    setSelectedSubTaskIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const updateGeneratedSubTask = (id: string, newTitle: string) => {
    setGeneratedSubTasks(prev => prev.map(t => t.id === id ? { ...t, title: newTitle } : t));
  };

  const addTask = useTaskStore((s) => s.addTask);

  const handleCommit = () => {
    if (selectedSubTaskIds.length === 0) return;
    
    const tasksToCommit = generatedSubTasks.filter(t => selectedSubTaskIds.includes(t.id));
    
    tasksToCommit.forEach(t => {
      const sourceTask = displayTasks.find(src => src.id === t.sourceTaskId);
      addTask({
        title: t.title,
        tag: sourceTask?.tag || "工作",
        duration: 25,
        parentId: t.sourceTaskId,
      });
    });
    
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-[1200px] h-[669px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex-none h-[77px] border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl">
              <Sparkles size={20} strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-gray-900 font-bold text-base leading-tight">
                AI Task Decomposition
              </h1>
              <p className="text-gray-400 text-xs leading-none mt-1">
                Break complex tasks into actionable steps
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg">
              <span className="text-gray-500 text-xs font-medium">AI Active</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 flex min-h-0 bg-white">
          {/* Left Panel: Source Tasks */}
          <div className="w-[368px] flex flex-col border-r border-gray-100 shrink-0">
            <div className="p-6 pb-2 flex-none">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-bold text-sm text-gray-400">Source Tasks</h2>
                <span className="bg-gray-100 text-gray-400 text-[11px] font-medium px-2 py-0.5 rounded-full">
                  {displayTasks.length}
                </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
              <div className="space-y-3">
                {complexTasks.map((task) => (
                  <SourceTaskCard
                    key={task.id}
                    task={task}
                    selected={selectedSourceTasks.includes(task.id)}
                    onClick={() => toggleSourceTask(task.id)}
                  />
                ))}

                {atomicTasks.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 my-6">
                      <div className="h-px bg-gray-200 flex-1"></div>
                      <span className="text-[11px] text-gray-400 font-medium lowercase">atomic</span>
                      <div className="h-px bg-gray-200 flex-1"></div>
                    </div>

                    {atomicTasks.map((task) => {
                      const isUnlocked = unlockedAtomicTasks.includes(task.id);
                      return (
                        <div key={task.id} className="relative group">
                          <SourceTaskCard
                            task={task}
                            selected={selectedSourceTasks.includes(task.id)}
                            onClick={() => {
                              if (isUnlocked) toggleSourceTask(task.id);
                            }}
                            disabled={!isUnlocked}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAtomicLock(task.id);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title={isUnlocked ? "Lock task" : "Unlock to decompose"}
                          >
                            {isUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
            
            {/* Footer Hint */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 mt-auto flex-none">
              <p className="text-xs text-gray-400 leading-relaxed pl-2 relative">
                <span className="absolute left-0 top-1.5 w-1 h-1 bg-indigo-300 rounded-full"></span>
                AI-eligible tasks can be broken down into sub-tasks automatically.
              </p>
            </div>
          </div>

          {/* Middle Panel: AI Lab */}
          <div className="w-[442px] flex flex-col border-r border-gray-100 shrink-0 bg-[#fafafa]/30">
            <div className="p-6 pb-4 flex items-center justify-between flex-none border-b border-gray-100/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-indigo-50 text-indigo-500 rounded-lg flex items-center justify-center">
                   <Sparkles size={14} />
                </div>
                <h2 className="font-bold text-[13px] text-gray-500 tracking-wide uppercase">AI Lab</h2>
                {selectedSourceTasks.length > 0 && (
                   <div className="ml-2 bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide">
                       Version A
                   </div>
                )}
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors">
                <RefreshCw size={12} />
                Regenerate
              </button>
            </div>

            {/* Carousel Controller */}
            {selectedSourceTasks.length > 0 && (
               <div className="px-6 py-4 flex items-center justify-between flex-none">
                  <button 
                     disabled={currentSourceTaskIndex === 0}
                     onClick={() => setCurrentSourceTaskIndex(prev => Math.max(0, prev - 1))}
                     className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  >
                     <ChevronLeft size={16} />
                  </button>

                  <div className="flex items-center gap-2">
                     {selectedSourceTasks.map((_, idx) => (
                        <div 
                           key={idx}
                           className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSourceTaskIndex ? "w-6 bg-indigo-500" : "w-1.5 bg-gray-200"}`}
                        />
                     ))}
                  </div>

                  <div className="flex items-center gap-3">
                     <button 
                         disabled={currentSourceTaskIndex === selectedSourceTasks.length - 1}
                         onClick={() => setCurrentSourceTaskIndex(prev => Math.min(selectedSourceTasks.length - 1, prev + 1))}
                         className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                     >
                        <ChevronRight size={16} />
                     </button>
                     <span className="text-xs font-medium text-gray-400 min-w-[20px]">{currentSourceTaskIndex + 1}/{selectedSourceTasks.length}</span>
                  </div>
               </div>
            )}

            {/* Target Breakdown Header Card */}
            {selectedSourceTasks.length > 0 && (
              <div className="px-6 mb-4 flex-none">
                <div className="bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-100/60 rounded-xl p-5 flex flex-col gap-1.5 shadow-sm transition-all">
                  <div className="flex items-center gap-2">
                    {isGenerating ? (
                      <RefreshCw size={18} className="animate-spin text-indigo-500" />
                    ) : (
                      <span className="text-lg">✨</span>
                    )}
                    <span className="font-bold text-sm text-indigo-900">
                      {displayTasks.find(t => t.id === selectedSourceTasks[currentSourceTaskIndex])?.title || "Selected Task"}
                    </span>
                  </div>
                  <span className="text-xs text-indigo-500/80 font-medium pl-7">
                    {isGenerating ? "Analyzing intent and generating steps..." : 
                     generatedSubTasks.length > 0 ? `Decomposed into ${generatedSubTasks.filter(t => t.sourceTaskId === selectedSourceTasks[currentSourceTaskIndex]).length} actionable sub-tasks` : 
                     "Ready for decomposition"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 pb-[20px] custom-scrollbar flex flex-col items-center justify-start relative pt-2">
               {!isGenerating && generatedSubTasks.length === 0 ? (
                  <div className="text-gray-300 text-sm flex flex-col items-center justify-center h-full gap-3 pb-10">
                     <Sparkles size={32} strokeWidth={1.5} className="text-indigo-200" />
                     {selectedSourceTasks.length > 0 ? "Click 'AI Breakdown' to generate steps" : "Select tasks from the left panel"}
                  </div>
               ) : (
                 <div className="w-full h-full flex flex-col gap-3 justify-start relative">
                    {generatedSubTasks
                      .filter(t => t.sourceTaskId === selectedSourceTasks[currentSourceTaskIndex])
                      .map((subTask, i) => (
                      <div 
                         key={subTask.id}
                         className="flex items-start gap-3 transition-all animate-in fade-in slide-in-from-top-4 py-1"
                         style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
                      >
                         <button 
                           onClick={() => handleToggleSubTask(subTask.id)}
                           className={`w-[18px] h-[18px] mt-0.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${
                              selectedSubTaskIds.includes(subTask.id) 
                              ? "bg-indigo-500 border-indigo-500 text-white" 
                              : "border-gray-300 text-transparent hover:border-indigo-300"
                           }`}
                         >
                            <Check size={12} strokeWidth={3} />
                         </button>
                         <span className={`text-[13px] font-medium flex-1 leading-relaxed ${selectedSubTaskIds.includes(subTask.id) ? "text-gray-400 line-through" : "text-gray-700"}`}>
                            {subTask.title}
                         </span>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          </div>

          {/* Right Panel: Staging Area */}
          <div className="flex-1 flex flex-col bg-white">
            <div className="p-6 pb-2 flex items-center gap-2 flex-none">
                <div className="w-7 h-7 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                   <Check size={14} strokeWidth={3} />
                </div>
                <h2 className="font-bold text-sm text-gray-400">Staging Area</h2>
                <div className="ml-auto bg-emerald-50 text-emerald-500 px-2.5 py-1 rounded-full text-[10px] font-bold">
                    {selectedSubTaskIds.length} ready
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2 custom-scrollbar flex flex-col relative">
                {selectedSubTaskIds.length === 0 ? (
                   <div className="flex-1 flex flex-col items-center justify-center text-gray-300 text-sm gap-3">
                      <div className="w-12 h-12 rounded-full border border-dashed border-gray-200 flex items-center justify-center">
                          <Check size={20} className="text-gray-200" />
                      </div>
                      Check tasks in AI Lab to stage here
                   </div>
                ) : (
                   <div className="flex flex-col gap-2">
                      {generatedSubTasks.filter(t => selectedSubTaskIds.includes(t.id)).map((task, i) => (
                         <div 
                           key={`${task.id}-${i}`}
                           className="bg-emerald-50/50 border border-emerald-100/50 rounded-xl p-3 flex gap-3 animate-in fade-in zoom-in-95 duration-200"
                         >
                            <Sparkles size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                               <input 
                                 type="text"
                                 value={task.title}
                                 onChange={(e) => updateGeneratedSubTask(task.id, e.target.value)}
                                 className="w-full text-[13px] text-gray-700 font-medium leading-snug bg-transparent outline-none border-b border-transparent focus:border-emerald-200 transition-colors py-0.5"
                               />
                               <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide px-0.5">
                                  from {task.sourceTitle}
                               </p>
                            </div>
                         </div>
                      ))}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                         <button 
                           onClick={handleCommit}
                           className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-medium text-[13px] py-2.5 rounded-xl transition-colors shadow-sm shadow-emerald-200 flex items-center justify-center gap-2"
                         >
                            Commit {selectedSubTaskIds.length} to Planner
                            <Check size={14} />
                         </button>
                      </div>
                   </div>
                )}
            </div>

            <div className="p-6 pt-4 border-t border-gray-100 flex flex-col gap-4 flex-none">
              <div className="flex items-center gap-2">
                 <button 
                   onClick={handleGenerate}
                   disabled={selectedSourceTasks.length === 0 || isGenerating}
                   className="px-3 py-1.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-full text-[11px] font-medium transition-colors"
                 >
                     AI Breakdown
                 </button>
                 <button className="px-3 py-1.5 border border-transparent hover:border-gray-200 hover:bg-gray-50 rounded-full text-[11px] text-gray-500 transition-colors">
                     Summarize
                 </button>
                 <button className="px-3 py-1.5 border border-transparent hover:border-gray-200 hover:bg-gray-50 rounded-full text-[11px] text-gray-500 transition-colors">
                     Prioritize
                 </button>
              </div>
              <div className="relative">
                 <textarea 
                   className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pr-10 text-sm text-gray-700 placeholder:text-gray-400 resize-none outline-none focus:border-indigo-300 focus:bg-white transition-colors h-[60px]"
                   placeholder="Ask AI to decompose, refine, or organize tasks..."
                   onKeyDown={(e) => {
                     if (e.key === "Enter" && !e.shiftKey) {
                       e.preventDefault();
                       handleGenerate();
                     }
                   }}
                 />
                 <button 
                   onClick={handleGenerate}
                   disabled={selectedSourceTasks.length === 0 || isGenerating}
                   className="absolute right-2 bottom-2 p-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 text-white rounded-lg transition-colors"
                 >
                    <Send size={14} />
                 </button>
              </div>
              <p className="text-[10px] text-gray-300 text-center">
                 AI will analyze and break down your tasks automatically
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function SourceTaskCard({
  task,
  selected,
  onClick,
  disabled = false,
}: {
  task: Task;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const getIcon = (tag: ScenarioTag) => {
    switch (tag) {
      case "工作":
        return "💻";
      case "学习":
        return "📖";
      case "生活":
        return "🏠";
      default:
        return "✨";
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all relative ${
        disabled
          ? "opacity-60 grayscale-[0.5] bg-gray-50 border-gray-100 cursor-not-allowed"
          : selected
          ? "bg-indigo-50/50 border-indigo-200 shadow-[0_0_0_1px_rgba(199,210,254,1)] ring-1 ring-indigo-200"
          : "bg-white border-gray-100 hover:border-indigo-100 hover:bg-gray-50 cursor-pointer shadow-sm hover:shadow"
      }`}
    >
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        <span className="text-lg">{task.title.includes("Japan") ? "✈️" : task.title.includes("Q2") ? "🚀" : task.title.includes("groceries") ? "🛒" : getIcon(task.tag)}</span>
      </div>
      <div className="flex-1 min-w-0 pr-6">
         <p className={`text-[13px] font-medium truncate ${selected ? "text-indigo-900" : "text-gray-700"}`}>
             {task.title}
         </p>
         <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
             {task.duration} mins • {task.tag}
         </p>
      </div>
      {/* If selected, we can show a slight tint indicator on the right side if wanted, but ring is enough */}
      {selected && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center">
             <Check size={10} strokeWidth={3} />
          </div>
      )}
    </button>
  );
}
