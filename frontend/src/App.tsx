import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { PirCasePage } from './pages/PirCasePage';
import { PirSerialTestPage } from './pages/PirSerialTestPage';
import { CsiCasePage } from './pages/CsiCasePage';
import { ComparisonPage } from './pages/ComparisonPage';
import { SystemPage } from './pages/SystemPage';

import { TelemetryProvider } from './context/TelemetryContext';
import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <TelemetryProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="case/pir" element={<PirCasePage />} />
              <Route path="test/pir-usb" element={<PirSerialTestPage />} />
              <Route path="case/csi_router" element={<CsiCasePage caseId="csi_router" />} />
              <Route path="case/csi_dedicated" element={<CsiCasePage caseId="csi_dedicated" />} />
              <Route path="comparison" element={<ComparisonPage />} />
              <Route path="system" element={<SystemPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TelemetryProvider>
    </ThemeProvider>
  );
}
