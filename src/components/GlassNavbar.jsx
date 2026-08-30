'use client';

const items = [
  ['Chat', '/dashboard'],
  ['Notes Maker', '/notes'],
  ['Photo Analysis', '/notes?mode=photo'],
  ['3D Labs', '/labs'],
  ['Voice Assistant', '/dashboard?mode=voice']
];

export default function GlassNavbar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl md:block">
      <div className="mb-8 text-xl font-semibold tracking-tight">MIMO <span className="text-cyan-300">CORE</span></div>
      <nav className="space-y-2">
        {items.map(([label, href]) => <a key={label} href={href} className="block rounded-xl px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">{label}</a>)}
      </nav>
    </aside>
  );
}
