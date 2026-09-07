'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/lib/theme-store';

interface MermaidDiagramProps {
  chart: string;
  id?: string;
}

/**
 * Renders a Mermaid diagram client-side using the mermaid library.
 * Supports light/dark themes and auto-resizes.
 */
export default function MermaidDiagram({ chart, id }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();

  useEffect(() => {
    let cancelled = false;

    async function renderChart() {
      if (!containerRef.current) return;
      setLoading(true);
      setError(null);

      try {
        const mermaid = (await import('mermaid')).default;

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          themeVariables: isDark ? {
            primaryColor: '#3b82f6',
            primaryTextColor: '#e2e8f0',
            primaryBorderColor: '#475569',
            lineColor: '#64748b',
            secondaryColor: '#1e293b',
            tertiaryColor: '#0f172a',
            background: '#0f172a',
            mainBkg: '#1e293b',
            nodeBorder: '#475569',
            clusterBkg: '#1e293b',
            clusterBorder: '#334155',
            titleColor: '#f1f5f9',
            edgeLabelBackground: '#1e293b',
          } : {
            primaryColor: '#3b82f6',
            primaryTextColor: '#1e293b',
            primaryBorderColor: '#e2e8f0',
            lineColor: '#64748b',
            secondaryColor: '#eff6ff',
            tertiaryColor: '#f8fafc',
            background: '#ffffff',
            mainBkg: '#eff6ff',
            nodeBorder: '#3b82f6',
            clusterBkg: '#f8fafc',
            clusterBorder: '#e2e8f0',
            titleColor: '#0f172a',
            edgeLabelBackground: '#ffffff',
          },
          flowchart: {
            htmlLabels: true,
            curve: 'basis',
            padding: 15,
          },
          fontFamily: 'Vazirmatn, system-ui, sans-serif',
          fontSize: 12,
        });

        const uniqueId = id || `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const { svg } = await mermaid.render(uniqueId, chart.trim());

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'خطا در رسم دیاگرام');
          setLoading(false);
        }
      }
    }

    renderChart();
    return () => { cancelled = true; };
  }, [chart, id, isDark]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400" dir="ltr">
        <p className="font-semibold mb-1">⚠ Diagram Render Error</p>
        <pre className="overflow-x-auto text-xs opacity-80">{error}</pre>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 dark:bg-white/5 rounded-lg">
          <div className="flex items-center gap-2 text-sm opacity-60">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.091 5.82 2.902 7.902L6 17.291z" /></svg>
            در حال رسم...
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto mermaid-container"
        style={{ minHeight: loading ? '120px' : undefined }}
      />
    </div>
  );
}
