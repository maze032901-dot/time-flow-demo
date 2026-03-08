"use client";

import { useEffect } from "react";
import { useTaskStore } from "@/store/useTaskStore";

/** 在 React  hydration 完成后手动从 localStorage 恢复 store，避免 SSR 与客户端初始渲染不一致 */
export default function StoreHydration() {
  useEffect(() => {
    useTaskStore.persist.rehydrate();
  }, []);
  return null;
}
