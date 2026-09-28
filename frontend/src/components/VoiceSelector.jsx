import React from 'react';
import { Mic2 } from 'lucide-react';
import { VOICE_GROUPS } from '../data/voices';

export function VoiceSelector({ value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-48">
      <label htmlFor="voice-selector" className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
        <Mic2 className="w-3.5 h-3.5 text-purple-400" />
        Voice for this session
      </label>
      <select
        id="voice-selector"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition-colors hover:border-purple-500/60 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
      >
        {VOICE_GROUPS.map((group) => (
          <optgroup key={group.label} label={`${group.flag} ${group.label}`}>
            {group.voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className="m-0 max-w-64 text-[10px] leading-4 text-slate-500">
        La voz queda fija al iniciar la sesión; durante la conversación puedes pedirle que cambie de idioma.
      </p>
    </div>
  );
}
