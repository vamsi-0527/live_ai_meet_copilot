"use client";

import { useState, useEffect, useRef } from 'react';
import { useSessionStore } from '@/lib/store';

export default function TranscriptColumn() {
  const transcript = useSessionStore(state => state.transcript);
  const masterSummary = useSessionStore(state => state.masterSummary);
  const updateMasterSummary = useSessionStore(state => state.updateMasterSummary);
  const isRecording = useSessionStore(state => state.isRecording);
  const setIsRecording = useSessionStore(state => state.setIsRecording);
  
  const micChunksRef = useRef<Blob[]>([]);
  const displayChunksRef = useRef<Blob[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  
  const [lastSummarizedCount, setLastSummarizedCount] = useState(0);

  // Auto-scroll transcript when updated
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Background Summarization Loop
  useEffect(() => {
    if (transcript.length - lastSummarizedCount >= 10) { // Summarize every 10 transcript entries
      const chunksToSummarize = transcript.slice(lastSummarizedCount);
      setLastSummarizedCount(transcript.length);
      
      const runSummarization = async () => {
        try {
          const response = await fetch('/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              transcript: chunksToSummarize,
              previousSummary: masterSummary 
            })
          });
          if (response.ok) {
            const data = await response.json();
            if (data.summary) {
              updateMasterSummary(data.summary);
            }
          }
        } catch (e) {
          console.error("Summarization failed", e);
        }
      };
      runSummarization();
    }
  }, [transcript, lastSummarizedCount, masterSummary, updateMasterSummary]);

  // Handle audio recording and transcription
  useEffect(() => {
    if (!isRecording) return;

    let micRecorder: MediaRecorder | null = null;
    let displayRecorder: MediaRecorder | null = null;
    let chunkInterval: NodeJS.Timeout | null = null;
    let micStream: MediaStream | null = null;
    let displayStream: MediaStream | null = null;

    const processStreamChunks = async (chunksArray: Blob[], speaker: 'You' | 'Meeting') => {
      if (chunksArray.length === 0) return;

      // Grab current chunks and clear array for next batch
      const chunksToSend = [...chunksArray];
      chunksArray.length = 0;

      const audioBlob = new Blob(chunksToSend, { type: 'audio/webm' });
      const reader = new FileReader();

      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        if (base64Audio) {
          try {
            // Get context for Whisper prompt
            const currentTranscript = useSessionStore.getState().transcript;
            const recentText = currentTranscript.slice(-5).map(t => t.text).join(" ");
            const recentWords = recentText.split(" ").slice(-50).join(" ");
            const customVocab = useSessionStore.getState().settings?.customVocabulary || "";
            const whisperPrompt = `${customVocab} ${recentWords}`.trim();

            const response = await fetch('/api/transcribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                audio: base64Audio,
                prompt: whisperPrompt 
              })
            });

            if (!response.ok) throw new Error(`Transcription failed: ${response.status}`);

            const { text } = await response.json();
            
            if (text && text.trim().length > 0) {
              const cleanedText = text.trim();
              // Whisper Hallucination Filter: Whisper hallucinates these phrases on silent/static audio
              const hallucinations = [
                "Thank you.", "Thank you", "Thank you for watching.", "Thanks for watching.", 
                "Thank you for everything.", "Thank you very much.", "Thanks.", "Thank you!"
              ];
              
              if (hallucinations.includes(cleanedText)) {
                console.log(`[VAD] Ignored Whisper hallucination: "${cleanedText}"`);
                return;
              }

              // Add to transcript store with speaker tag
              useSessionStore.getState().addTranscript({
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                text: cleanedText,
                speaker
              });
            }
          } catch (error) {
            console.error(`Transcription error for ${speaker}:`, error);
          }
        }
      };

      reader.readAsDataURL(audioBlob);
    };

    const startRecording = async () => {
      try {
        // 1. Get Microphone Audio
        micStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }, 
          video: false 
        });

        // 2. Get System/Tab Audio
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          },
        });

        // If the user didn't check "Share tab audio", displayStream might not have audio tracks!
        if (displayStream.getAudioTracks().length === 0) {
            alert("No audio track detected in the screen share. Did you remember to check 'Share tab audio'?");
            displayStream.getTracks().forEach(t => t.stop());
            micStream.getTracks().forEach(t => t.stop());
            setIsRecording(false);
            return;
        }

        // Setup Mic Recorder with High Fidelity Audio
        micRecorder = new MediaRecorder(micStream, { 
          mimeType: 'audio/webm',
          audioBitsPerSecond: 128000
        });
        micChunksRef.current = [];
        micRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) micChunksRef.current.push(event.data);
        };

        // Setup Display (Meeting) Recorder using only its audio track
        const displayAudioStream = new MediaStream(displayStream.getAudioTracks());
        displayRecorder = new MediaRecorder(displayAudioStream, { 
          mimeType: 'audio/webm',
          audioBitsPerSecond: 128000
        });
        displayChunksRef.current = [];
        displayRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) displayChunksRef.current.push(event.data);
        };

        let isManualStop = false;
        let recordingStartTimeMic = Date.now();
        let recordingStartTimeDisplay = Date.now();

        // Handle stop for Mic
        micRecorder.onstop = () => {
          processStreamChunks(micChunksRef.current, 'You');
          if (!isManualStop && micRecorder && micRecorder.state === 'inactive') {
            try { 
              micRecorder.start(); 
              recordingStartTimeMic = Date.now();
            } catch (e) { console.error(e); }
          }
        };

        // Handle stop for Display
        displayRecorder.onstop = () => {
          processStreamChunks(displayChunksRef.current, 'Meeting');
          if (!isManualStop && displayRecorder && displayRecorder.state === 'inactive') {
            try { 
              displayRecorder.start(); 
              recordingStartTimeDisplay = Date.now();
            } catch (e) { console.error(e); }
          }
        };

        // Start recording both
        micRecorder.start();
        displayRecorder.start();

        // -------------------------
        // NATIVE VAD IMPLEMENTATION
        // -------------------------
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const setupVAD = (
          stream: MediaStream, 
          recorder: MediaRecorder, 
          getRecordingStartTime: () => number,
          isSystem: boolean
        ) => {
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let silenceStart: number | null = null;
          let hasSpoken = false;
          let reqId: number;

          const checkVolume = () => {
            if (isManualStop) return;

            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            const average = sum / dataArray.length;

            // Bumped threshold to avoid triggering on static fan noise
            const THRESHOLD = isSystem ? 5 : 15; 
            const SILENCE_DURATION = 1500; // 1.5s
            const MAX_DURATION = 15000; // 15s max force-flush

            if (average > THRESHOLD) {
              silenceStart = null;
              hasSpoken = true;
            } else {
              if (silenceStart === null) {
                silenceStart = Date.now();
              } else if (Date.now() - silenceStart > SILENCE_DURATION) {
                // If silent for > 1.5s and they actually spoke something, flush it!
                if (hasSpoken && recorder.state === 'recording') {
                  recorder.stop();
                  hasSpoken = false;
                  silenceStart = null;
                }
              }
            }

            // Force flush if talking continuously for 15s
            if (hasSpoken && recorder.state === 'recording' && (Date.now() - getRecordingStartTime() > MAX_DURATION)) {
                recorder.stop();
                hasSpoken = false;
                silenceStart = null;
            }

            reqId = requestAnimationFrame(checkVolume);
          };

          checkVolume();
          return () => cancelAnimationFrame(reqId);
        };

        const cleanupMicVAD = setupVAD(micStream, micRecorder, () => recordingStartTimeMic, false);
        const cleanupDisplayVAD = setupVAD(displayAudioStream, displayRecorder, () => recordingStartTimeDisplay, true);

        // Save cleanup functions to be called on unmount
        (window as any)._vadCleanups = () => {
          isManualStop = true;
          cleanupMicVAD();
          cleanupDisplayVAD();
          audioCtx.close();
        };

      } catch (err) {
        console.error('Screen/Mic access error:', err);
        useSessionStore.getState().addTranscript({
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: 'Access denied or cancelled. Please make sure you share a tab and check "Share tab audio".'
        });
        setIsRecording(false);
      }
    };

    startRecording();

    return () => {
      // Cleanup on unmount or when recording stops
      if ((window as any)._vadCleanups) {
        (window as any)._vadCleanups();
        delete (window as any)._vadCleanups;
      }
      
      if (micRecorder) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        micRecorder.onstop = () => { processStreamChunks(micChunksRef.current, 'You'); }; 
        if (micRecorder.state !== 'inactive') micRecorder.stop();
      }
      if (displayRecorder) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        displayRecorder.onstop = () => { processStreamChunks(displayChunksRef.current, 'Meeting'); };
        if (displayRecorder.state !== 'inactive') displayRecorder.stop();
      }
      if (micStream) micStream.getTracks().forEach(track => track.stop());
      if (displayStream) displayStream.getTracks().forEach(track => track.stop());
    };
  }, [isRecording, setIsRecording]);

  const toggleRecording = async () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className="bg-panel border border-main rounded-[10px] flex flex-col overflow-hidden min-h-0">
      {/* Header */}
      <header className="px-3.5 py-2.5 border-b border-main text-[12px] uppercase tracking-[1px] text-muted flex justify-between items-center shrink-0">
        <span>1. Mic & Transcript</span>
        <span className="flex items-center">
          {isRecording ? <span className="w-1.5 h-1.5 rounded-full bg-danger mr-2"></span> : null}
          {isRecording ? 'RECORDING' : 'IDLE'}
        </span>
      </header>
      
      <div className="flex-1 overflow-y-auto p-3.5 custom-scrollbar flex flex-col">
        {/* Button Row */}
        <div className="flex items-center gap-[10px] pb-3.5 mb-3.5 border-b border-main shrink-0">
        <button 
          onClick={toggleRecording}
          className={`w-[44px] h-[44px] rounded-full border-none cursor-[pointer] flex items-center justify-center transition-colors shrink-0
            ${isRecording ? 'bg-danger text-white mic-recording' : 'bg-accent text-black hover:bg-accent/90'}`}
        >
          ●
        </button>
        <div className="text-[13px] text-muted">
          {isRecording 
            ? 'Listening... transcript updates every 15s.' 
            : 'Click mic to start. Transcript appends every ~15s.'}
        </div>
      </div>

      {/* Conditional Info Box */}
      {transcript.length === 0 && (
        <div className="bg-accent/10 border border-accent/30 text-[#cfd3dc] p-2.5 text-[12px] rounded-md mx-3 mt-3 mb-2 leading-relaxed shrink-0">
          The transcript scrolls and appends new chunks every ~15 seconds while recording. Use the mic button to start/stop. Include an export button (not shown) so we can pull the full session.
        </div>
      )}

      {/* Transcript Area */}
      <div className="flex-1 flex flex-col p-3.5">
        {transcript.length === 0 ? (
          <div className="text-muted text-[13px] text-center px-2.5 py-7 leading-relaxed">
            No transcript yet — start the mic.
          </div>
        ) : (
          <div className="flex flex-col">
            {transcript.map((entry, index) => (
              <div key={index} className="transcript-line-new text-[14px] leading-relaxed mb-2.5 text-[#cfd3dc]">
                <span className="text-muted text-[11px] mr-1.5">{entry.timestamp}</span>
                {entry.speaker && (
                  <span className={`font-semibold mr-1.5 ${entry.speaker === 'You' ? 'text-blue-400' : 'text-green-400'}`}>
                    [{entry.speaker}]
                  </span>
                )}
                {entry.text}
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}