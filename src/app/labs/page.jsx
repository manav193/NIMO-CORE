'use client';

import GlassNavbar from '../../components/GlassNavbar';
import ThreeLabCanvas from '../../components/ThreeLabCanvas';

export default function LabsPage() {
  return <main className="min-h-screen bg-[#030712] text-white"><GlassNavbar /><section className="p-5 md:ml-64 md:p-10"><p className="text-xs uppercase tracking-[0.3em] text-cyan-300">3D Experiment Labs</p><h1 className="mb-6 mt-2 text-4xl font-semibold">Visual science, in motion.</h1><ThreeLabCanvas /></section></main>;
}
