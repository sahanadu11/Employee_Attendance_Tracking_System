jest.mock('../../models/AttendanceEvent', () => ({ AttendanceEventModel: {} }));
jest.mock('../../models/Employee', () => ({ EmployeeModel: {} }));
jest.mock('../../models/Shift', () => ({ ShiftModel: {} }));
jest.mock('../../models/Section', () => ({ SectionModel: {} }));
jest.mock('../../models/Flow', () => ({ FlowModel: {} }));
jest.mock('../../models/BreakRecord', () => ({ BreakRecordModel: {} }));

import { reportService } from '../../services/reportService';

describe('ReportService.generateCsv', () => {
  test('returns empty string for empty input', () => {
    expect(reportService.generateCsv([])).toBe('');
  });

  test('produces header row plus data rows', () => {
    const csv = reportService.generateCsv([
      { Name: 'John', LateCount: 2 },
      { Name: 'Jane', LateCount: 0 },
    ]);
    const lines = csv.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('"Name","LateCount"');
    expect(lines[1]).toBe('"John","2"');
    expect(lines[2]).toBe('"Jane","0"');
  });

  test('escapes embedded double quotes', () => {
    const csv = reportService.generateCsv([{ Note: 'Said "hello"' }]);
    expect(csv).toContain('"Said ""hello"""');
  });

  test('serializes null and undefined to empty string', () => {
    const csv = reportService.generateCsv([{ a: null, b: undefined, c: 'x' }]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('"","","x"');
  });
});