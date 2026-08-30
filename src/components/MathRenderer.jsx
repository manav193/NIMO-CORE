'use client';

import { useEffect, useRef } from 'react';

export default function MathRenderer({ content = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    import('katex').then(({ default: katex }) => {
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = content
        .replace(/\\\\\[([\\s\\S]*?)\\\\\]/g, (_, math) => katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }))
        .replace(/\\\\\((.*?)\\\\\)/g, (_, math) => katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }));
    });
    return () => { cancelled = true; };
  }, [content]);

  return <div ref={ref} className="prose prose-invert max-w-none" />;
}
