'use client';

/**
 * Señales sonoras del kiosco.
 *
 * Se generan con WebAudio para no arrastrar archivos de audio y para que suenen
 * igual con o sin red. Son un refuerzo del resultado visual, nunca el único
 * canal: quien no oiga sigue viendo el color y el texto en pantalla.
 */

export type SoundCue = 'granted' | 'denied' | 'ready';

const STORAGE_KEY = 'kiosk:sound';

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

/** Notas de cada señal: frecuencia en Hz, inicio y duración en segundos. */
const CUES: Record<SoundCue, { freq: number; at: number; dur: number }[]> = {
  granted: [
    { freq: 880, at: 0, dur: 0.12 },
    { freq: 1320, at: 0.12, dur: 0.18 },
  ],
  denied: [
    { freq: 220, at: 0, dur: 0.22 },
    { freq: 165, at: 0.22, dur: 0.28 },
  ],
  ready: [{ freq: 660, at: 0, dur: 0.08 }],
};

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(STORAGE_KEY) !== 'off';
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
}

export function playCue(cue: SoundCue): void {
  if (!isSoundEnabled()) return;

  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const start = ctx.currentTime;
  for (const note of CUES[cue]) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = cue === 'denied' ? 'sawtooth' : 'sine';
    oscillator.frequency.value = note.freq;

    // Ataque y caída suaves para evitar el chasquido del corte abrupto.
    gain.gain.setValueAtTime(0, start + note.at);
    gain.gain.linearRampToValueAtTime(0.18, start + note.at + 0.02);
    gain.gain.linearRampToValueAtTime(0, start + note.at + note.dur);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start + note.at);
    oscillator.stop(start + note.at + note.dur + 0.02);
  }
}
