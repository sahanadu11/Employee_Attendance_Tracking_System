import { OfficeLocationModel } from '../models/OfficeLocation';
import { EmployeeLocationModel } from '../models/EmployeeLocation';
import { SecurityEventModel } from '../models/SecurityEvent';
import { logger } from '../utils/logger';

export class GpsService {
  async validateLocation(data: {
    employeeId: string;
    latitude: number;
    longitude: number;
    accuracy: number;
  }): Promise<{
    valid: boolean;
    status: string;
    distance: number;
    accuracy: number;
    insideGeofence: boolean;
    message: string;
    officeLocation?: any;
  }> {
    try {
      const office = await OfficeLocationModel.findOne({ isActive: true });
      if (!office) {
        return { valid: false, status: 'NO_OFFICE', distance: 0, accuracy: data.accuracy, insideGeofence: false, message: 'No active office location configured' };
      }

      const distance = this.haversineDistance(data.latitude, data.longitude, office.latitude, office.longitude);
      const inside = distance <= office.geofenceRadius;
      const accuracyOk = data.accuracy <= (office.geofenceRadius * 2);

      let status: string;
      let message: string;

      if (!inside && !accuracyOk) {
        status = 'OUTSIDE_INACCURATE';
        message = 'Attendance cannot be recorded: you are outside the permitted office location and GPS accuracy is insufficient.';
      } else if (!inside) {
        status = 'OUTSIDE';
        message = 'Attendance cannot be recorded because you are outside the permitted office location.';
      } else if (!accuracyOk) {
        status = 'INACCURATE';
        message = `GPS Accuracy (${data.accuracy}m) exceeds required threshold. Office location verified but accuracy may be insufficient.`;
      } else {
        status = 'VERIFIED';
        message = 'Office location verified. Attendance can continue.';
      }

      await EmployeeLocationModel.create({
        employeeId: data.employeeId,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        timestamp: new Date(),
        insideGeofence: inside,
        officeLocationId: office._id,
      });

      return { valid: inside && accuracyOk, status, distance, accuracy: data.accuracy, insideGeofence: inside, message, officeLocation: office };
    } catch (error: any) {
      logger.error(`GPS validation failed: ${error.message}`);
      throw error;
    }
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

export const gpsService = new GpsService();
