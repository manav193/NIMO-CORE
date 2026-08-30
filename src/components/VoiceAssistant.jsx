'use client';

import { useEffect, useRef, useState } from 'react';

export default function VoiceAssistant({ onTranscript, textToSpeak = '' }) {
  const recognition = useRef(null);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const instance = new SpeechRecognition();
    instance.continuous = false;
    instance.interimResults = false;
    instance.lang = 'en-IN';
    instance.onresult = event => onTranscript?.(event.results[0][0].transcript);
    instance.onend = () => setListening(false);
    recognition.current = instance;
  }, [onTranscript]);

  useEffect(() => {
    if (!textToSpeak || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(textToSpeak));
  }, [textToSpeak]);

  const toggle = () => {
    if (!recognition.current) return;
    if (listening) recognition.current.stop();
    else { setListening(true); recognition.current.start(); }
  };

  return <button onClick={toggle} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10">{listening ? 'Listening…' : '🎙 Voice'}</button>;
}
