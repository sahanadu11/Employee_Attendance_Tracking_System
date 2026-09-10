import axios from 'axios';
import { useAuthStore } from './store/authStore';

const API_BASE = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken } = useAuthStore.getState();
      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh-token`, { refreshToken });
        useAuthStore.getState().login(useAuthStore.getState().user!, data.data.accessToken, data.data.refreshToken);
        return api(original);
      } catch {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (email: string, password: string, role: string) => api.post('/auth/register', { email, password, role }),
  logout: () => api.post('/auth/logout'),
  refreshToken: (refreshToken: string) => api.post('/auth/refresh-token', { refreshToken }),
};

export const employeeAPI = {
  getAll: (params?: any) => api.get('/employees', { params }),
  create: (data: any) => api.post('/employees', data),
  update: (id: string, data: any) => api.put(`/employees/${id}`, data),
  toggleStatus: (id: string) => api.patch(`/employees/${id}/status`),
  getTimeline: (id: string, params?: any) => api.get(`/employees/${id}/timeline`, { params }),
};

export const attendanceAPI = {
  submit: (data: any) => api.post('/attendance', data),
  history: (params?: any) => api.get('/attendance/history', { params }),
  stats: () => api.get('/attendance/stats'),
  pipeline: () => api.get('/attendance/pipeline'),
};

export const gpsAPI = {
  validate: (data: any) => api.post('/gps/validate', data),
  getOffices: () => api.get('/gps/offices'),
  getLocations: (employeeId: string) => api.get(`/gps/${employeeId}`),
  getMe: () => api.get('/auth/me'),
};

export const adminAPI = {
  dashboardStats: () => api.get('/admin/stats'),
  liveEvents: (params?: any) => api.get('/admin/live-events', { params }),
  override: (eventId: string, data: any) => api.put(`/admin/attendance/${eventId}/override`, data),
};

export const reportAPI = {
  daily: (params?: any) => api.get('/reports/daily', { params }),
  weekly: (params?: any) => api.get('/reports/weekly', { params }),
  monthly: (params?: any) => api.get('/reports/monthly', { params }),
  summary: (params?: any) => api.get('/reports/summary', { params }),
};

export const securityAPI = {
  failedLogins: (params?: any) => api.get('/security/failed-logins', { params }),
  lockedAccounts: () => api.get('/security/locked-accounts'),
  dashboard: () => api.get('/security/dashboard'),
  unlock: (userId: string) => api.post(`/security/${userId}/unlock`),
};

export const auditAPI = {
  getLogs: (params?: any) => api.get('/audit', { params }),
};

export const settingsAPI = {
  getAll: () => api.get('/settings'),
  update: (data: any) => api.put('/settings', data),
};

export const eventTypeAPI = {
  getAll: () => api.get('/event-types'),
  create: (data: any) => api.post('/event-types', data),
};

export const sectionAPI = {
  getAll: () => api.get('/sections'),
  create: (data: any) => api.post('/sections', data),
  dashboard: (id: string) => api.get(`/sections/${id}/dashboard`),
};

export const flowAPI = {
  getAll: () => api.get('/flows'),
  create: (data: any) => api.post('/flows', data),
};

export const shiftAPI = {
  getAll: () => api.get('/shifts'),
};

export const breakAPI = {
  start: (data: any) => api.post('/breaks', data),
  end: (breakRecordId: string) => api.put(`/breaks/${breakRecordId}/end`),
};

export const dashboardAPI = {
  overview: () => api.get('/dashboard/overview'),
  realtime: (params?: any) => api.get('/dashboard/realtime', { params }),
  sections: () => api.get('/dashboard/sections'),
  flows: (params?: any) => api.get('/dashboard/flows', { params }),
  shifts: (params?: any) => api.get('/dashboard/shifts', { params }),
  employees: (params?: any) => api.get('/dashboard/employees', { params }),
  attendance: (params?: any) => api.get('/dashboard/attendance', { params }),
  late: (params?: any) => api.get('/dashboard/late', { params }),
  breaks: () => api.get('/dashboard/breaks'),
  gps: () => api.get('/dashboard/gps'),
  geofence: () => api.get('/dashboard/geofence'),
  events: () => api.get('/dashboard/events'),
  security: () => api.get('/dashboard/security'),
  audit: (params?: any) => api.get('/dashboard/audit', { params }),
  notifications: (params?: any) => api.get('/dashboard/notifications', { params }),
  acknowledgeNotification: (id: string) => api.patch(`/dashboard/notifications/${id}/acknowledge`),
  sessions: () => api.get('/dashboard/sessions'),
  revokeSession: (id: string) => api.post(`/dashboard/sessions/${id}/revoke`),
  systemHealth: () => api.get('/dashboard/system-health'),
};

export const lockAPI = {
  lockedAccounts: () => api.get('/security/locked-accounts'),
  unlock: (userId: string) => api.post(`/security/${userId}/unlock`),
};

export const userAPI = {
  register: (data: any) => api.post('/auth/register', data),
};
