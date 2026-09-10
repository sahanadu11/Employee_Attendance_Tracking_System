import { UserModel } from '../models/User';
import { SectionModel } from '../models/Section';
import { FlowModel } from '../models/Flow';
import { ShiftModel } from '../models/Shift';
import { EmployeeModel } from '../models/Employee';
import { AttendanceEventTypeModel } from '../models/AttendanceEventType';
import { AttendanceEventModel } from '../models/AttendanceEvent';
import { BreakRecordModel } from '../models/BreakRecord';
import { OfficeLocationModel } from '../models/OfficeLocation';
import { SystemSettingModel } from '../models/SystemSetting';
import { SecurityEventModel } from '../models/SecurityEvent';
import { DeviceSessionModel } from '../models/DeviceSession';
import { NotificationModel } from '../models/Notification';
import bcrypt from 'bcrypt';
import { DEFAULT_SHIFTS, DEFAULT_FLOWS, DEFAULT_EVENTS, OFFICE_DEFAULT_LOCATION } from '../shared/constants';

const FIRST_NAMES = [
  'Jonathan', 'Marcus', 'Elena', 'Tariq', 'Devina', 'Anika', 'Rohan', 'Priya', 'Kunal', 'Sofia',
  'Aisha', 'Victor', 'Lena', 'Omar', 'Hana', 'Dmitri', 'Grace', 'Rafael', 'Mei', 'Jonas',
  'Amara', 'Felix', 'Nadia', 'Theo', 'Iris', 'Sven', 'Zara', 'Lucas', 'Maya', 'Ethan',
];
const LAST_NAMES = [
  'Vance', 'Chen', 'Rostova', 'Mansour', 'Patel', 'Kowalski', 'Sterling', 'Sharma', 'Mehta', 'Alvarez',
  'Khan', 'Petrov', 'Fischer', 'Haddad', 'Suzuki', 'Volkov', 'Okafor', 'Silva', 'Zhang', 'Berg',
  'Diallo', 'Reyes', 'Hassan', 'Lindqvist', 'Novak', 'Andersen', 'Malik', 'Costa', 'Singh', 'Walsh',
];
const DEPARTMENTS = ['Avionics', 'Propulsion', 'Guidance', 'Telemetry', 'Ground Ops', 'Payload', 'Mission Control'];
const JOBS = ['Systems Engineer', 'Technician', 'Analyst', 'Team Lead', 'Operator', 'QA Specialist', 'Coordinator'];

