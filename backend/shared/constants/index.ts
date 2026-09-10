export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  MAIN_ADMIN: 'MAIN_ADMIN',
  SECTION_ADMIN: 'SECTION_ADMIN',
  FLOW_ADMIN: 'FLOW_ADMIN',
  EMPLOYEE: 'EMPLOYEE',
} as const;

export const DEFAULT_SHIFTS = [
  { name: 'Shift 1 - Early Morning', code: 'SH1', startTime: '05:00', endTime: '09:00', gracePeriod: 10, lateThreshold: 15, earlyLoginAllowance: 15 },
  { name: 'Shift 2 - Morning', code: 'SH2', startTime: '07:00', endTime: '11:00', gracePeriod: 10, lateThreshold: 15, earlyLoginAllowance: 15 },
  { name: 'Shift 3 - Late Morning', code: 'SH3', startTime: '09:00', endTime: '13:00', gracePeriod: 15, lateThreshold: 30, earlyLoginAllowance: 15 },
  { name: 'Shift 4 - Afternoon', code: 'SH4', startTime: '12:00', endTime: '16:00', gracePeriod: 15, lateThreshold: 30, earlyLoginAllowance: 15 },
  { name: 'Shift 5 - Evening', code: 'SH5', startTime: '14:00', endTime: '18:00', gracePeriod: 15, lateThreshold: 30, earlyLoginAllowance: 15 },
  { name: 'Shift 6 - Night', code: 'SH6', startTime: '18:00', endTime: '22:00', gracePeriod: 15, lateThreshold: 30, earlyLoginAllowance: 15 },
];

export const DEFAULT_FLOWS = [
  { name: 'Flow 1', code: 'FL1', sectionId: '' },
  { name: 'Flow 2', code: 'FL2', sectionId: '' },
  { name: 'Flow 3', code: 'FL3', sectionId: '' },
  { name: 'Flow 4', code: 'FL4', sectionId: '' },
  { name: 'Flow 5', code: 'FL5', sectionId: '' },
  { name: 'Flow 6', code: 'FL6', sectionId: '' },
];

export const DEFAULT_EVENTS = [
  { name: 'First Face / Login', code: 'LOGIN', eventType: 'LOGIN', sequenceNumber: 1, required: true },
  { name: 'Lunch Out', code: 'LUNCH_OUT', eventType: 'LUNCH_OUT', sequenceNumber: 2, required: false },
  { name: 'Lunch In', code: 'LUNCH_IN', eventType: 'LUNCH_IN', sequenceNumber: 3, required: false },
  { name: 'Tea Break Out', code: 'TEA_OUT', eventType: 'TEA_OUT', sequenceNumber: 4, required: false },
  { name: 'Tea Break In', code: 'TEA_IN', eventType: 'TEA_IN', sequenceNumber: 5, required: false },
  { name: 'Final Sign Out', code: 'SIGN_OUT', eventType: 'SIGN_OUT', sequenceNumber: 6, required: true },
  { name: 'Additional Event 1', code: 'ADDITIONAL_1', eventType: 'CUSTOM', sequenceNumber: 7, required: false },
  { name: 'Additional Event 2', code: 'ADDITIONAL_2', eventType: 'CUSTOM', sequenceNumber: 8, required: false },
];

export const OFFICE_DEFAULT_LOCATION = { name: 'Main Office', latitude: 28.6139, longitude: 77.2090, geofenceRadius: 100 };

export const STATE_MACHINE_STATES = [
  'NOT_STARTED', 'LOGIN_PENDING', 'LOGGED_IN', 'LUNCH_OUT', 'LUNCH_IN',
  'TEA_OUT', 'TEA_IN', 'SIGN_OUT', 'COMPLETED'
];

export const MAX_FAILED_ATTEMPTS = 3;
export const LOCKOUT_DURATION_MINUTES = 30;
export const LIVE_DISPLAY_DURATION_MS = 120000;
export const GPS_UPDATE_INTERVAL_MS = 30000;
