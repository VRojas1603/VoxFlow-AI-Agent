import React, { useRef, useEffect } from 'react';
import { MessageSquare, User, Bot } from 'lucide-react';

export function TranscriptView({ conversation }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm flex flex-col h-[320px]">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
        <MessageSquare className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-semibold text-white m-0">Live Conversation History</h3>
        <span className="text-xs text-slate-500 ml-auto">{conversation.length} messages</span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
      >
        {conversation.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs py-8">
            <Bot className="w-6 h-6 mb-2 text-slate-600" />
            <span>Spoken dialogue between you and Lyra will be transcribed here in real time.</span>
          </div>
        ) : (
          conversation.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={index}
                className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                    isUser
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-cyan-950/40 text-cyan-100 border border-cyan-800/30 rounded-tr-none'
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/40 rounded-tl-none'
                  }`}
                >
                  <p className="m-0">{msg.text}</p>
                  <span className="block mt-1 text-[10px] text-slate-400 text-right">
                    {msg.time}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
