import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { StoreProvider } from './state/store';
import { Dashboard } from './pages/Dashboard';
import { Queue } from './pages/Queue';
import { TicketPage } from './pages/TicketPage';
import { DirectoryPage } from './pages/Directory';
import { ServerRoom } from './pages/ServerRoom';
import { RemoteDesktop } from './pages/RemoteDesktop';
import { Deployment } from './pages/Deployment';
import { TicketReview } from './pages/TicketReview';
import { ShiftPage } from './pages/Shift';
import { CallsPage } from './pages/Calls';
import { CallSession } from './pages/CallSession';
import { InterviewPage } from './pages/Interview';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { ProgressPage } from './pages/Progress';
import { Builder } from './pages/Builder';
import { SettingsPage } from './pages/Settings';

export function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="tickets" element={<Queue />} />
            <Route path="ticket/:id" element={<TicketPage />} />
            <Route path="directory" element={<DirectoryPage />} />
            <Route path="directory/:username" element={<DirectoryPage />} />
            <Route path="servers" element={<ServerRoom />} />
            <Route path="devices" element={<RemoteDesktop />} />
            <Route path="devices/:hostname" element={<RemoteDesktop />} />
            <Route path="deploy" element={<Deployment />} />
            <Route path="review/:attemptId" element={<TicketReview />} />
            <Route path="shift" element={<ShiftPage />} />
            <Route path="calls" element={<CallsPage />} />
            <Route path="call/:id" element={<CallSession />} />
            <Route path="interview" element={<InterviewPage />} />
            <Route path="kb" element={<KnowledgeBase />} />
            <Route path="kb/:id" element={<KnowledgeBase />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="builder" element={<Builder />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  );
}
