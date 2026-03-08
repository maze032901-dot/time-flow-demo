'use client';

import { useState, useEffect } from 'react';

export default function OnboardingGuide() {
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // 新增：加载状态

  useEffect(() => {
    const hasVisited = localStorage.getItem('meowtask_onboarding_complete');
    if (!hasVisited) {
      setShow(true);
    }
  }, []);

  const closeGuide = () => {
    localStorage.setItem('meowtask_onboarding_complete', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-[740px] bg-white p-5 rounded-3xl shadow-2xl mx-4">
        
        {/* 关闭按钮 */}
        <button 
          onClick={closeGuide}
          className="absolute -top-12 right-0 text-white text-sm hover:underline flex items-center gap-1"
        >
          <span>朕知道了，开始自律 🐾</span>
        </button>

        {/* 视频容器 */}
        <div className="relative h-[400px] overflow-hidden rounded-xl bg-gray-50 border border-gray-100 shadow-inner">
          
          {/* 加载中的占位效果 (Skeleton) */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 animate-pulse">
              <div className="text-4xl mb-4">🐾</div>
              <div className="text-gray-400 text-sm">正在呼唤猫爪教程，请稍候...</div>
              {/* 这里可以加一个简单的进度条 */}
              <div className="w-48 h-1.5 bg-gray-200 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-orange-400 animate-[loading_2s_ease-in-out_infinite]"></div>
              </div>
            </div>
          )}

          {/* Guidde 视频嵌入 */}
          <iframe 
            className={`w-full h-full transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            src="https://embed.app.guidde.com/playbooks/jNTJKRCWagaUXPyTXDLTM5?mode=videoOnly" 
            title="Create And Manage Focused Study Tasks In Meowtask" 
            frameBorder="0" 
            onLoad={() => setIsLoading(false)} // 关键：加载完成后关闭 Loading
            referrerPolicy="unsafe-url" 
            allowFullScreen={true} 
            allow="clipboard-write" 
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-forms allow-same-origin allow-presentation" 
            style={{ borderRadius: '10px' }}
          ></iframe>
        </div>

        <div className="mt-4 text-center">
          <h3 className="text-lg font-bold text-gray-800">快速上手：如何和猫爪一起专注？</h3>
          <p className="text-sm text-gray-500 mt-1">第一次见面，花 1 分钟看看我是如何帮你管理时间的吧 ~</p>
        </div>
      </div>

      {/* 定义简单的 CSS 动画 */}
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}