/** Deterministic pseudo-random for stable seeds */
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** Generate a deterministic avatar as an inline SVG data URI (no external service needed). */
function avatarFor(name: string, index: number): string {
  const hues = [210, 260, 160, 20, 330, 190, 45, 280];
  const h = hues[index % hues.length];
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},45%,38%)"/><stop offset="1" stop-color="hsl(${(h + 40) % 360},50%,24%)"/></linearGradient></defs><rect width="128" height="128" rx="18" fill="url(#g)"/><text x="64" y="78" font-family="monospace" font-size="44" font-weight="700" fill="rgba(255,255,255,0.92)" text-anchor="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export async function seed(): Promise<void> {
  try {
    const { connectDatabase, DATA_DRIVER } = await import('../config/database');
    await connectDatabase();
    console.log(`Connected for seeding (driver: ${DATA_DRIVER})`);

    await Promise.all([
      UserModel.deleteMany({}),
      SectionModel.deleteMany({}),
      FlowModel.deleteMany({}),
      ShiftModel.deleteMany({}),
      EmployeeModel.deleteMany({}),
      AttendanceEventTypeModel.deleteMany({}),
      AttendanceEventModel.deleteMany({}),
      BreakRecordModel.deleteMany({}),
      OfficeLocationModel.deleteMany({}),
      SystemSettingModel.deleteMany({}),
      SecurityEventModel.deleteMany({}),
      DeviceSessionModel.deleteMany({}),
      NotificationModel.deleteMany({}),
    ]);

    // ---------- Sections ----------
    const sectionDefs = [
      { name: 'Section A — Aero Systems', code: 'SEC-A' },
      { name: 'Section B — Propulsion', code: 'SEC-B' },
      { name: 'Section C — Mission Control', code: 'SEC-C' },
    ];
    const sections: any[] = [];
    for (let i = 0; i < sectionDefs.length; i++) {
      const passwordHash = await bcrypt.hash('Password123!', 12);
      const section = new SectionModel({ ...sectionDefs[i], adminIds: [], isActive: true });
      await section.save();
      const admin = new UserModel({
        email: `section${['a', 'b', 'c'][i]}@attendance.com`,
        passwordHash,
        role: 'SECTION_ADMIN',
        sectionId: section._id,
        isActive: true,
      });
      await admin.save();
      section.adminIds = [admin._id];
      await section.save();
      sections.push(section);
    }
    console.log('Created 3 sections + section admins');

    // ---------- Shifts (six, staggered across the day) ----------
    const shiftDocs = await ShiftModel.insertMany(
      DEFAULT_SHIFTS.map((s, i) => ({
        name: s.name,
        code: s.code,
        startTime: s.startTime,
        endTime: s.endTime,
        gracePeriodMinutes: s.gracePeriod ?? 10,
        lateThresholdMinutes: s.lateThreshold ?? 15,
        earlyLoginAllowanceMinutes: 15,
        scheduleDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        gpsPolicy: { requireGps: true, requireAccuracy: 50, geofenceRadius: 100 },
        sectionIds: sections.map((sec) => sec._id),
        isActive: true,
      }))
    );
    console.log('Created 6 shifts');

    // ---------- Flows (six) ----------
    const flowAdminPasswords = await bcrypt.hash('Password123!', 12);
    const flowDocs: any[] = [];
    for (let i = 0; i < 6; i++) {
      const admin = new UserModel({
        email: `flow${i + 1}@attendance.com`,
        passwordHash: flowAdminPasswords,
        role: 'FLOW_ADMIN',
        isActive: true,
      });
      await admin.save();
      const flow = new FlowModel({
        ...DEFAULT_FLOWS[i],
        code: `FL${i + 1}`,
        name: DEFAULT_FLOWS[i].name,
        sectionId: sections[i % sections.length]._id,
        adminIds: [admin._id],
        attendanceSequence: ['LOGIN', 'LUNCH_OUT', 'LUNCH_IN', 'TEA_OUT', 'TEA_IN', 'SIGN_OUT'],
        locationPolicy: { requireGeofence: true, geofenceRadius: 100, maxAccuracy: 50, checkOnEveryEvent: true },
        status: 'ACTIVE',
        shiftIds: [shiftDocs[i % shiftDocs.length]._id],
      });
      await flow.save();
      // Give the flow admin user their flowId so API scoping works
      admin.flowId = flow._id;
      await admin.save();
      flowDocs.push(flow);
    }
    console.log('Created 6 flows + flow admins');

    // ---------- Event types ----------
    const eventTypes = await AttendanceEventTypeModel.insertMany(
      DEFAULT_EVENTS.map((e) => ({
        ...e,
        requiresPhoto: true,
        requiresGps: true,
        requiresFaceVerification: false,
        allowedWindowMinutes: 60,
        isActive: true,
      }))
    );
    const loginType: any = eventTypes.find((e: any) => e.code === 'LOGIN');
    const lunchOutType: any = eventTypes.find((e: any) => e.code === 'LUNCH_OUT');
    const lunchInType: any = eventTypes.find((e: any) => e.code === 'LUNCH_IN');
    const teaOutType: any = eventTypes.find((e: any) => e.code === 'TEA_OUT');
    const teaInType: any = eventTypes.find((e: any) => e.code === 'TEA_IN');
    const signOutType: any = eventTypes.find((e: any) => e.code === 'SIGN_OUT');
    console.log('Created attendance event types');

    // ---------- Office location ----------
    const office = new OfficeLocationModel({ ...OFFICE_DEFAULT_LOCATION, name: 'HQ-Alpha', isActive: true });
    await office.save();

    // ---------- Super admin + main admin ----------
    const adminPassword = await bcrypt.hash('Admin123!', 12);
    await new UserModel({ email: 'admin@attendance.com', passwordHash: adminPassword, role: 'SUPER_ADMIN', isActive: true }).save();
    await new UserModel({ email: 'mainadmin@attendance.com', passwordHash: adminPassword, role: 'MAIN_ADMIN', isActive: true }).save();
    console.log('Created SUPER_ADMIN + MAIN_ADMIN');

    // ---------- Employees ----------
    const EMPLOYEE_COUNT = 24;
    const usedNames = new Set<string>();
    const empRows: any[] = [];
    for (let i = 0; i < EMPLOYEE_COUNT; i++) {
      let fullName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      while (usedNames.has(fullName)) fullName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}${String.fromCharCode(65 + Math.floor(rand() * 26))}`;
      usedNames.add(fullName);
      const section = sections[i % sections.length];
      const flow = flowDocs[i % flowDocs.length];
      const shift = shiftDocs[i % shiftDocs.length];
      empRows.push({
        employeeId: `EMP-${String(10024 + i * 37).padStart(5, '0')}`,
        fullName,
        photo: avatarFor(fullName, i),
        phone: `+91 98${String(10000000 + Math.floor(rand() * 89999999)).slice(0, 8)}`,
        email: `${fullName.toLowerCase().replace(/[^a-z]/g, '.')}@aero-ops.example`,
        department: pick(DEPARTMENTS),
        sectionId: section._id,
        flowId: flow._id,
        shiftId: shift._id,
        jobTitle: pick(JOBS),
        joiningDate: new Date(2021 + Math.floor(rand() * 4), Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)),
        employmentStatus: i === EMPLOYEE_COUNT - 1 ? 'INACTIVE' : 'ACTIVE',
        isActive: i !== EMPLOYEE_COUNT - 1,
      });
    }

    const employees: any[] = [];
    for (const emp of empRows) {
      const ep = await bcrypt.hash('Employee123!', 12);
      const eu = new UserModel({
        email: emp.email,
        passwordHash: ep,
        role: 'EMPLOYEE',
        employeeId: emp.employeeId,
        sectionId: emp.sectionId,
        flowId: emp.flowId,
        isActive: emp.isActive,
      });
      await eu.save();
      emp.userId = eu._id;
      employees.push(emp);
    }
    const empDocs = await EmployeeModel.insertMany(employees);
    console.log(`Created ${empDocs.length} employees with logins`);

    // ---------- Sample attendance for today ----------
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const activeEmps = empDocs.filter((e: any) => e.isActive);
    const eventStatuses = ['ON_TIME', 'ON_TIME', 'ON_TIME', 'GRACE_PERIOD', 'LATE', 'EARLY'];

    for (const emp of activeEmps) {
      const shift: any = shiftDocs.find((s: any) => String(s._id) === String(emp.shiftId));
      const [sh, sm] = (shift?.startTime || '09:00').split(':').map(Number);
      const scheduledLogin = new Date(today);
      scheduledLogin.setHours(sh, sm, 0, 0);

      // Login event for everyone
      const status = pick(eventStatuses);
      const lateMin = status === 'LATE' ? 15 + Math.floor(rand() * 45) : status === 'GRACE_PERIOD' ? 3 + Math.floor(rand() * 8) : 0;
      const loginTime = new Date(scheduledLogin.getTime() + (status === 'EARLY' ? -(10 + Math.floor(rand() * 20)) : lateMin) * 60000);
      if (loginTime > now) loginTime.setTime(now.getTime() - 5 * 60000);

      const [lat, lon] = [office.latitude + (rand() - 0.5) * 0.001, office.longitude + (rand() - 0.5) * 0.001];
      const gpsOk = rand() > 0.12;

      await AttendanceEventModel.create({
        employeeId: emp._id,
        eventTypeId: loginType._id,
        shiftId: emp.shiftId,
        flowId: emp.flowId,
        sectionId: emp.sectionId,
        scheduledTime: scheduledLogin,
        actualTime: loginTime,
        status: lateMin > shift.lateThresholdMinutes ? 'LATE' : lateMin > 0 ? 'GRACE_PERIOD' : status,
        lateDurationMinutes: lateMin || undefined,
        latitude: lat,
        longitude: lon,
        gpsAccuracy: Math.round(2 + rand() * 6),
        gpsStatus: gpsOk ? 'INSIDE' : 'INACCURATE',
        photoUrl: emp.photo,
        faceVerificationResult: 'NOT_REQUIRED',
        isIdempotentKey: `seed_${emp.employeeId}_LOGIN`,
        deviceInfo: { userAgent: 'Mozilla/5.0 (PWA)', platform: 'Android', browser: 'Chrome PWA', screenResolution: '1080x2400' },
      });

      // Some employees progressed through the day
      const stage = Math.floor(rand() * 6); // 0..5
      const base = loginTime.getTime();
      const addEvent = async (type: any, offsetMin: number, code: string) => {
        const t = new Date(base + offsetMin * 60000);
        if (t > now) return;
        await AttendanceEventModel.create({
          employeeId: emp._id,
          eventTypeId: type._id,
          shiftId: emp.shiftId,
          flowId: emp.flowId,
          sectionId: emp.sectionId,
          actualTime: t,
          status: 'ON_TIME',
          latitude: lat,
          longitude: lon,
          gpsAccuracy: Math.round(2 + rand() * 6),
          gpsStatus: gpsOk ? 'INSIDE' : 'INACCURATE',
          photoUrl: emp.photo,
          faceVerificationResult: 'NOT_REQUIRED',
          isIdempotentKey: `seed_${emp.employeeId}_${code}_${offsetMin}`,
        });
      };
      const lunchOut = 180 + Math.floor(rand() * 60);
      if (stage >= 1) await addEvent(lunchOutType, lunchOut, 'LUNCH_OUT');
      if (stage >= 2) await addEvent(lunchInType, lunchOut + 40 + Math.floor(rand() * 25), 'LUNCH_IN');
      if (stage >= 3) await addEvent(teaOutType, lunchOut + 130 + Math.floor(rand() * 40), 'TEA_OUT');
      if (stage >= 4) await addEvent(teaInType, lunchOut + 145 + Math.floor(rand() * 20), 'TEA_IN');
      if (stage >= 5) await addEvent(signOutType, lunchOut + 300, 'SIGN_OUT');

      // One open break record for realism
      if (stage === 1) {
        await BreakRecordModel.create({
          employeeId: emp._id,
          eventTypeId: lunchOutType._id,
          shiftId: emp.shiftId,
          flowId: emp.flowId,
          sectionId: emp.sectionId,
          breakStart: new Date(base + lunchOut * 60000),
          allowedDurationMinutes: shift.lunchPolicy?.allowedDurationMinutes || 45,
          timestamp: new Date(base + lunchOut * 60000),
        });
      }
    }
    console.log('Created sample attendance events + break records');

    // ---------- Security events / lockouts ----------
    const secTargets = empDocs.slice(0, 3);
    for (let i = 0; i < secTargets.length; i++) {
      const emp: any = secTargets[i];
      const user: any = await UserModel.findOne({ employeeId: emp.employeeId });
      if (user) {
        // Lock three accounts (3 failed attempts policy)
        await UserModel.updateOne(
          { _id: user._id },
          { failedAttempts: 3, lockedUntil: new Date(Date.now() + (25 + i * 40) * 60000) }
        );
        await SecurityEventModel.create({
          userId: user._id,
          eventType: 'LOCKOUT',
          description: `Account locked after 3 failed credential attempts`,
          ipAddress: `10.0.8.${44 + i * 72}`,
          userAgent: i % 2 ? 'Mobile Knox 14' : 'Gate Scanner S4',
          timestamp: new Date(Date.now() - (14 + i * 9) * 60000),
          isResolved: false,
        });
        await SecurityEventModel.create({
          userId: user._id,
          eventType: 'FAILED_LOGIN',
          description: 'Invalid password. 1 attempt remaining.',
          ipAddress: `192.168.4.${100 + i}`,
          userAgent: 'Chrome PWA / Android',
          timestamp: new Date(Date.now() - (30 + i * 12) * 60000),
          isResolved: false,
        });
      }
    }
    await SecurityEventModel.create({
      userId: (await UserModel.findOne({ email: 'admin@attendance.com' }))?._id,
      eventType: 'GPS_SUSPICIOUS',
      description: 'Attendance submitted 22m outside HQ-Alpha perimeter ring',
      ipAddress: '10.0.8.44',
      timestamp: new Date(Date.now() - 22 * 60000),
      isResolved: false,
    });
    await SecurityEventModel.create({
      userId: (await UserModel.findOne({ email: 'admin@attendance.com' }))?._id,
      eventType: 'ADMIN_CHANGE',
      description: 'Shift-3 grace period updated 10m → 15m',
      ipAddress: '127.0.0.1',
      timestamp: new Date(Date.now() - 95 * 60000),
      isResolved: true,
    });
    console.log('Created security events + 3 locked accounts');

    // ---------- Device sessions ----------
    for (let sIdx = 0; sIdx < empDocs.slice(0, 6).length; sIdx++) {
      const emp: any = empDocs[sIdx];
      const user: any = await UserModel.findOne({ employeeId: emp.employeeId });
      if (!user) continue;
      await DeviceSessionModel.create({
        userId: user._id,
        refreshToken: `seed-refresh-${emp.employeeId}`,
        deviceInfo: { userAgent: 'AeroOps PWA', platform: sIdx % 2 ? 'Android' : 'Windows', browser: sIdx % 2 ? 'Chrome Mobile PWA' : 'Edge' },
        ipAddress: `10.0.${Math.floor(rand() * 4)}.${20 + Math.floor(rand() * 200)}`,
        isActive: true,
        lastActivityAt: new Date(Date.now() - Math.floor(rand() * 30) * 60000),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      });
    }
    console.log('Created device sessions');

    // ---------- Notifications ----------
    const lateEvents = await AttendanceEventModel.find({ status: 'LATE' }).limit(6).populate('employeeId', 'fullName');
    for (const ev of lateEvents) {
      await NotificationModel.create({
        userId: (await UserModel.findOne({ employeeId: (ev.employeeId as any)?.employeeId }))?._id,
        type: 'LATE',
        title: 'Late Attendance Alert',
        message: `${(ev.employeeId as any)?.fullName} recorded ${ev.lateDurationMinutes} minutes late`,
        isRead: false,
        timestamp: ev.actualTime,
      });
    }
    console.log('Created notifications');

    // ---------- System settings ----------
    await SystemSettingModel.insertMany([
      { key: 'MAX_LOGIN_ATTEMPTS', value: 3, description: 'Failed password attempts before account lock' },
      { key: 'LOCKOUT_DURATION_MINUTES', value: 30, description: 'Account lock duration in minutes' },
      { key: 'LIVE_DISPLAY_DURATION_SECONDS', value: 90, description: 'Live event photo flash duration on dashboards' },
      { key: 'GPS_ACCURACY_THRESHOLD', value: 50, description: 'Maximum acceptable GPS accuracy in meters' },
      { key: 'GEOFENCE_DEFAULT_RADIUS', value: 100, description: 'Default office geofence radius in meters' },
      { key: 'GPS_UPDATE_INTERVAL_MS', value: 30000, description: 'Periodic location update interval' },
    ]);
    console.log('Created system settings');

    console.log('\n=== SEEDING COMPLETE ===');
    console.log('Sample credentials (CHANGE IN PRODUCTION):');
    console.log('  SUPER_ADMIN : admin@attendance.com / Admin123!');
    console.log('  MAIN_ADMIN  : mainadmin@attendance.com / Admin123!');
    console.log('  SECTION     : sectiona@attendance.com / Password123!  (b, c likewise)');
    console.log('  FLOW        : flow1@attendance.com / Password123!  (2-6 likewise)');
    console.log('  EMPLOYEE    : see employees@ aero-ops.example / Employee123!');
  } catch (error: any) {
    console.error('Seeding failed:', error);
    throw error;
  }
}

if (require.main === module) {
  seed()
    .then(async () => {
      const { disconnectDatabase } = await import('../config/database');
      await disconnectDatabase();
    })
    .catch(() => process.exit(1));
}
