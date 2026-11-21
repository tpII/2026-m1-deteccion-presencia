import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { PirCasePage } from './pages/PirCasePage';
import { JointCasePage } from './pages/JointCasePage';
import { CsiCasePage } from './pages/CsiCasePage';
import { ComparisonPage } from './pages/ComparisonPage';

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
              <Route path="case/csi_router" element={<CsiCasePage />} />
              <Route path="case/combined" element={<JointCasePage />} />
              <Route path="comparison" element={<ComparisonPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TelemetryProvider>
    </ThemeProvider>
  );
}
