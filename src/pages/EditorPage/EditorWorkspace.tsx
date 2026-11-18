import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { CadEngineFacade } from '../../core/CadEngineFacade';
import { AddEntityCommand, BatchCommand, RemoveEntityCommand } from '../../core/commands/EntityCommands';
import { deserializeCadEntities } from '../../core/entities/EntityDeserializer';
import { TextEntity } from '../../core/entities/TextEntity';
import { WeldStampEntity } from '../../core/entities/WeldStampEntity';
import { Point2D, RenderLinePrimitive } from '../../core/interfaces/ICadEntity';
import { QCadExportEnvelope } from '../../core/interfaces/IDataSyncAdapter';
import { PdfBackgroundTexture, ViewportTransform } from '../../core/interfaces/IRenderEngine';
import { cycleIsoplane } from '../../core/math/IsometricProjection';
import { fitBoundsToViewport, screenToWorld, zoomToPoint } from '../../core/math/Mat3Camera';
import { EditorMenuBar } from './EditorMenuBar';
import { PdfTileManager } from '../../engine-webgl/PdfTileManager';
import { TextAndHudOverlay } from '../../engine-webgl/TextAndHudOverlay';
import { WebGL2Renderer } from '../../engine-webgl/WebGL2Renderer';
import { DxfExporter } from '../../exporters/DxfExporter';
import { ExcelWorkbookExporter } from '../../exporters/ExcelWorkbookExporter';
import { PdfVectorExporter } from '../../exporters/PdfVectorExporter';
import { useLocaleStore } from '../../i18n/useLocaleStore';
import { syncOrchestrator } from '../../integrations/SyncOrchestrator';
import {
  loadUploadedPdfBytes,
  loadWorkspaceFromLocalStorage,
  saveUploadedPdfBytes,
  saveWorkspaceToLocalStorage,
} from '../../persistence/PersistenceService';
import { PipingPdfAnalyzer } from '../../piping-domain/pdf-loader/PipingPdfAnalyzer';
import { JointWidgetMeta } from '../../piping-domain/types/PipingModels';
import { SampleManifestItem, useEditorStore } from '../../store/useEditorStore';
import { useThemeStore } from '../../store/useThemeStore';
import { BottomDataDrawer } from './BottomDataDrawer';
import { CommandLineBar } from './CommandLineBar';
import { FloatingCadToolbar } from './FloatingCadToolbar';
import { RightInspectorSidebar } from './RightInspectorSidebar';
import { EndpointConfigModal } from './modals/EndpointConfigModal';
import { JointWidgetModal } from './modals/JointWidgetModal';

