import { EmployeeModel } from '../models/Employee';
import { AttendanceEventModel } from '../models/AttendanceEvent';
import { AttendanceEventTypeModel } from '../models/AttendanceEventType';
import { SectionModel } from '../models/Section';
import { FlowModel } from '../models/Flow';
import { ShiftModel } from '../models/Shift';
import { UserModel } from '../models/User';
import { BreakRecordModel } from '../models/BreakRecord';
import { OfficeLocationModel } from '../models/OfficeLocation';
import { EmployeeLocationModel } from '../models/EmployeeLocation';
import { SecurityEventModel } from '../models/SecurityEvent';
import { AuditLogModel } from '../models/AuditLog';
import { NotificationModel } from '../models/Notification';
import { DeviceSessionModel } from '../models/DeviceSession';
import { SystemSettingModel } from '../models/SystemSetting';
import { haversineDistance } from '../utils/helpers';

export interface DashboardUser {
  _id: any;
  role: string;
  sectionId?: any;
  flowId?: any;
  employeeId?: string;
}

export interface ScopeFilter {
  allSections: boolean;
  sectionIds?: any[];
  flowIds?: any[];
  employeeId?: string;
}

/** Resolve which sections/flows/employees the caller may see. */
export function resolveScope(user: DashboardUser): ScopeFilter {
  switch (user.role) {
    case 'SUPER_ADMIN':
    case 'MAIN_ADMIN':
      return { allSections: true };
    case 'SECTION_ADMIN':
      return { allSections: false, sectionIds: user.sectionId ? [user.sectionId] : [] };
    case 'FLOW_ADMIN':
      return { allSections: false, flowIds: user.flowId ? [user.flowId] : [] };
    default:
      return { allSections: false, employeeId: user.employeeId };
  }
}

