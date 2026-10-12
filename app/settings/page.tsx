"use client";

import { useState, useEffect } from 'react';
import { saveApiKey } from '@/app/actions/apiKey';
import { useSessionStore } from '@/lib/store';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const settings = useSessionStore(state => state.settings);
  const updateSettings = useSessionStore(state => state.updateSettings);
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('API key cannot be empty');
      }

      if (apiKey.length < 20) {
        throw new Error('Invalid API key. Please check and try again.');
      }

      // Save prompts and windows to global store
      updateSettings(localSettings);

      // Securely store API key in HttpOnly cookie via Server Action
      await saveApiKey(apiKey);
      
      setStatus('success');
      
      // Redirect to home after a short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">Live AI Copilot</h1>
          <div className="max-w-2xl mx-auto space-y-2">
            <p className="text-muted text-sm leading-relaxed">
              To ensure maximum privacy and project sustainability, TwinMind uses a <span className="text-accent font-medium">Bring Your Own Key (BYOK)</span> model. 
              Your Groq API key is stored locally in a secure, encrypted cookie and is never sent to our servers.
            </p>
            <p className="text-muted text-xs leading-relaxed italic">
              Use the configuration below to tune the AI&apos;s behavior. You can adjust how much context the AI remembers and modify the internal prompts to better suit your specific meeting style.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* API Key Section */}
          <section className="bg-panel border border-main rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold border-b border-main pb-2">1. Authentication</h2>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Groq API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2.5 rounded bg-panel-2 border border-main text-sm focus:outline-none focus:border-accent transition-colors"
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground/60 italic">Stored as an HttpOnly secure cookie. Never exposed to client-side scripts.</p>
            </div>
          </section>

          {/* Prompts Section */}
          <section className="bg-panel border border-main rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-semibold border-b border-main pb-2">2. AI Prompts & Context</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Context Windows */}
               <div className="space-y-2">
                <label className="block text-sm font-medium text-muted">Suggestion Context (Batches)</label>
                <input
                  type="number"
                  value={localSettings.suggestionContextWindow}
                  onChange={(e) => setLocalSettings({...localSettings, suggestionContextWindow: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 rounded bg-panel-2 border border-main text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted">Chat Context (History Lines)</label>
                <input
                  type="number"
                  value={localSettings.chatContextWindow}
                  onChange={(e) => setLocalSettings({...localSettings, chatContextWindow: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 rounded bg-panel-2 border border-main text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Live Suggestion System Prompt</label>
              <textarea
                value={localSettings.suggestionPrompt}
                onChange={(e) => setLocalSettings({...localSettings, suggestionPrompt: e.target.value})}
                rows={6}
                className="w-full px-3 py-2 rounded bg-panel-2 border border-main text-[13px] font-mono focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Detailed Chat Answer Prompt</label>
              <textarea
                value={localSettings.chatPrompt}
                onChange={(e) => setLocalSettings({...localSettings, chatPrompt: e.target.value})}
                rows={6}
                className="w-full px-3 py-2 rounded bg-panel-2 border border-main text-[13px] font-mono focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </section>
          
          {status === 'error' && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-sm text-danger text-center">
              {errorMessage}
            </div>
          )}
          
          {status === 'success' && (
            <div className="bg-good/10 border border-good/30 rounded-lg p-4 text-sm text-good text-center">
              Configuration saved successfully! Syncing to session...
            </div>
          )}
          
          <button
            type="submit"
            disabled={status === 'loading'}
            className={`w-full bg-accent text-black font-bold py-3 rounded-xl transition-all shadow-lg hover:scale-[1.01] active:scale-[0.99]
              ${status === 'loading' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent/90'}`}
          >
            {status === 'loading' ? 'Applying Settings...' : 'Save & Start Session'}
          </button>
        </form>
        
        <div className="text-center text-xs text-muted">
          <p>Get your API key from <a href="https://console.groq.com/keys" className="underline hover:text-accent transition-colors" target="_blank" rel="noopener noreferrer">Groq Console</a></p>
        </div>
      </div>
    </div>
  );
}