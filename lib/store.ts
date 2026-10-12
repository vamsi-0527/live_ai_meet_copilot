import { create } from 'zustand';

export type TranscriptEntry = {
  timestamp: string;
  text: string;
  speaker?: 'You' | 'Meeting';
};

export type SuggestionItem = {
  type: 'question' | 'talking' | 'answer' | 'fact';
  text: string;
};

export type SuggestionBatch = {
  batchId: number;
  createdAt: string;
  items: SuggestionItem[];
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export type SessionState = {
  transcript: TranscriptEntry[];
  suggestions: SuggestionBatch[];
  chat: ChatMessage[];
  masterSummary: string;
  isRecording: boolean;
  isRefreshing: boolean;
  settings: {
    suggestionPrompt: string;
    chatPrompt: string;
    suggestionContextWindow: number;
    chatContextWindow: number;
    customVocabulary: string;
  };
};

// Actions
export type SessionActions = {
  addTranscript: (entry: TranscriptEntry) => void;
  addSuggestions: (batch: SuggestionBatch) => void;
  addChatMessage: (message: ChatMessage) => void;
  updateMasterSummary: (summary: string) => void;
  clearSession: () => void;
  setIsRecording: (val: boolean) => void;
  setIsRefreshing: (val: boolean) => void;
  updateSettings: (settings: Partial<SessionState['settings']>) => void;
};

const DEFAULT_SUGGESTION_PROMPT = `You are an expert AI meeting copilot. 
Your job is to read the live transcript of a meeting and generate exactly 3 highly relevant suggestions.
The suggestions must be based ONLY on the provided transcript.
You MUST output your response in JSON format exactly matching this schema:
{
  "suggestions": [
    { "type": "question" | "talking" | "answer" | "fact", "text": "The suggestion text..." }
  ]
}

- "question": A insightful question the user should ask right now based on what was just said.
- "talking": A relevant talking point to push the conversation forward.
- "answer": A factual answer to a question someone just asked in the transcript.
- "fact": A relevant fact-check or piece of context to support exactly what was just said.

Generate exactly 3 suggestions that provide the highest value to the user.`;

const DEFAULT_CHAT_PROMPT = `You are an expert AI meeting copilot assisting a user during a live meeting.
Your job is to answer the user's questions or expand on their talking points based entirely on the Live Transcript context.

Instructions:
1. Answer concisely but provide deep, actionable insight.
2. If the user asks a question, answer it directly using context from the transcript.
3. If the user clicks a suggestion, expand on that suggestion with detailed reasoning based heavily on the transcript.
4. If there is no relevant information in the transcript to answer the question, logically deduce the answer or state that the topic hasn't been covered yet.`;

export const useSessionStore = create<SessionState & SessionActions>((set) => ({
  transcript: [],
  suggestions: [],
  chat: [],
  masterSummary: "",
  isRecording: false,
  isRefreshing: false,
  settings: {
    suggestionPrompt: DEFAULT_SUGGESTION_PROMPT,
    chatPrompt: DEFAULT_CHAT_PROMPT,
    suggestionContextWindow: 10,
    chatContextWindow: 20,
    customVocabulary: "",
  },
  addTranscript: (entry) =>
    set((state) => ({
      transcript: [...state.transcript, entry],
    })),
  addSuggestions: (batch) =>
    set((state) => ({
      suggestions: [batch, ...state.suggestions].slice(0, 5), // Keep only last 5 batches
    })),
  addChatMessage: (message) =>
    set((state) => ({
      chat: [...state.chat, message],
    })),
  updateMasterSummary: (summary) => set({ masterSummary: summary }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setIsRefreshing: (isRefreshing) => set({ isRefreshing }),
  updateSettings: (newSettings) => 
    set((state) => ({
      settings: { ...state.settings, ...newSettings }
    })),
  clearSession: () =>
    set({
      transcript: [],
      suggestions: [],
      chat: [],
      masterSummary: "",
      isRecording: false,
    }),
}));