import { useCallback, useEffect, useRef, useState } from 'react';

/** Text-to-speech via the browser's built-in Web Speech API (free, offline-capable on most OSes). */
export function useSpeaker(enabled: boolean, rate = 1) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const speak = useCallback(
    (text: string, opts: { pitch?: number; rate?: number; prefer?: 'female' | 'male' } = {}) => {
      if (!enabled || !supported || !text) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
      if (opts.prefer && voices.length) {
        const female = /female|samantha|victoria|karen|moira|tessa|zira|susan|aria|jenny|libby|sonia/i;
        const male = /male|daniel|alex|fred|david|mark|guy|ryan|george|thomas/i;
        const want = opts.prefer === 'female' ? female : male;
        u.voice = voices.find((v) => want.test(v.name) && !(opts.prefer === 'male' && /female/i.test(v.name))) ?? voices[0];
      } else if (voices.length) {
        u.voice = voices[0];
      }
      u.pitch = opts.pitch ?? 1;
      u.rate = (opts.rate ?? 1) * rate;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      synth.speak(u);
    },
    [enabled, supported, rate],
  );

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { speak, stop, speaking, supported };
}

type RecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

/** Speech-to-text dictation where the browser supports it (Chrome, Edge, Safari). */
export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<RecognitionLike | null>(null);
  const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : {};
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => RecognitionLike) | undefined;
  const supported = !!Ctor;
  const cb = useRef(onText);
  cb.current = onText;

  const start = useCallback(() => {
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) cb.current(e.results[i][0].transcript.trim());
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [Ctor]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => () => recRef.current?.stop(), []);
  return { start, stop, listening, supported };
}
