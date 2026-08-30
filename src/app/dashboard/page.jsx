'use client';

import { useState } from 'react';
import GlassNavbar from '../../components/GlassNavbar';
import MathRenderer from '../../components/MathRenderer';
import VoiceAssistant from '../../components/VoiceAssistant';

export default function Dashboard() {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }) });
      const data = await res.json();
      setAnswer(data.reply || data.error || 'No response received.');
    } finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-[#030712] text-white">
    <GlassNavbar />
    <section className="min-h-screen p-5 md:ml-64 md:p-10">
      <header className="mb-8 flex items-center justify-between">
        <div><p className="text-xs uppercase tracking-[0.3em] text-cyan-300">AI Study Platform</p><h1 className="mt-2 text-4xl font-semibold">Learn deeper. Think sharper.</h1></div>
        <VoiceAssistant onTranscript={setPrompt} textToSpeak={answer} />
      </header>
      <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-md">
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ask physics, chemistry, mathematics, computer science…" className="min-h-36 w-full resize-none bg-transparent text-lg outline-none placeholder:text-slate-600" />
        <div className="mt-5 flex justify-end"><button disabled={loading} onClick={ask} className="rounded-xl bg-cyan-300 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50">{loading ? 'Thinking…' : 'Ask MIMO'}</button></div>
      </div>
      {answer && <article className="mx-auto mt-6 max-w-5xl rounded-3xl border border-white/10 bg-white/[0.035] p-6"><MathRenderer content={answer} /></article>}
    </section>
  </main>;
}
