import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { PirCasePage } from './pages/PirCasePage';
import { CsiRouterCasePage } from './pages/CsiRouterCasePage';
import { CsiDedicatedCasePage } from './pages/CsiDedicatedCasePage';
import { ComparisonPage } from './pages/ComparisonPage';
import { SystemPage } from './pages/SystemPage';

import { ThemeProvider } from './context/ThemeContext';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="case/pir" element={<PirCasePage />} />
            <Route path="case/csi_router" element={<CsiRouterCasePage />} />
            <Route path="case/csi_dedicated" element={<CsiDedicatedCasePage />} />
            <Route path="comparison" element={<ComparisonPage />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
