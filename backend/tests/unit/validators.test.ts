import { loginSchema, registerSchema } from '../../validators/authValidator';
import { createEmployeeSchema } from '../../validators/employeeValidator';
import { createShiftSchema } from '../../validators/shiftValidator';
import { createFlowSchema } from '../../validators/flowValidator';
import { createSectionSchema } from '../../validators/sectionValidator';
import { locationSchema } from '../../validators/gpsValidator';
import { attendanceSubmissionSchema } from '../../validators/attendanceValidator';
import { updateSettingSchema } from '../../validators/settingsValidator';

describe('Auth validators', () => {
  test('loginSchema accepts valid credentials', () => {
    const result = loginSchema.safeParse({ email: 'admin@example.com', password: 'secret123' });
    expect(result.success).toBe(true);
  });

  test('loginSchema rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret123' });
    expect(result.success).toBe(false);
  });

  test('loginSchema rejects short password', () => {
    const result = loginSchema.safeParse({ email: 'admin@example.com', password: '123' });
    expect(result.success).toBe(false);
  });

  test('registerSchema accepts valid role', () => {
    const result = registerSchema.safeParse({ email: 'a@b.com', password: 'password', role: 'SECTION_ADMIN' });
    expect(result.success).toBe(true);
  });

  test('registerSchema rejects unknown role', () => {
    const result = registerSchema.safeParse({ email: 'a@b.com', password: 'password', role: 'HACKER' });
    expect(result.success).toBe(false);
  });
});

describe('Employee validator', () => {
  const validEmployee = {
    employeeId: 'EMP001',
    fullName: 'John Doe',
    phone: '9876543210',
    department: 'Engineering',
    sectionId: 'sec1',
    flowId: 'flow1',
    shiftId: 'shift1',
    jobTitle: 'Engineer',
  };

  test('accepts valid employee', () => {
    expect(createEmployeeSchema.safeParse(validEmployee).success).toBe(true);
  });

  test('rejects missing required fields', () => {
    const { sectionId, ...missing } = validEmployee;
    expect(createEmployeeSchema.safeParse(missing).success).toBe(false);
  });

  test('rejects short employeeId', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, employeeId: 'A' }).success).toBe(false);
  });

  test('rejects invalid optional email', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, email: 'bad' }).success).toBe(false);
  });
});

describe('Shift validator', () => {
  const validShift = {
    name: 'Morning Shift',
    code: 'SH1',
    startTime: '07:00',
    endTime: '11:00',
  };

  test('accepts valid shift', () => {
    expect(createShiftSchema.safeParse(validShift).success).toBe(true);
  });

  test('rejects invalid time format', () => {
    expect(createShiftSchema.safeParse({ ...validShift, startTime: '25:00' }).success).toBe(false);
  });

  test('provides default grace period', () => {
    const result = createShiftSchema.safeParse(validShift);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.gracePeriodMinutes).toBe(15);
  });
});

describe('Flow validator', () => {
  const validFlow = {
    name: 'Flow 1',
    code: 'FL1',
    sectionId: 'sec1',
    attendanceSequence: ['LOGIN', 'SIGN_OUT'],
  };

  test('accepts valid flow', () => {
    expect(createFlowSchema.safeParse(validFlow).success).toBe(true);
  });

  test('rejects empty attendance sequence', () => {
    expect(createFlowSchema.safeParse({ ...validFlow, attendanceSequence: [] }).success).toBe(false);
  });
});

describe('Section validator', () => {
  test('accepts valid section', () => {
    expect(createSectionSchema.safeParse({ name: 'North Wing', code: 'SEC1' }).success).toBe(true);
  });

  test('rejects short code', () => {
    expect(createSectionSchema.safeParse({ name: 'North Wing', code: 'S' }).success).toBe(false);
  });
});

describe('GPS validator', () => {
  test('accepts valid coordinates', () => {
    expect(locationSchema.safeParse({ latitude: 28.6, longitude: 77.2, accuracy: 10 }).success).toBe(true);
  });

  test('rejects out-of-range latitude', () => {
    expect(locationSchema.safeParse({ latitude: 100, longitude: 77.2, accuracy: 10 }).success).toBe(false);
  });

  test('rejects negative accuracy', () => {
    expect(locationSchema.safeParse({ latitude: 28.6, longitude: 77.2, accuracy: -1 }).success).toBe(false);
  });
});

describe('Attendance validator', () => {
  test('accepts minimal submission', () => {
    expect(attendanceSubmissionSchema.safeParse({ eventTypeId: 'et1' }).success).toBe(true);
  });

  test('rejects missing event type', () => {
    expect(attendanceSubmissionSchema.safeParse({}).success).toBe(false);
  });

  test('rejects invalid face verification enum', () => {
    expect(attendanceSubmissionSchema.safeParse({ eventTypeId: 'et1', faceVerificationResult: 'NOPE' }).success).toBe(false);
  });
});

describe('Settings validator', () => {
  test('accepts valid setting', () => {
    expect(updateSettingSchema.safeParse({ key: 'theme', value: 'dark' }).success).toBe(true);
  });

  test('rejects missing key', () => {
    expect(updateSettingSchema.safeParse({ value: 'dark' }).success).toBe(false);
  });
});