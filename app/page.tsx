import TranscriptColumn from '@/components/TranscriptColumn';
import SuggestionsColumn from '@/components/SuggestionsColumn';
import ChatColumn from '@/components/ChatColumn';
import SessionHeader from '@/components/SessionHeader';
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function Home() {
  const cookieStore = cookies();
  const apiKey = cookieStore.get("groqApiKey");

  if (!apiKey) {
    redirect('/settings');
  }

  return (
    <div className="flex flex-col h-screen max-h-screen bg-bg text-text overflow-hidden">
      <SessionHeader />
      
      {/* 3-Column Layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 p-3 min-h-0 bg-bg">
        <TranscriptColumn />
        <SuggestionsColumn />
        <ChatColumn />
      </div>
    </div>
  );
}
