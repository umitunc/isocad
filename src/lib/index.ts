import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useInRouterContext } from 'react-router-dom';
import '../index.css';
import { EditorWorkspace } from '../pages/EditorPage/EditorWorkspace';
import { useLocaleStore } from '../i18n/useLocaleStore';
import { useThemeStore } from '../store/useThemeStore';
import { useEditorStore } from '../store/useEditorStore';
import type { LocaleCode } from '../i18n/types';
import type { ThemeMode } from '../store/useThemeStore';

export { CadEngineFacade } from '../core/CadEngineFacade';
export { PipingPdfAnalyzer } from '../piping-domain/pdf-loader/PipingPdfAnalyzer';
export { PdfTileManager } from '../engine-webgl/PdfTileManager';
export { WebGL2Renderer } from '../engine-webgl/WebGL2Renderer';
export { ExcelWorkbookExporter } from '../exporters/ExcelWorkbookExporter';
export { DxfExporter } from '../exporters/DxfExporter';
export { PdfVectorExporter } from '../exporters/PdfVectorExporter';
export { SyncOrchestrator } from '../integrations/SyncOrchestrator';
export { RestWebhookAdapter } from '../integrations/RestWebhookAdapter';
export { LaravelApiAdapter } from '../integrations/LaravelApiAdapter';
export { PostMessageBridge } from '../integrations/PostMessageBridge';
export { useEditorStore, useLocaleStore, useThemeStore };

export interface IsoCadEditorProps {
  isDemo?: boolean;
}

/**
 * Drop-in React component for embedding the full IsoCad WebGL2 CAD & Piping PDF Editor.
 * Automatically wraps itself in a MemoryRouter if not already inside a React Router context.
 */
export const IsoCadEditor: React.FC<IsoCadEditorProps> = ({ isDemo = false }) => {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return React.createElement(EditorWorkspace, { isDemo });
  }
  return React.createElement(
    MemoryRouter,
    null,
    React.createElement(EditorWorkspace, { isDemo }),
  );
};

export interface MountIsoCadOptions {
  theme?: ThemeMode;
  locale?: LocaleCode;
  isDemo?: boolean;
}

/**
 * Mounts IsoCad into any DOM element or CSS selector (ideal for CDN / Vanilla JS usage).
 * Returns an unmount cleanup function.
 */
export function mountIsoCad(
  target: string | HTMLElement,
  options: MountIsoCadOptions = {},
): () => void {
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (!el) {
    throw new Error(`IsoCad mount target not found: ${String(target)}`);
  }
  if (options.theme) {
    useThemeStore.getState().setTheme(options.theme);
  }
  if (options.locale) {
    useLocaleStore.getState().setLocale(options.locale);
  }
  const root: Root = createRoot(el);
  root.render(React.createElement(IsoCadEditor, { isDemo: options.isDemo ?? false }));
  return () => root.unmount();
}
