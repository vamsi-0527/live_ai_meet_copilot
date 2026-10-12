"use client";

import { useState, useEffect, useRef } from 'react';
import { useSessionStore } from '@/lib/store';

export default function ChatColumn() {
  const chat = useSessionStore(state => state.chat);
  const settings = useSessionStore(state => state.settings);
  const addChatMessage = useSessionStore(state => state.addChatMessage);
  
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const sendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage = {
      role: 'user' as const,
      content: inputValue,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    // Add user message to UI immediately
    useSessionStore.getState().addChatMessage(userMessage);
    
    const currentQuery = inputValue;
    setInputValue('');
    
    const transcript = useSessionStore.getState().transcript;
    const chatHistory = useSessionStore.getState().chat;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: currentQuery, 
          transcript, 
          chatHistory,
          systemPrompt: settings.chatPrompt,
          contextWindow: settings.chatContextWindow
        })
      });

      if (response.ok) {
        const data = await response.json();
        useSessionStore.getState().addChatMessage({
          role: 'assistant' as const,
          content: data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
    } catch (e) {
      console.error('Failed to get chat response:', e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="bg-panel border border-main rounded-[10px] flex flex-col overflow-hidden min-h-0">
      {/* Header */}
      <header className="px-3.5 py-2.5 border-b border-main text-[12px] uppercase tracking-[1px] text-muted flex justify-between items-center shrink-0">
        <span>3. Chat (detailed answers)</span>
        <span>session-only</span>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-3.5 custom-scrollbar flex flex-col">
        {/* Help Banner */}
        {chat.length === 0 && (
          <div className="bg-accent/10 border border-accent/30 text-[#cfd3dc] p-2.5 text-[12px] rounded-md mx-3 mt-3 mb-2 leading-relaxed shrink-0">
            Clicking a suggestion adds it to this chat and streams a detailed answer (separate prompt, more context). User can also type questions directly. One continuous chat per session — no login, no persistence.
          </div>
        )}

        {chat.length === 0 ? (
          <div className="text-muted text-[13px] text-center px-2.5 py-7 leading-relaxed">
            Click a suggestion or type a question below.
          </div>
        ) : (
          <div className="flex flex-col">
            {chat.map((message, index) => (
              <div 
                key={index} 
                className="mb-3.5"
              >
                <div className="text-[11px] text-muted uppercase tracking-[1px] mb-1">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div 
                  className={`border p-2.5 rounded-lg text-[13px] leading-[1.5]
                    ${message.role === 'user' 
                      ? 'bg-accent/10 border-accent/30 text-text' 
                      : 'bg-panel-2 border-main text-text'}`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Group */}
      <div className="p-2.5 border-t border-main flex gap-2 shrink-0">
        <input
          type="text"
          placeholder="Ask anything…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-panel-2 border border-main text-text px-2.5 py-2 rounded-md text-[13px] focus:outline-none focus:border-accent"
        />
        <button 
          onClick={sendMessage}
          disabled={!inputValue.trim()}
          className="bg-accent text-black border-none px-3.5 py-2 rounded-md cursor-[pointer] text-[13px] font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
