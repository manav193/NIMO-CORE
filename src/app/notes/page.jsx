'use client';

import { useState } from 'react';
import GlassNavbar from '../../components/GlassNavbar';

export default function NotesPage() {
  const [image, setImage] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const content = [{ type: 'text', text: 'Analyze this study image and create clean revision notes with key concepts, definitions, formulas, and worked steps.' }, { type: 'image_url', image_url: { url: reader.result } }];
        const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content }] }) });
        const data = await res.json();
        setNotes(data.reply || data.error || 'Analysis failed.');
        setLoading(false);
      };
      reader.readAsDataURL(image);
    } catch { setLoading(false); }
  };

  return <main className="min-h-screen bg-[#030712] text-white"><GlassNavbar /><section className="p-5 md:ml-64 md:p-10"><p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Notes Maker</p><h1 className="mt-2 text-4xl font-semibold">Turn pages into revision notes.</h1><div className="mt-8 grid gap-6 lg:grid-cols-2"><label className="flex min-h-72 cursor-pointer items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.04] p-6 text-center backdrop-blur-md">{image ? <img src={URL.createObjectURL(image)} alt="Selected study page" className="max-h-64 rounded-xl object-contain" /> : <span className="text-slate-400">Drop a textbook page or handwritten note here<br /><span className="text-cyan-300">Choose image</span></span>}<input type="file" accept="image/*" className="hidden" onChange={e => setImage(e.target.files?.[0] || null)} /></label><div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"><div className="mb-4 flex justify-end"><button onClick={analyze} disabled={!image || loading} className="rounded-xl bg-cyan-300 px-5 py-3 font-medium text-slate-950 disabled:opacity-50">{loading ? 'Analyzing…' : 'Create Notes'}</button></div><pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-200">{notes || 'Your structured revision notes will appear here.'}</pre></div></div></section></main>;
}