interface EditorWorkspaceProps {
  isDemo?: boolean;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({ isDemo: _isDemo = false }) => {
  const { locale, setLocale } = useLocaleStore();
  const { theme } = useThemeStore();
  const store = useEditorStore();
  const isLocalUploadRef = useRef(false);
  const isHydratedRef = useRef(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const engineRef = useRef<CadEngineFacade>(new CadEngineFacade());
  const rendererRef = useRef<WebGL2Renderer>(new WebGL2Renderer());
  const hudRef = useRef<TextAndHudOverlay>(new TextAndHudOverlay());
  const pdfMgrRef = useRef<PdfTileManager>(new PdfTileManager());
  const analyzerRef = useRef<PipingPdfAnalyzer>(new PipingPdfAnalyzer());

  const viewportRef = useRef<ViewportTransform>({ zoom: 1, panX: 40, panY: 40 });
  const pdfBgRef = useRef<PdfBackgroundTexture | null>(null);
  const isPanningRef = useRef(false);
  const spacePressedRef = useRef(false);
  const lastPanScreenRef = useRef<Point2D>({ x: 0, y: 0 });
  const rafScheduledRef = useRef(false);

  const [samples, setSamples] = useState<SampleManifestItem[]>([]);
  const [cursorWorld, setCursorWorld] = useState<Point2D>({ x: 0, y: 0 });
  const [cliStatus, setCliStatus] = useState('Ready');
  const [toast, setToast] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [, setRenderTick] = useState(0);

  const persistState = useCallback(() => {
    if (!isHydratedRef.current) return;
    const st = useEditorStore.getState();
    saveWorkspaceToLocalStorage({
      version: 1,
      savedAt: Date.now(),
      locale: useLocaleStore.getState().locale,
      drawingType: st.drawingType,
      drawingNo: st.drawingNo,
      revisionNo: st.revisionNo,
      activePdfUrl: st.activePdfUrl,
      isLocalUpload: isLocalUploadRef.current,
      currentPage: st.currentPage,
      viewport: viewportRef.current,
      editMode: st.editMode,
      strokeColor: st.strokeColor,
      orthoEnabled: st.orthoEnabled,
      isoplaneMode: st.isoplaneMode,
      gridVisible: st.gridVisible,
      showRulers: st.showRulers,
      selectedSpool: st.selectedSpool,
      selectedJoint: st.selectedJoint,
      selectedWelder: st.selectedWelder,
      drawerOpen: st.drawerOpen,
      drawerTab: st.drawerTab,
      endpointConfig: st.endpointConfig,
      selectedAdapterId: st.selectedAdapterId,
      pipingData: st.pipingData,
      cadEntities: engineRef.current.getAllEntities().map((e) => e.serialize()),
      versions: st.versions,
    });
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const renderNow = useCallback(() => {
    const engine = engineRef.current;
    const vp = viewportRef.current;
    const entities = engine.getPageEntities();
    const selected = engine.getSelectedIds();

    const lines: RenderLinePrimitive[] = [];
    for (const ent of entities) {
      const isSel = selected.has(ent.id);
      for (const prim of ent.toRenderPrimitives(isSel, false)) {
        lines.push(prim);
      }
    }
    for (const prev of engine.getActiveTool().getPreviewPrimitives()) {
      lines.push(prev);
    }

    const st = useEditorStore.getState();
    rendererRef.current.render({
      viewport: vp,
      pdfPage: pdfBgRef.current,
      lines,
      polygons: [],
      snapIndicator: engine.getCurrentSnap(),
      gridVisible: st.gridVisible,
      isometricGrid: st.isoplaneMode !== 'OFF',
    });

    hudRef.current.render({
      viewport: vp,
      entities,
      selectedIds: selected,
      snapIndicator: engine.getCurrentSnap(),
      marqueeBox: engine.getMarqueeBox(),
      pageDimensionsPt: pdfBgRef.current
        ? { width: pdfBgRef.current.widthPt, height: pdfBgRef.current.heightPt }
        : null,
      showRulers: st.showRulers,
    });
  }, []);

  const requestRender = useCallback(() => {
    if (rafScheduledRef.current) return;
    rafScheduledRef.current = true;
    requestAnimationFrame(() => {
      rafScheduledRef.current = false;
      renderNow();
    });
  }, [renderNow]);

  const fitToScreen = useCallback(() => {
    const el = containerRef.current;
    const bg = pdfBgRef.current;
    if (!el || !bg) return;
    const nextVp = fitBoundsToViewport(bg.widthPt, bg.heightPt, el.clientWidth, el.clientHeight, 36);
    viewportRef.current = nextVp;
    engineRef.current.zoom = nextVp.zoom;
    useEditorStore.getState().setField('zoom', nextVp.zoom);
    requestRender();
  }, [requestRender]);

  const renderPdfPage = useCallback(
    async (pageNum: number) => {
      setLoadingPdf(true);
      try {
        const { texture, vectorSnaps, vectorSegments } = await pdfMgrRef.current.renderPageToTexture(
          pageNum,
          2.5,
        );
        pdfBgRef.current = texture;
        engineRef.current.activePage = pageNum;
        engineRef.current.osnap.setPdfVectorSnaps(vectorSnaps);
        engineRef.current.osnap.setPdfVectorSegments(vectorSegments);
        useEditorStore.getState().setField('currentPage', pageNum);
        fitToScreen();
      } finally {
        setLoadingPdf(false);
      }
    },
    [fitToScreen],
  );

  const handleAutoExtract = useCallback(async () => {
    const doc = pdfMgrRef.current.getDocument();
    if (!doc) {
      showToast('No PDF loaded');
      return;
    }
    try {
      const result = await analyzerRef.current.analyzeDocument(
        doc,
        useEditorStore.getState().drawingNo,
      );
      useEditorStore.getState().setField('pipingData', result);
      useEditorStore.getState().setField('drawingNo', result.lineNo);
      useEditorStore.getState().setField('revisionNo', result.revNo);
      useEditorStore.getState().setField('drawerOpen', true);
      showToast(
        `Extracted ${result.mto.length} MTO, ${result.welds.length} Weld Log, ${result.cuts.length} Cut List, ${result.supports.length} Supports`,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Extraction failed');
    }
  }, []);

  const loadPdfFromUrl = useCallback(
    async (url: string, meta?: Partial<SampleManifestItem>) => {
      setLoadingPdf(true);
      try {
        const prevUrl = useEditorStore.getState().activePdfUrl;
        const { numPages } = await pdfMgrRef.current.loadFromUrl(url);
        useEditorStore.getState().setField('activePdfUrl', url);
        useEditorStore.getState().setField('totalPages', numPages);
        if (meta?.drawingNo) useEditorStore.getState().setField('drawingNo', meta.drawingNo);
        if (meta?.revision) useEditorStore.getState().setField('revisionNo', meta.revision);
        await renderPdfPage(1);
        setCliStatus(`Loaded ${meta?.drawingNo ?? url} (${numPages} pg)`);
        if (prevUrl !== url || !useEditorStore.getState().pipingData) {
          await handleAutoExtract();
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'PDF load failed');
      } finally {
        setLoadingPdf(false);
      }
    },
    [renderPdfPage, handleAutoExtract],
  );

  const handleAutoStamp = useCallback(() => {
    const st = useEditorStore.getState();
    const piping = st.pipingData;
    const bg = pdfBgRef.current;
    if (!piping || !bg) {
      showToast('Run "Extract MTO & Weld" first!');
      return;
    }
    const stamps = analyzerRef.current.topologyBuilder.createStampsFromWeldLog(
      piping.welds,
      bg.heightPt,
      engineRef.current.osnap.getPdfVectorSegments(),
      engineRef.current.osnap.getPdfVectorSnaps(),
    );
    if (stamps.length === 0) {
      showToast('No spatial weld numbers found on drawing.');
      return;
    }
    const cmds = stamps.map((s) => new AddEntityCommand(engineRef.current.repo, s));
    engineRef.current.commands.execute(new BatchCommand(cmds, `Auto-Stamp ${stamps.length} Welds`));
    showToast(`Placed ${stamps.length} smart weld stamps on drawing`);
    requestRender();
  }, [requestRender]);

  // Mount WebGL2 + HUD & Load Manifest
  useEffect(() => {
    const glCanvas = glCanvasRef.current;
    const hudCanvas = hudCanvasRef.current;
    const container = containerRef.current;
    if (!glCanvas || !hudCanvas || !container) return;

    rendererRef.current.mount(glCanvas);
    hudRef.current.mount(hudCanvas);

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      rendererRef.current.resize(container.clientWidth, container.clientHeight, dpr);
      hudRef.current.resize(hudCanvas, container.clientWidth, container.clientHeight, dpr);
      // Render synchronously after resizing so the cleared WebGL buffer is never composited black.
      renderNow();
    };
    handleResize();
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    const engine = engineRef.current;
    engine.setCallbacks({
      onRequestRender: requestRender,
      onOpenJointWidget: (id) => useEditorStore.getState().setField('activeJointModalEntityId', id),
      onRequestTextInput: (pt) => {
        const txt = window.prompt('Annotation Text:');
        if (txt && txt.trim()) {
          const ent = new TextEntity(`txt-${Date.now()}`, pt, txt.trim(), {
            pageNumber: engine.activePage,
            strokeColor: engine.strokeColor,
          });
          engine.commands.execute(new AddEntityCommand(engine.repo, ent));
          requestRender();
        }
      },
      onEntitiesChanged: () => {
        useEditorStore.getState().setField('hasUnsavedChanges', true);
        setRenderTick((x) => x + 1);
        persistState();
      },
      onSelectionChanged: () => setRenderTick((x) => x + 1),
      onToolChanged: (name) => useEditorStore.getState().setField('activeTool', name),
      onCliLog: (msg) => setCliStatus(msg),
    });

    const hydrateWorkspace = async () => {
      const saved = loadWorkspaceFromLocalStorage();
      let list: SampleManifestItem[] = [];
      try {
        list = await fetch('/samples/manifest.json').then((r) => r.json());
        setSamples(list);
      } catch {
        // ignore
      }

      if (saved) {
        setLocale(saved.locale);
        const st = useEditorStore.getState();
        st.setField('drawingType', saved.drawingType);
        st.setField('drawingNo', saved.drawingNo);
        st.setField('revisionNo', saved.revisionNo);
        st.setField('activePdfUrl', saved.activePdfUrl);
        st.setField('editMode', saved.editMode);
        st.setField('strokeColor', saved.strokeColor);
        st.setField('orthoEnabled', saved.orthoEnabled);
        st.setField('isoplaneMode', saved.isoplaneMode);
        st.setField('gridVisible', saved.gridVisible);
        st.setField('showRulers', saved.showRulers);
        st.setField('selectedSpool', saved.selectedSpool);
        st.setField('selectedJoint', saved.selectedJoint);
        st.setField('selectedWelder', saved.selectedWelder);
        st.setField('drawerOpen', saved.drawerOpen);
        st.setField('drawerTab', saved.drawerTab);
        st.setField('endpointConfig', saved.endpointConfig);
        st.setField('selectedAdapterId', saved.selectedAdapterId);
        st.setField('pipingData', saved.pipingData);
        st.setField('versions', saved.versions ?? []);

        const restoredEntities = deserializeCadEntities(saved.cadEntities ?? []);
        if (restoredEntities.length > 0) {
          engine.loadEntities(restoredEntities);
        }

        isLocalUploadRef.current = saved.isLocalUpload;
        if (saved.isLocalUpload) {
          const uploaded = await loadUploadedPdfBytes();
          if (uploaded) {
            const { numPages } = await pdfMgrRef.current.loadFromBytes(uploaded.bytes);
            st.setField('totalPages', numPages);
            await renderPdfPage(Math.min(saved.currentPage || 1, numPages));
            viewportRef.current = saved.viewport ?? viewportRef.current;
            engine.zoom = viewportRef.current.zoom;
            st.setField('zoom', viewportRef.current.zoom);
            requestRender();
            isHydratedRef.current = true;
            return;
          }
        } else if (saved.activePdfUrl) {
          await loadPdfFromUrl(saved.activePdfUrl, {
            drawingNo: saved.drawingNo,
            revision: saved.revisionNo,
          });
          viewportRef.current = saved.viewport ?? viewportRef.current;
          engine.zoom = viewportRef.current.zoom;
          st.setField('zoom', viewportRef.current.zoom);
          requestRender();
          isHydratedRef.current = true;
          return;
        }
      }

      isHydratedRef.current = true;
      if (list[0]) {
        await loadPdfFromUrl(list[0].url, list[0]);
      }
    };

    hydrateWorkspace();

    return () => {
      ro.disconnect();
      rendererRef.current.dispose();
    };
  }, [loadPdfFromUrl, requestRender]);

  // Sync Zustand tool settings into engine
  useEffect(() => {
    const eng = engineRef.current;
    eng.strokeColor = store.strokeColor;
    eng.orthoEnabled = store.orthoEnabled;
    eng.isoplaneMode = store.isoplaneMode;
    eng.stampDefaults = {
      spoolNo: store.selectedSpool,
      jointNo: store.selectedJoint,
      welderId: store.editMode === 'joints_welder' ? store.selectedWelder : '',
    };
    requestRender();
    persistState();
  }, [
    theme,
    locale,
    store.strokeColor,
    store.orthoEnabled,
    store.isoplaneMode,
    store.selectedSpool,
    store.selectedJoint,
    store.selectedWelder,
    store.editMode,
    store.gridVisible,
    store.showRulers,
    store.pipingData,
    store.drawerOpen,
    store.drawerTab,
    store.drawingType,
    store.drawingNo,
    store.endpointConfig,
    store.selectedAdapterId,
    requestRender,
    persistState,
  ]);

  // Keyboard shortcuts (F5, F8, Ctrl+Z/Y, Space Pan, Delete)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT');
      if (isTyping) return;

      if (e.code === 'Space') {
        spacePressedRef.current = true;
        e.preventDefault();
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        useEditorStore.getState().setField('isoplaneMode', cycleIsoplane(useEditorStore.getState().isoplaneMode));
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        useEditorStore.getState().setField('orthoEnabled', !useEditorStore.getState().orthoEnabled);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) engineRef.current.commands.redo();
        else engineRef.current.commands.undo();
        requestRender();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        engineRef.current.commands.redo();
        requestRender();
        return;
      }
      if (e.key === 'Escape') {
        engineRef.current.setTool('select');
      }
      engineRef.current.getActiveTool().onKeyDown?.(e.key, e);
      requestRender();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressedRef.current = false;
        isPanningRef.current = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [requestRender]);

  // Unsaved changes guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useEditorStore.getState().hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const getScreenPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point2D => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const screen = getScreenPoint(e);
    if (spacePressedRef.current || store.activeTool === 'pan' || e.button === 1) {
      isPanningRef.current = true;
      lastPanScreenRef.current = screen;
      return;
    }
    const world = screenToWorld(screen, viewportRef.current);
    engineRef.current.handlePointerEvent('down', world, screen, {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      button: e.button,
    });
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const screen = getScreenPoint(e);
    if (isPanningRef.current) {
      const dx = screen.x - lastPanScreenRef.current.x;
      const dy = screen.y - lastPanScreenRef.current.y;
      viewportRef.current = {
        ...viewportRef.current,
        panX: viewportRef.current.panX + dx,
        panY: viewportRef.current.panY + dy,
      };
      lastPanScreenRef.current = screen;
      requestRender();
      return;
    }
    const world = screenToWorld(screen, viewportRef.current);
    setCursorWorld(world);
    engineRef.current.handlePointerEvent('move', world, screen, {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      button: e.button,
    });
    requestRender();
  };

  const handlePointerUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }
    const screen = getScreenPoint(e);
    const world = screenToWorld(screen, viewportRef.current);
    engineRef.current.handlePointerEvent('up', world, screen, {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      button: e.button,
    });
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const screen = getScreenPoint(e);
    const world = screenToWorld(screen, viewportRef.current);
    engineRef.current.handlePointerEvent('dblclick', world, screen, {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      button: e.button,
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextVp = zoomToPoint(viewportRef.current, screen, viewportRef.current.zoom * factor);
    viewportRef.current = nextVp;
    engineRef.current.zoom = nextVp.zoom;
    useEditorStore.getState().setField('zoom', nextVp.zoom);
    requestRender();
  };

  const buildExportContext = () => ({
    originalPdfBytes: pdfMgrRef.current.getRawBytes() ?? undefined,
    entities: engineRef.current.getAllEntities(),
    pipingData: useEditorStore.getState().pipingData ?? {
      lineNo: store.drawingNo,
      revNo: store.revisionNo,
      pages: [],
      mto: [],
      cuts: [],
      supports: [],
      welds: [],
    },
    pageCount: store.totalPages,
    pageDimensionsPt: pdfBgRef.current
      ? [{ width: pdfBgRef.current.widthPt, height: pdfBgRef.current.heightPt }]
      : [{ width: 1191, height: 842 }],
    documentTitle: store.drawingNo,
    drawingNo: store.drawingNo,
    revisionNo: store.revisionNo,
  });

  const handleExportPdf = async () => {
    const artifact = await new PdfVectorExporter().export(buildExportContext());
    downloadBlob(artifact.blob, artifact.filename);
    showToast(`Exported ${artifact.filename}`);
  };

  const handleExportExcel = async () => {
    const artifact = await new ExcelWorkbookExporter().export(buildExportContext());
    downloadBlob(artifact.blob, artifact.filename);
    showToast(`Exported ${artifact.filename}`);
  };

  const handleExportDxf = async () => {
    const artifact = await new DxfExporter().export(buildExportContext());
    downloadBlob(artifact.blob, artifact.filename);
    showToast(`Exported ${artifact.filename}`);
  };

  const handleExecuteSync = async (stage: 'draft' | 'pdf_spool_iso' | 'pdf_as_build') => {
    const st = useEditorStore.getState();
    const ctx = buildExportContext();
    let vectorPdfBase64: string | undefined;
    if (st.endpointConfig.includeVectorPdf) {
      const pdfArt = await new PdfVectorExporter().export(ctx);
      const buf = await pdfArt.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < Math.min(bytes.length, 4096); i++) bin += String.fromCharCode(bytes[i]);
      vectorPdfBase64 = btoa(bin);
    }

    const envelope: QCadExportEnvelope = {
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      stage,
      document: {
        drawingType: st.drawingType,
        drawingNo: st.drawingNo,
        lineNo: st.pipingData?.lineNo ?? st.drawingNo,
        revisionNo: st.revisionNo,
        sheetNo: String(st.currentPage),
        totalPages: st.totalPages,
        continuation: st.pipingData?.pages[0]?.continuation ?? null,
      },
      pipingData: {
        mto: st.pipingData?.mto ?? [],
        weldLog: st.pipingData?.welds ?? [],
        cutList: st.pipingData?.cuts ?? [],
        supportList: st.pipingData?.supports ?? [],
      },
      annotations: engineRef.current
        .getAllEntities()
        .filter((e) => e instanceof WeldStampEntity)
        .map((e) => e.serialize()),
      cadEntities: engineRef.current.getAllEntities().map((e) => e.serialize()),
      artifacts: vectorPdfBase64 ? { vectorPdfBase64 } : undefined,
    };

    const res = await syncOrchestrator.sync(st.selectedAdapterId, envelope, st.endpointConfig);
    st.addSyncLog(res, envelope);
    if (res.success) {
      st.addVersionSnapshot(`Synced (${stage})`, envelope.cadEntities);
      showToast(res.message);
    } else {
      showToast(res.message);
    }
  };

