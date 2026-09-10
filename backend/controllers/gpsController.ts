import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { gpsService } from '../services/gpsService';
import { OfficeLocationModel } from '../models/OfficeLocation';
import { EmployeeLocationModel } from '../models/EmployeeLocation';
import { logger } from '../utils/logger';

export const validateLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { latitude, longitude, accuracy } = req.body;
    const employeeId = req.user?.employeeId || req.body.employeeId;
    const result = await gpsService.validateLocation({ employeeId, latitude, longitude, accuracy });
    res.json({ success: true, message: result.message, data: result });
  } catch (error: any) {
    logger.error(`Location validation failed: ${error.message}`);
    res.status(500).json({ success: false, message: 'Location validation failed', code: 'GPS_ERROR' });
  }
};

export const getOfficeLocations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const offices = await OfficeLocationModel.find().sort({ name: 1 });
    res.json({ success: true, message: 'Office locations retrieved', data: offices });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch office locations', code: 'FETCH_ERROR' });
  }
};

export const createOfficeLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const office = new OfficeLocationModel(req.body);
    await office.save();
    res.status(201).json({ success: true, message: 'Office location created', data: office });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create office location', code: 'CREATE_ERROR' });
  }
};

export const getEmployeeLocations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;
    const locations = await EmployeeLocationModel.find({ employeeId }).sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, message: 'Employee locations retrieved', data: locations });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch locations', code: 'FETCH_ERROR' });
  }
};
