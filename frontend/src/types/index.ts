export interface User {
  _id: string;
  id?: string;
  email: string;
  role: string;
  employeeId?: string;
  sectionId?: string;
  flowId?: string;
  isActive: boolean;
}

export interface Employee {
  _id: string;
  employeeId: string;
  fullName: string;
  photo?: string;
  phone: string;
  email: string;
  department: string;
  sectionId: any;
  flowId: any;
  shiftId: any;
  jobTitle: string;
  employmentStatus: string;
  isActive: boolean;
}

export interface AttendanceEvent {
  _id: string;
  employeeId: any;
  eventTypeId: any;
  status: string;
  scheduledTime?: string;
  actualTime: string;
  lateDurationMinutes?: number;
  gpsStatus: string;
  gpsAccuracy?: number;
  photoUrl?: string;
  notes?: string;
}

export interface DashboardStats {
  totalEmployees: number;
  present: number;
  late: number;
  absent: number;
  onBreak: number;
  outsideGeofence: number;
  gpsIssues: number;
  lockedAccounts: number;
}

export interface LiveEvent {
  employeeName: string;
  employeeId: string;
  employeePhoto?: string;
  section: string;
  flow: string;
  shift: string;
  event: string;
  status: string;
  scheduledTime?: string;
  actualTime: string;
  lateDurationMinutes?: number;
  gpsStatus: string;
  gpsAccuracy?: number;
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  code?: string;
}