  const activeJointStamp =
    store.activeJointModalEntityId &&
      engineRef.current.repo.getById(store.activeJointModalEntityId) instanceof WeldStampEntity
      ? (engineRef.current.repo.getById(store.activeJointModalEntityId) as WeldStampEntity)
      : null;

  const handleSaveJointMeta = (stampId: string, updatedMeta: JointWidgetMeta) => {
    const ent = engineRef.current.repo.getById(stampId);
    if (ent instanceof WeldStampEntity) {
      ent.jointMeta = { ...updatedMeta };
      ent.jointNo = updatedMeta.jointNo;
      ent.welderId = updatedMeta.welderId;
      ent.spoolNo = updatedMeta.spoolNo1;
      engineRef.current.repo.replace(ent);
      requestRender();
    }
    store.setField('activeJointModalEntityId', null);
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-[#090d16] text-slate-100 overflow-hidden">
      {/* Top Industrial Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0b1120] px-3 py-2">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center">
            <img
              src={theme === 'light' ? '/isocad-logo-light.png' : '/isocad-logo.png'}
              alt="IsoCad Logo"
              className="h-8 w-auto object-contain"
            />
          </Link>
          <span className="hidden md:inline font-mono text-xs text-slate-400">
            {store.drawingNo} • Rev {store.revisionNo}
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const buf = new Uint8Array(await file.arrayBuffer());
            isLocalUploadRef.current = true;
            await saveUploadedPdfBytes(buf, file.name);
            const { numPages } = await pdfMgrRef.current.loadFromBytes(buf);
            store.setField('drawingNo', file.name.replace(/\.pdf$/i, ''));
            store.setField('totalPages', numPages);
            store.setField('pipingData', null);
            await renderPdfPage(1);
            await handleAutoExtract();
            persistState();
          }}
        />
        <EditorMenuBar
          onUploadPdf={() => fileInputRef.current?.click()}
          onAutoExtract={handleAutoExtract}
          onAutoStamp={handleAutoStamp}
          onExportPdf={handleExportPdf}
          onExportExcel={handleExportExcel}
          onExportDxf={handleExportDxf}
          onOpenPushApi={() => store.setField('endpointModalOpen', true)}
        />
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="relative flex flex-1 flex-col min-w-0">
          {/* WebGL2 + HUD Viewport */}
          <div ref={containerRef} className="relative flex-1 overflow-hidden bg-[#111827]">
            <canvas ref={glCanvasRef} className="absolute inset-0 h-full w-full block" />
            <canvas
              ref={hudCanvasRef}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onDoubleClick={handleDoubleClick}
              onWheel={handleWheel}
              className="absolute inset-0 h-full w-full block"
              style={{
                cursor:
                  spacePressedRef.current || store.activeTool === 'pan'
                    ? 'grab'
                    : engineRef.current.getActiveTool().cursor,
              }}
            />

            {loadingPdf && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs">
                <div className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-4 text-center">
                  <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                  <div className="text-xs font-mono text-cyan-300">Rendering WebGL2 PDF Vectors...</div>
                </div>
              </div>
            )}

            {toast && (
              <div className="absolute top-8 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-slate-900/95 px-4 py-1.5 text-xs font-medium text-cyan-200 shadow-xl">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                {toast}
              </div>
            )}

            <FloatingCadToolbar
              canUndo={engineRef.current.commands.canUndo()}
              canRedo={engineRef.current.commands.canRedo()}
              onSelectTool={(name) => {
                if (name === 'pan') {
                  store.setField('activeTool', 'pan');
                } else {
                  engineRef.current.setTool(name);
                }
              }}
              onUndo={() => {
                engineRef.current.commands.undo();
                requestRender();
              }}
              onRedo={() => {
                engineRef.current.commands.redo();
                requestRender();
              }}
              onDeleteSelected={() => {
                const ids = Array.from(engineRef.current.getSelectedIds());
                const cmds = ids
                  .map((id) => engineRef.current.repo.getById(id))
                  .filter((e): e is NonNullable<typeof e> => Boolean(e))
                  .map((e) => new RemoveEntityCommand(engineRef.current.repo, e));
                if (cmds.length > 0) {
                  engineRef.current.commands.execute(new BatchCommand(cmds, 'Delete Selected'));
                  requestRender();
                }
              }}
              onZoomIn={() => {
                const el = containerRef.current;
                if (!el) return;
                const nextVp = zoomToPoint(
                  viewportRef.current,
                  { x: el.clientWidth * 0.5, y: el.clientHeight * 0.5 },
                  viewportRef.current.zoom * 1.25,
                );
                viewportRef.current = nextVp;
                engineRef.current.zoom = nextVp.zoom;
                store.setField('zoom', nextVp.zoom);
                requestRender();
              }}
              onZoomOut={() => {
                const el = containerRef.current;
                if (!el) return;
                const nextVp = zoomToPoint(
                  viewportRef.current,
                  { x: el.clientWidth * 0.5, y: el.clientHeight * 0.5 },
                  viewportRef.current.zoom * 0.8,
                );
                viewportRef.current = nextVp;
                engineRef.current.zoom = nextVp.zoom;
                store.setField('zoom', nextVp.zoom);
                requestRender();
              }}
              onZoomFit={fitToScreen}
              onPrevPage={() => {
                if (store.currentPage > 1) renderPdfPage(store.currentPage - 1);
              }}
              onNextPage={() => {
                if (store.currentPage < store.totalPages) renderPdfPage(store.currentPage + 1);
              }}
              onSaveSnapshot={() => {
                store.addVersionSnapshot(
                  'Manual Snapshot',
                  engineRef.current.getAllEntities().map((e) => e.serialize()),
                );
                showToast('Version snapshot saved!');
              }}
            />
          </div>

          <CommandLineBar
            cursorWorld={cursorWorld}
            cliStatus={cliStatus}
            onExecuteCommand={(raw) => {
              const res = engineRef.current.cli.parseCommand(
                raw,
                engineRef.current.getActiveTool(),
                (toolName) => engineRef.current.setTool(toolName),
                (act) => {
                  if (act === 'UNDO') engineRef.current.commands.undo();
                  if (act === 'REDO') engineRef.current.commands.redo();
                  if (act === 'ZOOM_FIT') fitToScreen();
                  if (act === 'ORTHO') store.setField('orthoEnabled', !store.orthoEnabled);
                  if (act === 'ISO') store.setField('isoplaneMode', cycleIsoplane(store.isoplaneMode));
                  requestRender();
                },
              );
              setCliStatus(res.feedback);
              requestRender();
            }}
          />

          <BottomDataDrawer
            onFocusWorldPoint={(pt) => {
              const el = containerRef.current;
              if (!el) return;
              const zoom = Math.max(viewportRef.current.zoom, 1.8);
              viewportRef.current = {
                zoom,
                panX: el.clientWidth * 0.5 - pt.x * zoom,
                panY: el.clientHeight * 0.5 - pt.y * zoom,
              };
              engineRef.current.zoom = zoom;
              store.setField('zoom', zoom);
              requestRender();
            }}
            onExportExcel={handleExportExcel}
          />
        </div>

        <RightInspectorSidebar
          samples={samples}
          layers={engineRef.current.layers.getAll()}
          entities={engineRef.current.getPageEntities()}
          selectedIds={engineRef.current.getSelectedIds()}
          onSelectSample={(s) => {
            isLocalUploadRef.current = false;
            store.setField('pipingData', null);
            loadPdfFromUrl(s.url, s).then(() => persistState());
          }}
          onAddStampFromSidebar={() => {
            engineRef.current.setTool('stamp_triangle');
          }}
          onToggleLayerVis={(id) => {
            engineRef.current.layers.toggleVisibility(id);
            setRenderTick((x) => x + 1);
            requestRender();
          }}
          onToggleLayerLock={(id) => {
            engineRef.current.layers.toggleLock(id);
            setRenderTick((x) => x + 1);
          }}
          onSelectEntity={(id) => {
            engineRef.current.repo.getById(id);
            useEditorStore.setState({});
            requestRender();
          }}
          onDeleteEntity={(id) => {
            const ent = engineRef.current.repo.getById(id);
            if (ent) {
              engineRef.current.commands.execute(new RemoveEntityCommand(engineRef.current.repo, ent));
              requestRender();
            }
          }}
          onRestoreVersion={(ver) => {
            const snap = store.versions.find((v) => v.version === ver);
            if (snap) {
              store.setField('activeVersion', ver);
              showToast(`Restored Version ${ver}`);
            }
          }}
        />
      </div>

      <JointWidgetModal
        stamp={activeJointStamp}
        mtoItems={store.pipingData?.mto ?? []}
        onClose={() => store.setField('activeJointModalEntityId', null)}
        onSave={handleSaveJointMeta}
      />

      <EndpointConfigModal onExecuteSync={handleExecuteSync} />
    </div>
  );
};
