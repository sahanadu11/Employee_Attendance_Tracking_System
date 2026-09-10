import { Request, Response } from 'express';
import { SystemSettingModel } from '../models/SystemSetting';
import { auditService } from '../services/auditService';

/** In-memory cache with short TTL so hot paths (attendance engine) can read config cheaply. */
const settingsCache = new Map<string, { value: any; expires: number }>();
const CACHE_TTL_MS = 30_000;

export async function getSettingValue(key: string, fallback: any): Promise<any> {
  const cached = settingsCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  try {
    const doc = await SystemSettingModel.findOne({ key });
    const value = doc ? doc.value : fallback;
    settingsCache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
    return value;
  } catch {
    return fallback;
  }
}

export function invalidateSettingsCache(): void {
  settingsCache.clear();
}

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await SystemSettingModel.find();
    const settingsMap: any = {};
    settings.forEach((s: any) => { settingsMap[s.key] = s.value; });
    res.json({ success: true, message: 'Settings retrieved', data: settingsMap });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch settings', code: 'FETCH_ERROR' });
  }
};

export const updateSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, value } = req.body;
    const setting = await SystemSettingModel.findOneAndUpdate({ key }, { value, updatedAt: new Date() }, { upsert: true, new: true });
    invalidateSettingsCache();
    const authReq = req as any;
    await auditService.createAuditEntry({
      userId: authReq.user?._id?.toString() || 'SYSTEM',
      userRole: authReq.user?.role || 'SYSTEM',
      action: 'SETTING_UPDATED',
      entity: 'SystemSetting',
      entityId: key,
      oldValue: undefined,
      newValue: { key, value },
      result: 'SUCCESS',
      ipAddress: authReq.ip,
      userAgent: authReq.headers?.['user-agent'],
    });
    res.json({ success: true, message: 'Setting updated', data: setting });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update setting', code: 'UPDATE_ERROR' });
  }
};
