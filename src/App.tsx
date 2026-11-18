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

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/demo" element={<EditorWorkspace isDemo />} />
          <Route path="/editor" element={<EditorWorkspace isDemo={false} />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
