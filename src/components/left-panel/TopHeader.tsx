"use client";

import { ChevronLeft, ChevronRight, CalendarDays, ZoomIn, ZoomOut } from "lucide-react";

const DAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatDate(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    weekday: DAYS[date.getDay()],
  };
}

export default function TopHeader({
  zoom,
  onZoomChange,
  currentDate,
  onDateChange,
}: {
  zoom: number;
  onZoomChange: (next: number) => void;
  currentDate: Date;
  onDateChange: (next: Date) => void;
}) {
  const { year, month, day, weekday } = formatDate(currentDate);

  const goToPrev = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    onDateChange(d);
  };

  const goToNext = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    onDateChange(d);
  };

  const goToToday = () => onDateChange(new Date());

  const isToday =
    new Date().toDateString() === currentDate.toDateString();

  return (
    <header
      className="flex items-center justify-between px-6 border-b shrink-0"
      style={{
        height: "var(--header-height)",
        borderColor: "var(--border-color)",
        backgroundColor: "var(--panel-bg)",
      }}
    >
      {/* Date display */}
      <div className="flex items-center gap-3">
        <CalendarDays size={18} className="text-indigo-400" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-semibold tracking-tight">
            {month}月{day}日
          </span>
          <span
            className="text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            周{weekday}
          </span>
          <span
            className="text-xs ml-1"
            style={{ color: "var(--text-muted)" }}
          >
            {year}
          </span>
        </div>
        {isToday && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-500">
            今天
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onZoomChange(zoom - 0.15)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Zoom out timeline"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => onZoomChange(1)}
            className="text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium"
            style={{
              color: "var(--text-secondary)",
              backgroundColor: Math.abs(zoom - 1) < 0.01 ? "var(--accent-light)" : "transparent",
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => onZoomChange(zoom + 0.15)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Zoom in timeline"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1">
        <button
          onClick={goToToday}
          className="text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
          style={{
            color: "var(--text-secondary)",
            backgroundColor: isToday ? "var(--accent-light)" : "transparent",
          }}
        >
          今天
        </button>
        <button
          onClick={goToPrev}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={goToNext}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronRight size={16} />
        </button>
        </div>
      </div>
    </header>
  );
}
