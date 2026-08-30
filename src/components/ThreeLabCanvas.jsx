'use client';

import { useEffect, useRef } from 'react';

export default function ThreeLabCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cleanup = () => {};
    import('three').then(({ default: THREE }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050816);
      const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
      camera.position.set(0, 1.8, 6);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      scene.add(new THREE.AmbientLight(0xffffff, 1.8));
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.65, 32, 32), new THREE.MeshStandardMaterial({ emissive: 0x22d3ee, emissiveIntensity: 0.35, roughness: 0.25 }));
      scene.add(mesh);
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.015, 8, 96), new THREE.MeshBasicMaterial({ color: 0x67e8f9 }));
      orbit.rotation.x = Math.PI / 2.5;
      scene.add(orbit);
      let frame;
      const animate = () => { mesh.rotation.y += 0.01; orbit.rotation.z += 0.008; renderer.render(scene, camera); frame = requestAnimationFrame(animate); };
      animate();
      cleanup = () => { cancelAnimationFrame(frame); renderer.dispose(); renderer.domElement = null; };
    });
    return () => cleanup();
  }, []);

  return <canvas ref={canvasRef} className="h-full min-h-[520px] w-full rounded-3xl border border-white/10" />;
}
