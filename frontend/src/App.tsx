import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { RealtimeProvider } from './services/realtime';
import LoginPage from './pages/auth/LoginPage';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import CommandCenter from './pages/admin/CommandCenter';
import LiveMonitor from './pages/admin/LiveMonitor';
import PhotoMonitor from './pages/admin/PhotoMonitor';
import EmployeesPage from './pages/admin/EmployeesPage';
import { SectionsDashboard, FlowsDashboard } from './pages/admin/SectionFlowDashboards';
import ShiftsDashboard from './pages/admin/ShiftsDashboard';
import AttendanceDashboard from './pages/admin/AttendanceDashboard';
import LateDashboard from './pages/admin/LateDashboard';
import BreakDashboard from './pages/admin/BreakDashboard';
import GpsDashboard from './pages/admin/GpsDashboard';
import GeofenceDashboard from './pages/admin/GeofenceDashboard';
import EventEngineDashboard from './pages/admin/EventEngineDashboard';
import SecurityDashboard from './pages/admin/SecurityDashboard';
import AuditDashboard from './pages/admin/AuditDashboard';
import ReportsPage from './pages/admin/ReportsPage';
import { NotificationsDashboard, SessionsDashboard } from './pages/admin/NotificationsSessionsDashboard';
import SystemHealthDashboard from './pages/admin/SystemHealthDashboard';
import SettingsPage from './pages/admin/SettingsPage';

import EmployeeLayout from './pages/employee/EmployeeLayout';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import EmployeeAttendance from './pages/employee/EmployeeAttendance';
import EmployeeBreaks from './pages/employee/EmployeeBreaks';
import EmployeeLocation from './pages/employee/EmployeeLocation';
import EmployeeProfile from './pages/employee/EmployeeProfile';
import EmployeeSecurity from './pages/employee/EmployeeSecurity';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function AdminRoutes() {
  return (
    <Routes>
      <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route path="/" element={<CommandCenter />} />
        <Route path="monitor" element={<LiveMonitor />} />
        <Route path="photo-monitor" element={<PhotoMonitor />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="sections" element={<SectionsDashboard />} />
        <Route path="flows" element={<FlowsDashboard />} />
        <Route path="shifts" element={<ShiftsDashboard />} />
        <Route path="attendance" element={<AttendanceDashboard />} />
        <Route path="late" element={<LateDashboard />} />
        <Route path="breaks-dash" element={<BreakDashboard />} />
        <Route path="gps" element={<GpsDashboard />} />
        <Route path="geofence" element={<GeofenceDashboard />} />
        <Route path="events" element={<EventEngineDashboard />} />
        <Route path="security" element={<SecurityDashboard />} />
        <Route path="audit" element={<AuditDashboard />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="notifications" element={<NotificationsDashboard />} />
        <Route path="sessions" element={<SessionsDashboard />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="system-health" element={<SystemHealthDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function EmployeeRoutes() {
  return (
    <Routes>
      <Route element={<ProtectedRoute><EmployeeLayout /></ProtectedRoute>}>
        <Route path="/" element={<EmployeeDashboard />} />
        <Route path="attendance" element={<EmployeeAttendance />} />
        <Route path="breaks" element={<EmployeeBreaks />} />
        <Route path="location" element={<EmployeeLocation />} />
        <Route path="profile" element={<EmployeeProfile />} />
        <Route path="security" element={<EmployeeSecurity />} />
      </Route>
      <Route path="*" element={<Navigate to="/employee" replace />} />
    </Routes>
  );
}

function AppContent() {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return user?.role === 'EMPLOYEE' ? <EmployeeRoutes /> : <AdminRoutes />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <BrowserRouter>
          <AppContent />
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#101b30', color: '#e8eef8', border: '1px solid #2a3b5c', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 },
            }}
          />
        </BrowserRouter>
      </RealtimeProvider>
    </QueryClientProvider>
  );
}

export default App;
