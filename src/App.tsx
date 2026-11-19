import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage/LandingPage';

const EditorWorkspace = lazy(() =>
  import('./pages/EditorPage/EditorWorkspace').then((m) => ({ default: m.EditorWorkspace })),
);
const DocsPage = lazy(() =>
  import('./pages/DocsPage/DocsPage').then((m) => ({ default: m.DocsPage })),
);

const PageLoader: React.FC = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-[#090d16] text-cyan-300 font-mono text-xs">
    Loading QCad WebGL2 Engine...
  </div>
);

const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={isElectron ? <Navigate to="/editor" replace /> : <LandingPage />} />
          <Route path="/demo" element={<EditorWorkspace isDemo />} />
          <Route path="/editor" element={<EditorWorkspace isDemo={false} />} />
          <Route path="/docs" element={isElectron ? <Navigate to="/editor" replace /> : <DocsPage />} />
          <Route path="*" element={<Navigate to={isElectron ? '/editor' : '/'} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
