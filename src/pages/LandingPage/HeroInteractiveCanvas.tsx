import React, { useEffect, useRef } from 'react';
import { LineEntity } from '../../core/entities/LineEntity';
import { WeldStampEntity } from '../../core/entities/WeldStampEntity';
import { RenderLinePrimitive } from '../../core/interfaces/ICadEntity';
import { TextAndHudOverlay } from '../../engine-webgl/TextAndHudOverlay';
import { WebGL2Renderer } from '../../engine-webgl/WebGL2Renderer';

export const HeroInteractiveCanvas: React.FC = () => {
  const glRef = useRef<HTMLCanvasElement | null>(null);
  const hudRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const glCanvas = glRef.current;
    const hudCanvas = hudRef.current;
    const wrap = wrapRef.current;
    if (!glCanvas || !hudCanvas || !wrap) return;

    const renderer = new WebGL2Renderer();
    const hud = new TextAndHudOverlay();
    renderer.mount(glCanvas);
    hud.mount(hudCanvas);

    // Build sample isometric piping geometry
    const entities = [
      new LineEntity('p1', { x: 80, y: 240 }, { x: 200, y: 170 }, { strokeColor: '#00e5ff', strokeWidth: 3 }),
      new LineEntity('p2', { x: 200, y: 170 }, { x: 200, y: 75 }, { strokeColor: '#00e5ff', strokeWidth: 3 }),
      new LineEntity('p3', { x: 200, y: 75 }, { x: 350, y: 162 }, { strokeColor: '#00e5ff', strokeWidth: 3 }),
      new LineEntity('p4', { x: 350, y: 162 }, { x: 455, y: 102 }, { strokeColor: '#38bdf8', strokeWidth: 3 }),
      new WeldStampEntity({
        id: 'F53A',
        shapeKind: 'triangle',
        center: { x: 145, y: 115 },
        width: 44,
        height: 44,
        leaderAnchor: { x: 200, y: 170 },
        jointNo: '53A',
        welderId: 'W-104',
        strokeColor: '#ef4444',
      }),
      new WeldStampEntity({
        id: 'S12',
        shapeKind: 'circle',
        center: { x: 390, y: 78 },
        width: 42,
        height: 42,
        leaderAnchor: { x: 350, y: 162 },
        jointNo: '12',
        welderId: 'W-108',
        strokeColor: '#f59e0b',
      }),
    ];

    let animId = 0;
    let phase = 0;

    const draw = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      renderer.resize(w, h, dpr);
      hud.resize(hudCanvas, w, h, dpr);

      const scale = Math.min(w / 520, h / 320);
      const vp = {
        zoom: scale,
        panX: (w - 520 * scale) * 0.5,
        panY: (h - 320 * scale) * 0.5 + Math.sin(phase) * 2,
      };

      const lines: RenderLinePrimitive[] = [];
      for (const e of entities) lines.push(...e.toRenderPrimitives(false, false));

      renderer.render({
        viewport: vp,
        pdfPage: null,
        lines,
        polygons: [],
        snapIndicator: { point: { x: 200, y: 170 }, kind: 'END' },
        gridVisible: true,
        isometricGrid: true,
      });

      hud.render({
        viewport: vp,
        entities,
        selectedIds: new Set(),
        snapIndicator: { point: { x: 200, y: 170 }, kind: 'END' },
        marqueeBox: null,
        pageDimensionsPt: null,
        showRulers: false,
      });

      phase += 0.025;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative h-80 w-full overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#0b1120] shadow-2xl shadow-cyan-500/10"
    >
      <canvas ref={glRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={hudRef} className="absolute inset-0 h-full w-full pointer-events-none" />
      <div className="absolute top-3 left-3 rounded-md border border-cyan-500/30 bg-slate-950/80 px-2.5 py-1 text-[10px] font-mono text-cyan-300 backdrop-blur-xs">
        WebGL2 • ISOPLANE TOP (30°) • 60 FPS
      </div>
      <div className="absolute bottom-3 right-3 rounded-md border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-[10px] font-mono text-slate-300">
        GN-80-AH01FS-FA00.030
      </div>
    </div>
  );
};
