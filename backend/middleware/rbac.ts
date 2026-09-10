import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { logger } from '../utils/logger';

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}

export function requireAnyRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }
  };
}

export function checkSectionPermission(req: AuthRequest, res: Response, next: NextFunction) {
  const sectionId = req.params.sectionId || req.body.sectionId;
  if (!sectionId || !req.user) {
    next();
    return;
  }
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'MAIN_ADMIN') {
    next();
    return;
  }
  if (req.user.role === 'SECTION_ADMIN') {
    if (req.user.sectionId === sectionId) {
      next();
    } else {
      res.status(403).json({ success: false, message: 'Access denied to this section', code: 'SECTION_DENIED' });
    }
  } else {
    next();
  }
}

export function checkFlowPermission(req: AuthRequest, res: Response, next: NextFunction) {
  const flowId = req.params.flowId || req.body.flowId;
  if (!flowId || !req.user) {
    next();
    return;
  }
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'MAIN_ADMIN') {
    next();
    return;
  }
  if (req.user.role === 'FLOW_ADMIN') {
    if (req.user.flowId === flowId) {
      next();
    } else {
      res.status(403).json({ success: false, message: 'Access denied to this flow', code: 'FLOW_DENIED' });
    }
  } else {
    next();
  }
}

export function checkEmployeeScope(req: AuthRequest, res: Response, next: NextFunction) {
  const employeeId = req.params.employeeId || req.body.employeeId;
  if (!employeeId || !req.user) {
    next();
    return;
  }
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'MAIN_ADMIN') {
    next();
    return;
  }
  if (req.user.role === 'EMPLOYEE' && req.user.employeeId === employeeId) {
    next();
    return;
  }
  if (req.user.role === 'SECTION_ADMIN') {
    const SectionModel = require('../models/Section').SectionModel;
    const EmployeeModel = require('../models/Employee').EmployeeModel;
    EmployeeModel.findById(employeeId).then((emp: any) => {
      if (emp && emp.sectionId && req.user.sectionId && emp.sectionId.toString() === req.user.sectionId.toString()) {
        next();
      } else {
        res.status(403).json({ success: false, message: 'Access denied to this employee', code: 'EMPLOYEE_DENIED' });
      }
    }).catch(() => {
      res.status(403).json({ success: false, message: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' });
    });
  } else {
    next();
  }
}
