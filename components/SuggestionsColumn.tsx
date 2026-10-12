"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSessionStore } from '@/lib/store';

export default function SuggestionsColumn() {
  const suggestions = useSessionStore(state => state.suggestions);
  const settings = useSessionStore(state => state.settings);
  const isRefreshing = useSessionStore(state => state.isRefreshing);
  const setIsRefreshing = useSessionStore(state => state.setIsRefreshing);
  
  const [countdown, setCountdown] = useState(30);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  useEffect(() => {
    const countdownInterval = setInterval(() => {
      if (countdown > 0 && !isRefreshing) {
        setCountdown(prev => prev - 1);
      } else if (countdown === 0 && !isRefreshing) {
        setCountdown(30);
        refreshSuggestions();
      }
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [countdown, isRefreshing]);

  const refreshSuggestions = async () => {
    const transcript = useSessionStore.getState().transcript;
    const masterSummary = useSessionStore.getState().masterSummary;
    if (!transcript || transcript.length === 0) return;

    setIsRefreshing(true);
    setCountdown(30);
    
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript, 
          masterSummary,
          systemPrompt: settings.suggestionPrompt,
          contextWindow: settings.suggestionContextWindow
        })
      });

      if (!response.ok) throw new Error('API Error');

      const data = await response.json();
      
      const newBatch = {
        batchId: Date.now(),
        createdAt: new Date().toISOString(),
        items: data.suggestions
      };
      
      useSessionStore.getState().addSuggestions(newBatch);
    } catch (e) {
      console.error('Failed to get suggestions', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClickSuggestion = async (text: string) => {
    const transcript = useSessionStore.getState().transcript;
    const masterSummary = useSessionStore.getState().masterSummary;
    const chatHistory = useSessionStore.getState().chat;

    useSessionStore.getState().addChatMessage({
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: text, 
          transcript, 
          masterSummary,
          chatHistory,
          systemPrompt: settings.chatPrompt,
          contextWindow: settings.chatContextWindow
        })
      });

      if (response.ok) {
        const data = await response.json();
        useSessionStore.getState().addChatMessage({
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
    } catch (e) {
      console.error('Failed to get chat response', e);
    }
  };

  const togglePiP = async () => {
    if (pipWindow) {
      pipWindow.close();
      return;
    }

    if (!('documentPictureInPicture' in window)) {
      alert("Picture-in-Picture is not supported in your browser (try Chrome/Edge on Desktop).");
      return;
    }

    try {
      const pip = await (window as any).documentPictureInPicture.requestWindow({
        width: 400,
        height: 700,
      });

      // Copy styles over so Tailwind works in the new window
      Array.from(document.styleSheets).forEach((styleSheet) => {
        try {
          const cssRules = Array.from(styleSheet.cssRules).map((rule) => rule.cssText).join('');
          const style = document.createElement('style');
          style.textContent = cssRules;
          pip.document.head.appendChild(style);
        } catch (e) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.type = styleSheet.type;
          link.media = styleSheet.media.mediaText;
          link.href = styleSheet.href!;
          pip.document.head.appendChild(link);
        }
      });

      // Dark mode body background
      pip.document.body.style.backgroundColor = '#0b0c10';
      pip.document.body.style.margin = '0';
      pip.document.body.style.height = '100vh';

      pip.addEventListener('pagehide', () => {
        setPipWindow(null);
      });

      setPipWindow(pip);
    } catch (error) {
      console.error(error);
    }
  };

  const content = (
    <div className={`bg-panel border border-main flex flex-col overflow-hidden ${pipWindow ? 'h-screen border-none rounded-none' : 'rounded-[10px] min-h-0 h-full'}`}>
      {/* Header */}
      <header className="px-3.5 py-2.5 border-b border-main text-[12px] uppercase tracking-[1px] text-muted flex justify-between items-center shrink-0">
        <span>2. Live Suggestions</span>
        <div className="flex items-center gap-3">
          <span>{suggestions.length === 1 ? '1 BATCH' : `${suggestions.length} BATCHES`}</span>
          <button 
            onClick={togglePiP} 
            className="text-accent hover:text-white transition-colors cursor-pointer ml-2"
            title="Pop out into floating window"
          >
            {pipWindow ? '↘ In PiP' : '↗ PiP'}
          </button>
        </div>
      </header>

      {/* Button Row */}
      <div className="px-3.5 py-2.5 border-b border-main flex gap-2 items-center shrink-0">
        <button 
          onClick={refreshSuggestions}
          disabled={isRefreshing}
          className="bg-panel-2 border border-main text-text px-3 py-1.5 rounded-md text-[12px] cursor-[pointer] hover:border-accent transition-colors flex items-center space-x-1"
        >
          <span className={`${isRefreshing ? 'animate-spin inline-block' : ''}`}>↻</span>
          <span>Reload suggestions</span>
        </button>
        <span className="text-[11px] text-muted ml-auto">auto-refresh in {countdown}s</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 custom-scrollbar flex flex-col">
        {/* Conditional Info Box */}
        {suggestions.length === 0 && (
          <div className="bg-accent/10 border border-accent/30 text-[#cfd3dc] p-2.5 text-[12px] rounded-md mx-3 mt-3 mb-2 leading-relaxed shrink-0">
            On reload (or auto every ~30s), generate <b className="font-bold text-white">3 fresh suggestions</b> from recent transcript context. New batch appears at the top; older batches push down (faded). Each is a tappable card: a <span className="text-accent">question to ask</span>, a <span className="text-accent-2">talking point</span>, an <span className="text-good">answer</span>, or a <span className="text-warn">fact-check</span>.
          </div>
        )}

        {/* Suggestions Area */}
        {suggestions.length === 0 ? (
          <div className="text-muted text-[13px] text-center px-2.5 py-7 leading-relaxed">
            Suggestions appear here once recording starts.
          </div>
        ) : (
          <div className="flex flex-col">
            {suggestions.map((batch, index) => (
              <div key={batch.batchId} className={`flex flex-col ${index !== 0 ? 'opacity-[0.55]' : ''}`}>
                <div className="flex flex-col">
                  {batch.items.map((item, itemIndex) => (
                    <div 
                      key={`${batch.batchId}-${itemIndex}`} 
                      onClick={() => handleClickSuggestion(item.text)}
                      className="border border-main bg-panel-2 rounded-lg p-3 mb-2.5 cursor-[pointer] hover:border-accent hover:-translate-y-px transition-all"
                    >
                      <span 
                        className={`inline-block text-[10px] uppercase tracking-[1px] px-1.5 py-0.5 rounded mr-auto mb-1.5
                          ${item.type === 'question' ? 'bg-accent/15 text-accent' : ''}
                          ${item.type === 'talking' ? 'bg-accent-2/15 text-accent-2' : ''}
                          ${item.type === 'answer' ? 'bg-good/15 text-good' : ''}
                          ${item.type === 'fact' ? 'bg-warn/15 text-warn' : ''}
                        `}
                      >
                        {item.type === 'question' ? 'Question To Ask' : 
                         item.type === 'talking' ? 'Talking Point' : 
                         item.type === 'answer' ? 'Answer' : 'Fact-Check'}
                      </span>
                      <div className="text-[14px] font-medium leading-[1.4] text-text">
                        {item.text}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Batch Divider */}
                <div className="text-[10px] text-muted text-center py-1.5 uppercase tracking-[1px] mb-2.5">
                  — Batch {suggestions.length - index} · {new Date(batch.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} —
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // If popped out, render into the pip window. Otherwise render inline.
  // We leave a placeholder inline so the layout doesn't completely collapse.
  if (pipWindow) {
    return (
      <div className="bg-panel border border-main rounded-[10px] flex items-center justify-center p-6 text-muted text-[13px] h-full text-center">
        <div>
          <p className="mb-3">Suggestions are running in Picture-in-Picture mode.</p>
          <button 
            onClick={togglePiP}
            className="text-accent border border-accent rounded px-3 py-1.5 hover:bg-accent hover:text-white transition-colors cursor-pointer"
          >
            Bring Back
          </button>
        </div>
        {createPortal(content, pipWindow.document.body)}
      </div>
    );
  }

  return content;
}
