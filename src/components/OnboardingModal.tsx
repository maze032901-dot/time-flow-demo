'use client';

import { useState, useEffect } from 'react';

export default function OnboardingGuide() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 检查浏览器缓存，看用户是否已经“打过卡”了
    const hasVisited = localStorage.getItem('meowtask_onboarding_complete');
    if (!hasVisited) {
      setShow(true);
    }
  }, []);

  const closeGuide = () => {
    // 点击关闭后，记在心里，下次刷新就不弹了
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

        {/* 你的 Guidde 视频嵌入 */}
        <div className="relative overflow-hidden rounded-xl bg-gray-100 flex justify-center">
          <iframe 
            width="100%" 
            height="400px" 
            src="https://embed.app.guidde.com/playbooks/jNTJKRCWagaUXPyTXDLTM5?mode=videoOnly" 
            title="Create And Manage Focused Study Tasks In Meowtask" 
            frameBorder="0" 
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
    </div>
  );
}