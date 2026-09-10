import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { EmployeeModel } from '../models/Employee';
import { AttendanceEventModel } from '../models/AttendanceEvent';
import { SectionModel } from '../models/Section';
import { FlowModel } from '../models/Flow';
import { ShiftModel } from '../models/Shift';
import { AttendancePolicyModel } from '../models/AttendancePolicy';
import { UserModel } from '../models/User';
import { auditService } from '../services/auditService';
import { logger } from '../utils/logger';

export const getEmployees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const sectionId = req.query.sectionId as string;
    const flowId = req.query.flowId as string;
    const status = req.query.status as string;

    const query: any = {};
    if (req.user?.role === 'SECTION_ADMIN' && req.user?.sectionId) {
      query.sectionId = req.user.sectionId;
    }
    if (sectionId) query.sectionId = sectionId;
    if (flowId) query.flowId = flowId;
    if (status) query.employmentStatus = status;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [employees, total] = await Promise.all([
      EmployeeModel.find(query).populate('sectionId').populate('flowId').populate('shiftId').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      EmployeeModel.countDocuments(query),
    ]);
    res.json({ success: true, message: 'Employees retrieved', data: { employees, total, page, limit } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch employees', code: 'FETCH_ERROR' });
  }
};

export const createEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId, fullName, phone, email, department, sectionId, flowId, shiftId, jobTitle, joiningDate, employmentStatus, emergencyContact } = req.body;

    const existing = await EmployeeModel.findOne({ employeeId });
    if (existing) {
      res.status(409).json({ success: false, message: 'Employee ID already exists', code: 'DUPLICATE_EMPLOYEE_ID' });
      return;
    }

    const employee = new EmployeeModel({ employeeId, fullName, phone, email, department, sectionId, flowId, shiftId, jobTitle, joiningDate, employmentStatus, emergencyContact });
    await employee.save();

    await auditService.createAuditEntry({ userId: req.user?._id?.toString() || 'SYSTEM', userRole: req.user?.role || 'SYSTEM', action: 'EMPLOYEE_CREATE', entity: 'Employee', entityId: employee._id.toString(), result: 'SUCCESS' });
    res.status(201).json({ success: true, message: 'Employee created', data: { employeeId: employee._id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create employee', code: 'CREATE_ERROR' });
  }
};

export const updateEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;
    const { fullName, phone, email, department, sectionId, flowId, shiftId, jobTitle, employmentStatus, emergencyContact } = req.body;
    const employee = await EmployeeModel.findByIdAndUpdate(employeeId, { fullName, phone, email, department, sectionId, flowId, shiftId, jobTitle, employmentStatus, emergencyContact, updatedAt: new Date() }, { new: true });
    if (!employee) { res.status(404).json({ success: false, message: 'Employee not found', code: 'NOT_FOUND' }); return; }
    await auditService.createAuditEntry({ userId: req.user?._id?.toString() || 'SYSTEM', userRole: req.user?.role || 'SYSTEM', action: 'EMPLOYEE_UPDATE', entity: 'Employee', entityId: employee._id.toString(), result: 'SUCCESS' });
    res.json({ success: true, message: 'Employee updated', data: employee });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update employee', code: 'UPDATE_ERROR' });
  }
};

export const toggleEmployeeStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) { res.status(404).json({ success: false, message: 'Employee not found', code: 'NOT_FOUND' }); return; }
    const newStatus = employee.isActive ? false : true;
    employee.isActive = newStatus;
    employee.employmentStatus = newStatus ? 'ACTIVE' : 'INACTIVE';
    await employee.save();
    await auditService.createAuditEntry({ userId: req.user?._id?.toString() || 'SYSTEM', userRole: req.user?.role || 'SYSTEM', action: 'EMPLOYEE_TOGGLE', entity: 'Employee', entityId: employee._id.toString(), result: 'SUCCESS' });
    res.json({ success: true, message: `Employee ${newStatus ? 'reactivated' : 'disabled'}`, data: employee });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update employee status', code: 'STATUS_ERROR' });
  }
};

export const getEmployeeTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;
    const pageNum = parseInt(req.query.page as string) || 1;
    const limitNum = parseInt(req.query.limit as string) || 50;
    const { date } = req.query;
    const query: any = { employeeId };
    if (date) query.actualTime = { $gte: new Date(date as string), $lte: new Date(new Date(date as string).setDate(new Date(date as string).getDate() + 1)) };
    const [events, total] = await Promise.all([
      AttendanceEventModel.find(query).sort({ actualTime: -1 }).populate('eventTypeId').populate('shiftId').skip((pageNum - 1) * limitNum).limit(limitNum),
      AttendanceEventModel.countDocuments(query),
    ]);
    res.json({ success: true, message: 'Timeline retrieved', data: { events, total, page: pageNum } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch timeline', code: 'FETCH_ERROR' });
  }
};