function dayBounds(date = new Date()): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function daysAgoStart(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

async function buildEventQuery(user: DashboardUser, extra: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const scope = resolveScope(user);
  const query: Record<string, unknown> = { ...extra };
  if (!scope.allSections) {
    if (scope.employeeId) {
      const emp = await EmployeeModel.findOne({ employeeId: scope.employeeId }).select('_id');
      query.employeeId = emp?._id ?? new (require('mongoose').Types.ObjectId)();
    }
    if (scope.sectionIds) query.sectionId = { $in: scope.sectionIds };
    if (scope.flowIds) query.flowId = { $in: scope.flowIds };
  }
  return query;
}

/** Per-employee classification for a given date (defaults to today). */
async function employeeDayStates(user: DashboardUser, extraEmployeeQuery: Record<string, unknown> = {}, date: Date = new Date()) {
  const scope = resolveScope(user);
  const empQuery: Record<string, unknown> = { ...extraEmployeeQuery };
  if (!scope.allSections) {
    if (scope.employeeId) empQuery.employeeId = scope.employeeId;
    if (scope.sectionIds) empQuery.sectionId = { $in: scope.sectionIds };
    if (scope.flowIds) empQuery.flowId = { $in: scope.flowIds };
  }

  const employees = await EmployeeModel.find(empQuery)
    .populate('sectionId', 'name code')
    .populate('flowId', 'name code')
    .populate('shiftId', 'name code startTime endTime')
    .lean();

  const { start, end } = dayBounds(date);
  const empObjectIds = employees.map((e: any) => e._id);
  const todayEvents = await AttendanceEventModel.find({
    employeeId: { $in: empObjectIds },
    actualTime: { $gte: start, $lt: end },
  })
    .populate('eventTypeId', 'name code eventType sequenceNumber')
    .sort({ actualTime: 1 })
    .lean();

  const byEmployee = new Map<string, any[]>();
  for (const ev of todayEvents) {
    const key = String(ev.employeeId);
    if (!byEmployee.has(key)) byEmployee.set(key, []);
    byEmployee.get(key)!.push(ev);
  }

  const states = employees.map((emp: any) => {
    const events = byEmployee.get(String(emp._id)) || [];
    const login = events.find((e: any) => {
      const t = (e.eventTypeId as any)?.eventType || (e.eventTypeId as any)?.code;
      return t === 'LOGIN' || t === 'MORNING_IN';
    });
    const signOut = [...events].reverse().find((e: any) => {
      const t = (e.eventTypeId as any)?.eventType || (e.eventTypeId as any)?.code;
      return t === 'SIGN_OUT' || t === 'EVENING_OUT';
    });
    const last = events[events.length - 1];
    const lastType = last ? (last.eventTypeId as any)?.eventType || (last.eventTypeId as any)?.code : undefined;

    let state: 'ABSENT' | 'PRESENT' | 'LATE' | 'ON_LUNCH' | 'ON_TEA' | 'SIGNED_OUT';
    if (!login) state = 'ABSENT';
    else if (signOut) state = 'SIGNED_OUT';
    else if (lastType === 'LUNCH_OUT') state = 'ON_LUNCH';
    else if (lastType === 'TEA_OUT') state = 'ON_TEA';
    else if (login.status === 'LATE' || login.status === 'GRACE_PERIOD') state = 'LATE';
    else state = 'PRESENT';

    const openBreak = events.length > 0 && (lastType === 'LUNCH_OUT' || lastType === 'TEA_OUT');

    return {
      employee: {
        _id: emp._id,
        employeeId: emp.employeeId,
        fullName: emp.fullName,
        photo: emp.photo || null,
        department: emp.department,
        jobTitle: emp.jobTitle,
        section: (emp.sectionId as any)?.name || '—',
        sectionId: emp.sectionId?._id ?? emp.sectionId,
        flow: (emp.flowId as any)?.name || '—',
        flowId: emp.flowId?._id ?? emp.flowId,
        shift: (emp.shiftId as any)?.name || '—',
        shiftId: emp.shiftId?._id ?? emp.shiftId,
        shiftTime: (emp.shiftId as any) ? `${(emp.shiftId as any).startTime}–${(emp.shiftId as any).endTime}` : '—',
        isActive: emp.isActive,
      },
      state,
      eventsCount: events.length,
      scheduledLogin: emp.shiftId ? (emp.shiftId as any).startTime : undefined,
      actualLogin: login?.actualTime,
      loginStatus: login?.status,
      lateMinutes: login?.lateDurationMinutes || 0,
      lastEvent: last
        ? {
            name: (last.eventTypeId as any)?.name || 'Event',
            code: lastType,
            time: last.actualTime,
            status: last.status,
            gpsStatus: last.gpsStatus,
            gpsAccuracy: last.gpsAccuracy,
          }
        : null,
      onBreak: openBreak,
      gpsStatus: last?.gpsStatus || 'UNAVAILABLE',
    };
  });

  return states;
}

function countStates(states: ReturnType<typeof Object>[]): Record<string, number> {
  const counts: Record<string, number> = {
    total: states.length,
    present: 0,
    late: 0,
    absent: 0,
    onLunch: 0,
    onTea: 0,
    signedOut: 0,
    onBreak: 0,
    outside: 0,
    gpsIssues: 0,
  };
  for (const s of states as any[]) {
    if (s.state === 'PRESENT') counts.present += 1;
    else if (s.state === 'LATE') counts.late += 1;
    else if (s.state === 'ABSENT') counts.absent += 1;
    else if (s.state === 'ON_LUNCH') counts.onLunch += 1;
    else if (s.state === 'ON_TEA') counts.onTea += 1;
    else if (s.state === 'SIGNED_OUT') counts.signedOut += 1;
    if (s.state === 'ON_LUNCH' || s.state === 'ON_TEA') counts.onBreak += 1;
    if (s.gpsStatus === 'OUTSIDE') counts.outside += 1;
    if (s.gpsStatus === 'OUTSIDE' || s.gpsStatus === 'INACCURATE' || s.gpsStatus === 'UNAVAILABLE' || s.gpsStatus === 'PERMISSION_DENIED') counts.gpsIssues += 1;
  }
  return counts;
}

export class DashboardService {
  /** GET /dashboard/overview */
  async getOverview(user: DashboardUser) {
    const states = await employeeDayStates(user);
    const counts = countStates(states);
    const { start, end } = dayBounds();

    const [lockedAccounts, pendingExceptions, hourly, shiftRows, flowRows, sectionRows] = await Promise.all([
      UserModel.countDocuments({ lockedUntil: { $gt: new Date() }, isActive: true }),
      AttendanceEventModel.countDocuments({
        ...(await buildEventQuery(user, { status: { $in: ['BLOCKED', 'GPS_FAILURE', 'INVALID', 'SECURITY_LOCK'] } })),
        actualTime: { $gte: start, $lt: end },
      }),
      AttendanceEventModel.aggregate([
        { $match: { ...(await buildEventQuery(user)), actualTime: { $gte: start, $lt: end }, status: { $nin: ['INVALID', 'BLOCKED', 'GPS_FAILURE'] } } },
        { $group: { _id: { hour: { $hour: '$actualTime' } }, count: { $sum: 1 }, late: { $sum: { $cond: [{ $in: ['$status', ['LATE', 'GRACE_PERIOD']] }, 1, 0] } } } },
        { $sort: { '_id.hour': 1 } },
      ]),
      AttendanceEventModel.aggregate([
        { $match: { ...(await buildEventQuery(user, { actualTime: { $gte: start, $lt: end }, status: { $nin: ['INVALID'] } })) } },
        { $group: { _id: '$shiftId', count: { $sum: 1 }, late: { $sum: { $cond: [{ $in: ['$status', ['LATE', 'GRACE_PERIOD']] }, 1, 0] } } } },
      ]),
      AttendanceEventModel.aggregate([
        { $match: { ...(await buildEventQuery(user, { actualTime: { $gte: start, $lt: end }, status: { $nin: ['INVALID'] } })) } },
        { $group: { _id: '$flowId', count: { $sum: 1 }, late: { $sum: { $cond: [{ $in: ['$status', ['LATE', 'GRACE_PERIOD']] }, 1, 0] } } } },
      ]),
      SectionModel.find(scopeAllowsSections(user) ? {} : sectionFilter(user)).select('name code').lean(),
    ]);

    // Previous-day comparison for trend deltas (yesterday's state, yesterday's events)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const prevCounts = countStates(await employeeDayStates(user, {}, yesterday));

    const shiftIds: any[] = shiftRows.map((r: any) => r._id).filter(Boolean);
    const flowIds: any[] = flowRows.map((r: any) => r._id).filter(Boolean);
    const [shiftDocs, flowDocs] = await Promise.all([
      shiftIds.length ? ShiftModel.find({ _id: { $in: shiftIds } }).select('name code startTime endTime').lean() : Promise.resolve([] as any[]),
      flowIds.length ? FlowModel.find({ _id: { $in: flowIds } }).select('name code').lean() : Promise.resolve([] as any[]),
    ]);
    const shiftMap = new Map<string, any>(shiftDocs.map((s: any) => [String(s._id), s] as [string, any]));
    const flowMap = new Map<string, any>(flowDocs.map((f: any) => [String(f._id), f] as [string, any]));

    const latest = await this.getRealtimeEvents(user, 12);

    return {
      cards: {
        totalEmployees: counts.total,
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        onLunch: counts.onLunch,
        onTea: counts.onTea,
        onBreak: counts.onBreak,
        signedOut: counts.signedOut,
        outsideGeofence: counts.outside,
        gpsIssues: counts.gpsIssues,
        lockedAccounts,
        pendingExceptions,
      },
      trends: {
        presentDelta: pctDelta(counts.present, prevCounts.present),
        lateDelta: pctDelta(counts.late, prevCounts.late),
        absentDelta: pctDelta(counts.absent, prevCounts.absent),
        onBreakDelta: pctDelta(counts.onBreak, prevCounts.onBreak),
      },
      charts: {
        hourly: hourly.map((h: any) => ({ hour: h._id.hour, count: h.count, late: h.late })),
        byShift: shiftRows.map((r: any) => ({ label: shiftMap.get(String(r._id))?.name || 'Unknown', count: r.count, late: r.late })),
        byFlow: flowRows.map((r: any) => ({ label: flowMap.get(String(r._id))?.name || 'Unknown', count: r.count, late: r.late })),
        bySection: sectionRows.map((s: any) => ({ label: s.name, id: s._id })),
      },
      latestEvents: latest,
    };
  }

  /** GET /dashboard/realtime — recent events feed (scoped). */
  async getRealtimeEvents(user: DashboardUser, limit = 30, filters: Record<string, unknown> = {}) {
    const base = await buildEventQuery(user);
    const query = { ...base, ...filters };
    const events = await AttendanceEventModel.find(query)
      .sort({ actualTime: -1 })
      .limit(Math.min(limit, 100))
      .populate('employeeId', 'fullName employeeId photo department jobTitle sectionId flowId shiftId')
      .populate('eventTypeId', 'name code eventType sequenceNumber')
      .populate('shiftId', 'name code startTime endTime')
      .populate('sectionId', 'name code')
      .populate('flowId', 'name code')
      .lean();

    return events.map((e: any) => ({
      _id: e._id,
      employeeDbId: e.employeeId?._id,
      employeeName: e.employeeId?.fullName || 'Unknown',
      employeeCode: e.employeeId?.employeeId || '—',
      employeePhoto: e.employeeId?.photo || null,
      section: e.sectionId?.name || e.employeeId?.sectionId?.name || '—',
      flow: e.flowId?.name || e.employeeId?.flowId?.name || '—',
      shift: e.shiftId?.name || '—',
      shiftTime: e.shiftId ? `${e.shiftId.startTime}–${e.shiftId.endTime}` : '—',
      event: e.eventTypeId?.name || 'Event',
      eventCode: e.eventTypeId?.eventType || e.eventTypeId?.code,
      sequenceNumber: e.eventTypeId?.sequenceNumber,
      status: e.status,
      scheduledTime: e.scheduledTime,
      actualTime: e.actualTime,
      lateDurationMinutes: e.lateDurationMinutes,
      gpsStatus: e.gpsStatus,
      gpsAccuracy: e.gpsAccuracy,
      latitude: e.latitude,
      longitude: e.longitude,
      faceVerificationResult: e.faceVerificationResult,
      deviceInfo: e.deviceInfo,
      notes: e.notes,
      isAdminOverride: e.isAdminOverride,
      photoUrl: e.photoUrl,
    }));
  }

  /** GET /dashboard/sections */
  async getSectionDashboard(user: DashboardUser) {
    const scope = resolveScope(user);
    const sections = await SectionModel.find(scopeAllowsSections(user) ? {} : sectionFilter(user))
      .populate('adminIds', 'email role')
      .lean();

    const states = await employeeDayStates(user);
    const results: any[] = [];
    for (const section of sections) {
      const secStates = states.filter((s: any) => String(s.employee.sectionId) === String(section._id));
      const counts = countStates(secStates);
      const flows = await FlowModel.countDocuments({ sectionId: section._id });
      results.push({
        _id: section._id,
        name: section.name,
        code: section.code,
        admins: (section.adminIds as any[])?.map((a: any) => ({ email: a.email, role: a.role })) || [],
        employeeCount: counts.total,
        flowCount: flows,
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        onBreak: counts.onBreak,
        outside: counts.outside,
        gpsIssues: counts.gpsIssues,
        completionPct: counts.total ? Math.round(((counts.present + counts.late + counts.signedOut) / counts.total) * 100) : 0,
      });
    }
    return results;
  }

  /** GET /dashboard/flows — six-flow overview + per-flow detail. */
  async getFlowDashboard(user: DashboardUser, flowId?: string) {
    const scope = resolveScope(user);
    const flowQuery: Record<string, unknown> = {};
    if (flowId) flowQuery._id = flowId;
    if (!scope.allSections) {
      if (scope.flowIds) flowQuery._id = { ...(flowQuery._id ? { $in: [flowId] } : {}), ...(scope.flowIds.length ? { $in: scope.flowIds } : {}) };
      if (scope.sectionIds) flowQuery.sectionId = { $in: scope.sectionIds };
    }
    const flows = await FlowModel.find(flowQuery).populate('sectionId', 'name code').populate('adminIds', 'email').lean();
    const states = await employeeDayStates(user);

    return Promise.all(
      flows.map(async (flow: any) => {
        const flowStates = states.filter((s: any) => String(s.employee.flowId) === String(flow._id));
        const counts = countStates(flowStates);
        const shiftIds = [...new Set(flowStates.map((s: any) => String(s.employee.shiftId)).filter((x) => x && x !== 'undefined'))];
        const shifts = shiftIds.length ? await ShiftModel.find({ _id: { $in: shiftIds } }).select('name code startTime endTime').lean() : [];
        return {
          _id: flow._id,
          name: flow.name,
          code: flow.code,
          section: (flow.sectionId as any)?.name || '—',
          sectionId: flow.sectionId?._id ?? flow.sectionId,
          admins: (flow.adminIds as any[])?.map((a: any) => a.email) || [],
          locationPolicy: flow.locationPolicy,
          attendanceSequence: flow.attendanceSequence || [],
          status: flow.status,
          employeeCount: counts.total,
          present: counts.present,
          late: counts.late,
          absent: counts.absent,
          onBreak: counts.onBreak,
          outside: counts.outside,
          gpsIssues: counts.gpsIssues,
          signedOut: counts.signedOut,
          completionPct: counts.total ? Math.round(((counts.present + counts.late + counts.signedOut) / counts.total) * 100) : 0,
          shifts,
          employees: flowStates.map((s: any) => ({
            employee: s.employee,
            state: s.state,
            lastEvent: s.lastEvent,
            lastEventTime: s.lastEvent?.time,
            gpsStatus: s.gpsStatus,
            lateMinutes: s.lateMinutes,
          })),
        };
      })
    );
  }

  /** GET /dashboard/shifts */
  async getShiftDashboard(user: DashboardUser, shiftId?: string) {
    const scope = resolveScope(user);
    const shiftQuery: Record<string, unknown> = {};
    if (shiftId) shiftQuery._id = shiftId;
    if (scope.sectionIds && scope.sectionIds.length) shiftQuery.sectionIds = { $in: scope.sectionIds };
    if (scope.flowIds && scope.flowIds.length) shiftQuery.flowIds = { $in: scope.flowIds };
    const shifts = await ShiftModel.find(shiftQuery).sort({ startTime: 1 }).lean();
    const states = await employeeDayStates(user);

    return shifts.map((shift: any) => {
      const shiftStates = states.filter((s: any) => String(s.employee.shiftId) === String(shift._id));
      const counts = countStates(shiftStates);
      return {
        _id: shift._id,
        name: shift.name,
        code: shift.code,
        startTime: shift.startTime,
        endTime: shift.endTime,
        gracePeriodMinutes: shift.gracePeriodMinutes,
        lateThresholdMinutes: shift.lateThresholdMinutes,
        earlyLoginAllowanceMinutes: shift.earlyLoginAllowanceMinutes,
        lunchAllowed: shift.lunchPolicy?.allowedDurationMinutes,
        teaAllowed: shift.teaBreakPolicy?.allowedDurationMinutes,
        gpsPolicy: shift.gpsPolicy,
        isActive: shift.isActive,
        scheduleDays: shift.scheduleDays,
        employeeCount: counts.total,
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        onBreak: counts.onBreak,
        signedOut: counts.signedOut,
        gpsIssues: counts.gpsIssues,
        completionPct: counts.total ? Math.round(((counts.present + counts.late + counts.signedOut) / counts.total) * 100) : 0,
        employees: shiftStates.map((s: any) => ({
          employee: s.employee,
          state: s.state,
          actualLogin: s.actualLogin,
          lateMinutes: s.lateMinutes,
          lastEvent: s.lastEvent,
          gpsStatus: s.gpsStatus,
        })),
      };
    });
  }

  /** GET /dashboard/employees — photo monitor grid data. */
  async getEmployeeGrid(user: DashboardUser, filters: { search?: string; state?: string; sectionId?: string; flowId?: string; shiftId?: string; limit?: number; page?: number }) {
    const empQuery: Record<string, unknown> = {};
    if (filters.search) {
      const rx = new RegExp(escapeRegex(filters.search), 'i');
      empQuery.$or = [{ fullName: rx }, { employeeId: rx }, { department: rx }];
    }
    if (filters.sectionId) empQuery.sectionId = filters.sectionId;
    if (filters.flowId) empQuery.flowId = filters.flowId;
    if (filters.shiftId) empQuery.shiftId = filters.shiftId;

    const states = await employeeDayStates(user, empQuery);
    const filtered = filters.state && filters.state !== 'ALL' ? states.filter((s: any) => s.state === filters.state) : states;
    const limit = Math.min(filters.limit || 60, 200);
    const page = filters.page || 1;
    const start = (page - 1) * limit;

    const counts = countStates(states);
    return {
      cards: filtered.slice(start, start + limit).map((s: any) => ({
        employee: s.employee,
        state: s.state,
        lastEvent: s.lastEvent,
        scheduledLogin: s.scheduledLogin,
        actualLogin: s.actualLogin,
        lateMinutes: s.lateMinutes,
        gpsStatus: s.gpsStatus,
        onBreak: s.onBreak,
        eventsCount: s.eventsCount,
      })),
      counts,
      total: filtered.length,
      page,
      limit,
    };
  }

  /** GET /dashboard/attendance — status summary + trends for attendance dashboard. */
  async getAttendanceDashboard(user: DashboardUser, filters: { fromDate?: string; toDate?: string; shiftId?: string; flowId?: string; sectionId?: string }) {
    const { start, end } = dayBounds(filters.fromDate ? new Date(filters.fromDate) : new Date());
    const extra: Record<string, unknown> = {};
    if (filters.shiftId) extra.shiftId = filters.shiftId;
    if (filters.flowId) extra.flowId = filters.flowId;
    if (filters.sectionId) extra.sectionId = filters.sectionId;
    if (filters.toDate) {
      extra.actualTime = { $gte: start, $lt: new Date(new Date(filters.toDate).setHours(23, 59, 59, 999)) };
    } else {
      extra.actualTime = { $gte: start, $lt: end };
    }

    const base = await buildEventQuery(user, extra);
    const [statusRows, total, daily, lateRows, avgLate] = await Promise.all([
      AttendanceEventModel.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      AttendanceEventModel.countDocuments(base),
      AttendanceEventModel.aggregate([
        { $match: await buildEventQuery(user, { actualTime: { $gte: daysAgoStart(13) } }) },
        {
          $group: {
            _id: { y: { $year: '$actualTime' }, m: { $month: '$actualTime' }, d: { $dayOfMonth: '$actualTime' } },
            count: { $sum: 1 },
            late: { $sum: { $cond: [{ $in: ['$status', ['LATE', 'GRACE_PERIOD']] }, 1, 0] } },
            present: { $sum: { $cond: [{ $in: ['$status', ['ON_TIME', 'EARLY']] }, 1, 0] } },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } },
      ]),
      AttendanceEventModel.aggregate([
        { $match: { ...base, status: { $in: ['LATE', 'GRACE_PERIOD'] } } },
        { $group: { _id: '$employeeId', minutes: { $max: '$lateDurationMinutes' } } },
        { $group: { _id: null, avg: { $avg: '$minutes' }, count: { $sum: 1 } } },
      ]),
      AttendanceEventModel.aggregate([
        { $match: { ...base, status: { $in: ['LATE', 'GRACE_PERIOD'] } } },
        { $group: { _id: '$flowId', count: { $sum: 1 }, avgLate: { $avg: '$lateDurationMinutes' } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const statusMap: Record<string, number> = {};
    statusRows.forEach((r: any) => { statusMap[r._id] = r.count; });
    const flowDocs = lateRows.length ? await FlowModel.find({ _id: { $in: lateRows.map((r: any) => r._id) } }).select('name code').lean() : [];
    const flowMap = new Map<string, any>(flowDocs.map((f: any) => [String(f._id), f] as [string, any]));

    return {
      total,
      statuses: statusMap,
      present: (statusMap['ON_TIME'] || 0) + (statusMap['EARLY'] || 0),
      late: (statusMap['LATE'] || 0) + (statusMap['GRACE_PERIOD'] || 0),
      absent: statusMap['MISSED'] || 0,
      invalid: statusMap['INVALID'] || 0,
      blocked: statusMap['BLOCKED'] || 0,
      gpsFailure: statusMap['GPS_FAILURE'] || 0,
      avgLateMinutes: Math.round(lateRows.length ? lateRows.reduce((a: number, r: any) => a + r.count, 0) && (avgLate[0]?.avg || 0) : 0),
      daily: daily.map((d: any) => ({ date: `${d._id.y}-${String(d._id.m).padStart(2, '0')}-${String(d._id.d).padStart(2, '0')}`, count: d.count, late: d.late, present: d.present })),
      lateByFlow: lateRows.map((r: any) => ({ label: flowMap.get(String(r._id))?.name || 'Unknown', count: r.count, avgLate: Math.round(r.avgLate || 0) })),
    };
  }

  /** GET /dashboard/late — dedicated late-attendance dashboard. */
  async getLateDashboard(user: DashboardUser, filters: { sortBy?: string; limit?: number }) {
    const { start, end } = dayBounds();
    const base = await buildEventQuery(user, {
      actualTime: { $gte: start, $lt: end },
      status: { $in: ['LATE', 'GRACE_PERIOD'] },
    });
    const events = await AttendanceEventModel.find(base)
      .sort({ lateDurationMinutes: filters.sortBy === 'least' ? 1 : -1 })
      .limit(Math.min(filters.limit || 50, 200))
      .populate('employeeId', 'fullName employeeId photo department jobTitle sectionId flowId shiftId')
      .populate('eventTypeId', 'name code eventType')
      .populate('shiftId', 'name code startTime endTime')
      .populate('sectionId', 'name code')
      .populate('flowId', 'name code')
      .lean();

    const [bySection, byFlow, byShift, avgAgg] = await Promise.all([
      AttendanceEventModel.aggregate([{ $match: base }, { $group: { _id: '$sectionId', count: { $sum: 1 }, avg: { $avg: '$lateDurationMinutes' } } }]),
      AttendanceEventModel.aggregate([{ $match: base }, { $group: { _id: '$flowId', count: { $sum: 1 }, avg: { $avg: '$lateDurationMinutes' } } }]),
      AttendanceEventModel.aggregate([{ $match: base }, { $group: { _id: '$shiftId', count: { $sum: 1 }, avg: { $avg: '$lateDurationMinutes' } } }]),
      AttendanceEventModel.aggregate([{ $match: base }, { $group: { _id: null, avg: { $avg: '$lateDurationMinutes' }, max: { $max: '$lateDurationMinutes' } } }]),
    ]);

    const [sectionDocs, flowDocs, shiftDocs] = await Promise.all([
      SectionModel.find({ _id: { $in: bySection.map((r: any) => r._id).filter(Boolean) } }).select('name').lean(),
      FlowModel.find({ _id: { $in: byFlow.map((r: any) => r._id).filter(Boolean) } }).select('name').lean(),
      ShiftModel.find({ _id: { $in: byShift.map((r: any) => r._id).filter(Boolean) } }).select('name').lean(),
    ]);
    const label = (docs: any[], id: any) => docs.find((d: any) => String(d._id) === String(id))?.name || 'Unknown';

    return {
      count: events.length,
      avgLateMinutes: Math.round(avgAgg[0]?.avg || 0),
      maxLateMinutes: Math.round(avgAgg[0]?.max || 0),
      employees: events.map((e: any) => ({
        _id: e._id,
        employeeName: e.employeeId?.fullName,
        employeeCode: e.employeeId?.employeeId,
        photo: e.employeeId?.photo,
        section: e.sectionId?.name || e.employeeId?.sectionId?.name,
        flow: e.flowId?.name || e.employeeId?.flowId?.name,
        shift: e.shiftId?.name,
        shiftTime: e.shiftId ? `${e.shiftId.startTime}–${e.shiftId.endTime}` : undefined,
        event: e.eventTypeId?.name,
        status: e.status,
        scheduledTime: e.scheduledTime,
        actualTime: e.actualTime,
        lateMinutes: e.lateDurationMinutes,
        gpsStatus: e.gpsStatus,
        gpsAccuracy: e.gpsAccuracy,
      })),
      bySection: bySection.map((r: any) => ({ label: label(sectionDocs, r._id), count: r.count, avg: Math.round(r.avg || 0) })),
      byFlow: byFlow.map((r: any) => ({ label: label(flowDocs, r._id), count: r.count, avg: Math.round(r.avg || 0) })),
      byShift: byShift.map((r: any) => ({ label: label(shiftDocs, r._id), count: r.count, avg: Math.round(r.avg || 0) })),
    };
  }

  /** GET /dashboard/breaks — lunch & tea break monitoring. */
  async getBreakDashboard(user: DashboardUser) {
    const { start, end } = dayBounds();
    const base = await buildEventQuery(user);
    const match = { ...base, breakStart: { $gte: start, $lt: end } };
    const employeeMatch = Object.keys(base).includes('employeeId') ? { employeeId: base.employeeId } : {};

    const [breaks, activeBreaks, agg] = await Promise.all([
      BreakRecordModel.find(match)
        .sort({ breakStart: -1 })
        .limit(100)
        .populate('employeeId', 'fullName employeeId photo department sectionId flowId shiftId')
        .populate('eventTypeId', 'name code eventType')
        .populate('shiftId', 'name startTime endTime lunchPolicy teaBreakPolicy')
        .lean(),
      BreakRecordModel.find({ ...match, breakEnd: { $exists: false } }).populate('employeeId', 'fullName employeeId photo').lean(),
      BreakRecordModel.aggregate([
        { $match: { ...match, breakEnd: { $exists: true } } },
        { $group: { _id: '$eventTypeId', count: { $sum: 1 }, avgDuration: { $avg: '$totalDurationMinutes' }, excess: { $sum: { $cond: [{ $gt: ['$excessDurationMinutes', 0] }, 1, 0] } } } },
      ]),
    ]);

    const typeDocs: any[] = agg.length ? await AttendanceEventTypeModel.find({ _id: { $in: agg.map((r: any) => r._id) } }).select('name code eventType').lean() : [];
    const typeMap = new Map<string, any>(typeDocs.map((t: any) => [String(t._id), t] as [string, any]));

    const states = await employeeDayStates(user, employeeMatch as any);
    const onBreakNow = states.filter((s: any) => s.state === 'ON_LUNCH' || s.state === 'ON_TEA');
    const missingReturn = activeBreaks.map((b: any) => ({
      breakId: b._id,
      employeeName: b.employeeId?.fullName,
      employeeCode: b.employeeId?.employeeId,
      photo: b.employeeId?.photo,
      type: (b.eventTypeId as any)?.eventType,
      breakStart: b.breakStart,
      allowedDurationMinutes: b.allowedDurationMinutes,
      elapsedMinutes: Math.round((Date.now() - new Date(b.breakStart).getTime()) / 60000),
      exceeded: Math.round((Date.now() - new Date(b.breakStart).getTime()) / 60000) > b.allowedDurationMinutes,
    }));

    return {
      currentlyOnBreak: onBreakNow.map((s: any) => ({
        employee: s.employee,
        state: s.state,
        lastEvent: s.lastEvent,
        gpsStatus: s.gpsStatus,
      })),
      missingReturn,
      totals: agg.map((r: any) => ({
        label: typeMap.get(String(r._id))?.name || 'Break',
        type: typeMap.get(String(r._id))?.eventType,
        count: r.count,
        avgDurationMinutes: Math.round(r.avgDuration || 0),
        exceededCount: r.excess,
      })),
      recent: breaks.map((b: any) => ({
        _id: b._id,
        employeeName: b.employeeId?.fullName,
        employeeCode: b.employeeId?.employeeId,
        photo: b.employeeId?.photo,
        type: (b.eventTypeId as any)?.name,
        eventType: (b.eventTypeId as any)?.eventType,
        breakStart: b.breakStart,
        breakEnd: b.breakEnd,
        totalDurationMinutes: b.totalDurationMinutes,
        allowedDurationMinutes: b.allowedDurationMinutes,
        excessDurationMinutes: b.excessDurationMinutes || 0,
        shift: (b.shiftId as any)?.name,
        gpsStatus: b.latitude !== undefined ? 'RECORDED' : 'UNAVAILABLE',
        latitude: b.latitude,
        longitude: b.longitude,
      })),
    };
  }

  /** GET /dashboard/gps — latest locations + GPS health. */
  async getGpsDashboard(user: DashboardUser) {
    const scope = resolveScope(user);
    const empQuery: Record<string, unknown> = { isActive: true };
    if (!scope.allSections) {
      if (scope.employeeId) empQuery.employeeId = scope.employeeId;
      if (scope.sectionIds) empQuery.sectionId = { $in: scope.sectionIds };
      if (scope.flowIds) empQuery.flowId = { $in: scope.flowIds };
    }
    const employees = await EmployeeModel.find(empQuery).select('_id employeeId fullName photo sectionId flowId shiftId').populate('sectionId', 'name').populate('flowId', 'name').populate('shiftId', 'name').lean();
    const empIds = employees.map((e: any) => e._id);

    const latestLocations = await EmployeeLocationModel.aggregate([
      { $match: { employeeId: { $in: empIds } } },
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$employeeId', doc: { $first: '$$ROOT' } } },
    ]);
    const locMap = new Map<string, any>(latestLocations.map((l: any) => [String(l._id), l.doc] as [string, any]));

    const office = await OfficeLocationModel.findOne({ isActive: true }).lean();
    const { start } = dayBounds();
    const todayEvents = await AttendanceEventModel.find({ employeeId: { $in: empIds }, actualTime: { $gte: start } })
      .sort({ actualTime: -1 })
      .populate('eventTypeId', 'name eventType')
      .lean();
    const lastEventByEmp = new Map<string, any>();
    for (const ev of todayEvents) {
      const k = String(ev.employeeId);
      if (!lastEventByEmp.has(k)) lastEventByEmp.set(k, ev);
    }

    const markers = employees
      .map((emp: any) => {
        const loc = locMap.get(String(emp._id));
        const lastEvent = lastEventByEmp.get(String(emp._id));
        let inside: boolean | null = null;
        let distance: number | undefined;
        if (loc && office) {
          distance = Math.round(haversineDistance(loc.doc.latitude, loc.doc.longitude, office.latitude, office.longitude));
          inside = distance <= (office.geofenceRadius || 100);
        }
        return {
          employeeDbId: emp._id,
          employeeId: emp.employeeId,
          fullName: emp.fullName,
          photo: emp.photo,
          section: (emp.sectionId as any)?.name,
          flow: (emp.flowId as any)?.name,
          shift: (emp.shiftId as any)?.name,
          location: loc
            ? {
                latitude: loc.doc.latitude,
                longitude: loc.doc.longitude,
                accuracy: loc.doc.accuracy,
                timestamp: loc.doc.timestamp,
                insideGeofence: loc.doc.insideGeofence,
              }
            : null,
          inside: inside,
          distanceFromOffice: distance,
          lastEvent: lastEvent ? { name: (lastEvent.eventTypeId as any)?.name, time: lastEvent.actualTime, gpsStatus: lastEvent.gpsStatus, gpsAccuracy: lastEvent.gpsAccuracy } : null,
        };
      })
      .filter((m: any) => m.location !== null);

    const statusCounts = { inside: 0, outside: 0, inaccurate: 0, unavailable: 0, permissionDenied: 0 };
    for (const m of markers as any[]) {
      if (m.location.accuracy > 100) statusCounts.inaccurate += 1;
      else if (m.inside === false) statusCounts.outside += 1;
      else statusCounts.inside += 1;
    }
    const noLocation = (employees as any[]).length - markers.length;
    statusCounts.unavailable = noLocation;

    const [recentGpsEvents, gpsEventCounts] = await Promise.all([
      SecurityEventModel.find({ eventType: 'GPS_SUSPICIOUS', timestamp: { $gte: daysAgoStart(1) } }).sort({ timestamp: -1 }).limit(20).populate('userId', 'email').lean(),
      SecurityEventModel.aggregate([
        { $match: { eventType: 'GPS_SUSPICIOUS', timestamp: { $gte: daysAgoStart(6) } } },
        { $group: { _id: { y: { $year: '$timestamp' }, m: { $month: '$timestamp' }, d: { $dayOfMonth: '$timestamp' } }, count: { $sum: 1 } } },
        { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } },
      ]),
    ]);

    return {
      office: office ? { name: office.name, latitude: office.latitude, longitude: office.longitude, geofenceRadius: office.geofenceRadius, isActive: office.isActive } : null,
      markers,
      statusCounts,
      gpsEvents: recentGpsEvents,
      gpsEventTrend: gpsEventCounts,
    };
  }

  /** GET /dashboard/geofence — offices with inside/outside breakdown. */
  async getGeofenceDashboard(user: DashboardUser) {
    const offices = await OfficeLocationModel.find().lean();
    const gps = await this.getGpsDashboard(user);
    return {
      offices: offices.map((o: any) => ({
        ...o,
        employeesInside: gps.markers.filter((m: any) => m.inside === true).length,
        employeesOutside: gps.markers.filter((m: any) => m.inside === false).length,
        poorAccuracy: gps.markers.filter((m: any) => m.location?.accuracy > 100).length,
      })),
      statusBreakdown: gps.statusCounts,
      markers: gps.markers,
    };
  }

  /** GET /dashboard/events — attendance event definition performance. */
  async getEventDashboard(user: DashboardUser) {
    const { start, end } = dayBounds();
    const eventTypes = await AttendanceEventTypeModel.find().sort({ sequenceNumber: 1 }).lean();
    const base = await buildEventQuery(user, { actualTime: { $gte: start, $lt: end } });
    const rows = await AttendanceEventModel.aggregate([
      { $match: base },
      {
        $group: {
          _id: '$eventTypeId',
          completed: { $sum: 1 },
          late: { $sum: { $cond: [{ $in: ['$status', ['LATE', 'GRACE_PERIOD']] }, 1, 0] } },
          gpsFailures: { $sum: { $cond: [{ $in: ['$gpsStatus', ['OUTSIDE', 'INACCURATE', 'UNAVAILABLE', 'PERMISSION_DENIED']] }, 1, 0] } },
          faceFailures: { $sum: { $cond: [{ $eq: ['$faceVerificationResult', 'FAILED'] }, 1, 0] } },
          invalid: { $sum: { $cond: [{ $in: ['$status', ['INVALID', 'BLOCKED', 'GPS_FAILURE', 'SECURITY_LOCK']] }, 1, 0] } },
        },
      },
    ]);
    const rowMap = new Map<string, any>(rows.map((r: any) => [String(r._id), r] as [string, any]));
    const totalActive = (await EmployeeModel.countDocuments({ isActive: true })) || 1;

    return eventTypes.map((et: any) => {
      const row = rowMap.get(String(et._id));
      return {
        _id: et._id,
        name: et.name,
        code: et.code,
        eventType: et.eventType,
        sequenceNumber: et.sequenceNumber,
        required: et.required,
        isActive: et.isActive,
        requiresPhoto: et.requiresPhoto,
        requiresGps: et.requiresGps,
        requiresFaceVerification: et.requiresFaceVerification,
        allowedWindowMinutes: et.allowedWindowMinutes,
        completedCount: row?.completed || 0,
        pendingCount: Math.max(0, totalActive - (row?.completed || 0)),
        lateCount: row?.late || 0,
        gpsFailures: row?.gpsFailures || 0,
        faceFailures: row?.faceFailures || 0,
        failedCount: row?.invalid || 0,
      };
    });
  }

  /** GET /dashboard/security — security overview. */
  async getSecurityDashboard(user: DashboardUser) {
    const [today, failedLogins, lockouts, suspiciousGps, unauthorized, invalidEvents, adminChanges, recentEvents] = await Promise.all([
      Promise.resolve(dayBounds()),
      SecurityEventModel.countDocuments({ eventType: 'FAILED_LOGIN', timestamp: { $gte: daysAgoStart(0) } }),
      SecurityEventModel.countDocuments({ eventType: 'LOCKOUT', timestamp: { $gte: daysAgoStart(0) } }),
      SecurityEventModel.countDocuments({ eventType: 'GPS_SUSPICIOUS', timestamp: { $gte: daysAgoStart(0) } }),
      SecurityEventModel.countDocuments({ eventType: 'UNAUTHORIZED_ACCESS', timestamp: { $gte: daysAgoStart(0) } }),
      SecurityEventModel.countDocuments({ eventType: 'INVALID_EVENT', timestamp: { $gte: daysAgoStart(0) } }),
      SecurityEventModel.countDocuments({ eventType: 'ADMIN_CHANGE', timestamp: { $gte: daysAgoStart(0) } }),
      SecurityEventModel.find().sort({ timestamp: -1 }).limit(50).populate('userId', 'email role').lean(),
    ]);

    const lockedUsers = await UserModel.find({ lockedUntil: { $gt: new Date() } })
      .select('email role failedAttempts lockedUntil sectionId flowId employeeId isActive')
      .populate('sectionId', 'name')
      .populate('flowId', 'name')
      .lean();

    const eventTrend = await SecurityEventModel.aggregate([
      { $match: { timestamp: { $gte: daysAgoStart(6) } } },
      {
        $group: {
          _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, type: '$eventType' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.d': 1 } },
    ]);

    return {
      counts: { failedLogins, lockouts, suspiciousGps, unauthorized, invalidEvents, adminChanges },
      lockedAccounts: lockedUsers.map((u: any) => ({
        _id: u._id,
        email: u.email,
        role: u.role,
        employeeCode: u.employeeId,
        section: (u.sectionId as any)?.name,
        flow: (u.flowId as any)?.name,
        failedAttempts: u.failedAttempts,
        lockedUntil: u.lockedUntil,
        lockMinutesRemaining: u.lockedUntil ? Math.max(0, Math.round((new Date(u.lockedUntil).getTime() - Date.now()) / 60000)) : 0,
      })),
      recentEvents,
      eventTrend,
    };
  }

  /** GET /dashboard/audit — audit log feed (scoped). */
  async getAuditDashboard(user: DashboardUser, filters: { page?: number; limit?: number; action?: string; search?: string }) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 25, 100);
    const query: Record<string, unknown> = {};
    if (filters.action) query.action = filters.action;
    if (filters.search) {
      const rx = new RegExp(escapeRegex(filters.search), 'i');
      query.$or = [{ action: rx }, { entity: rx }, { details: rx }];
    }
    const [logs, total, actionCounts] = await Promise.all([
      AuditLogModel.find(query).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).populate('userId', 'email role').lean(),
      AuditLogModel.countDocuments(query),
      AuditLogModel.aggregate([{ $group: { _id: '$action', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 12 }]),
    ]);
    return {
      logs: logs.map((l: any) => ({
        _id: l._id,
        user: l.userId?.email || 'SYSTEM',
        role: l.userId?.role || l.userRole || '—',
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        oldValue: l.oldValue,
        newValue: l.newValue,
        details: l.details,
        ipAddress: l.ipAddress,
        userAgent: l.userAgent,
        result: l.result,
        timestamp: l.timestamp,
      })),
      total,
      page,
      limit,
      actionCounts,
    };
  }

  /** GET /dashboard/notifications — role-aware notification feed. */
  async getNotifications(user: DashboardUser, filters: { unreadOnly?: boolean; type?: string; limit?: number }) {
    const query: Record<string, unknown> = {};
    if (filters.unreadOnly) query.isRead = false;
    if (filters.type) query.type = filters.type;
    const limit = Math.min(filters.limit || 50, 200);

    let targetUserIds: any[] | null = null;
    const scope = resolveScope(user);
    if (!scope.allSections) {
      if (scope.sectionIds && scope.sectionIds.length) {
        const users = await UserModel.find({ sectionId: { $in: scope.sectionIds } }).select('_id');
        targetUserIds = users.map((u: any) => u._id);
      }
      if (scope.employeeId) {
        const u = await UserModel.findOne({ employeeId: scope.employeeId }).select('_id');
        targetUserIds = u ? [u._id] : [];
      }
    }
    if (targetUserIds) {
      query.userId = { $in: targetUserIds };
    }

    const [notifications, total, unreadCount, typeCounts] = await Promise.all([
      NotificationModel.find(query).sort({ timestamp: -1 }).limit(limit).populate('userId', 'email role employeeId').lean(),
      NotificationModel.countDocuments(query),
      NotificationModel.countDocuments({ ...query, isRead: true ? false : false, ...(filters.unreadOnly ? {} : { isRead: false }) }),
      NotificationModel.aggregate([{ $match: query }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
    ]);

    return { notifications, total, unreadCount, typeCounts };
  }

  /** GET /dashboard/sessions — active device sessions. */
  async getSessionsDashboard(user: DashboardUser) {
    const sessions = await DeviceSessionModel.find({ isActive: true })
      .sort({ lastActivityAt: -1 })
      .limit(100)
      .populate('userId', 'email role employeeId sectionId flowId')
      .lean();
    const now = Date.now();
    return {
      sessions: sessions.map((s: any) => ({
        _id: s._id,
        user: s.userId?.email || 'Unknown',
        role: s.userId?.role,
        employeeCode: s.userId?.employeeId,
        device: s.deviceInfo,
        ipAddress: s.ipAddress,
        loginAt: s.createdAt,
        lastActivityAt: s.lastActivityAt,
        idleMinutes: Math.round((now - new Date(s.lastActivityAt).getTime()) / 60000),
        expiresAt: s.expiresAt,
      })),
      activeCount: sessions.length,
    };
  }

  /** GET /dashboard/system-health */
  async getSystemHealth() {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState; // 0 disconnected, 1 connected, 2 connecting
    const { start } = dayBounds();
    const [eventsToday, errorEvents, activeSessions, settingCount, auditCount] = await Promise.all([
      AttendanceEventModel.countDocuments({ actualTime: { $gte: start } }),
      AttendanceEventModel.countDocuments({ actualTime: { $gte: start }, status: { $in: ['INVALID', 'BLOCKED', 'GPS_FAILURE'] } }),
      DeviceSessionModel.countDocuments({ isActive: true }),
      SystemSettingModel.countDocuments(),
      AuditLogModel.estimatedDocumentCount(),
    ]);
    return {
      database: {
        status: dbState === 1 ? 'UP' : dbState === 2 ? 'CONNECTING' : 'DOWN',
        name: mongoose.connection.name || 'attendance_db',
      },
      websocket: { status: 'UP', transport: 'socket.io' },
      storage: { status: 'UP', provider: process.env.STORAGE_PROVIDER || 'local' },
      stats: {
        eventsToday,
        errorEvents,
        errorRatePct: eventsToday ? Math.round((errorEvents / eventsToday) * 1000) / 10 : 0,
        activeSessions,
        configuredSettings: settingCount,
        auditRecords: auditCount,
      },
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development',
    };
  }
}

function scopeAllowsSections(user: DashboardUser): boolean {
  return user.role === 'SUPER_ADMIN' || user.role === 'MAIN_ADMIN';
}

function sectionFilter(user: DashboardUser): Record<string, unknown> {
  const scope = resolveScope(user);
  if (scope.sectionIds) return { _id: { $in: scope.sectionIds } };
  if (scope.flowIds && scope.flowIds.length) return { flows: { $exists: true } }; // flow admins see sections via flows
  return {};
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const dashboardService = new DashboardService();
