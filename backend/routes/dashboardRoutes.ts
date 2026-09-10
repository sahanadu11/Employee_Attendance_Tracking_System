import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { dashboardService, resolveScope } from '../services/dashboardService';
import { NotificationModel } from '../models/Notification';
import { DeviceSessionModel } from '../models/DeviceSession';
import { UserModel } from '../models/User';
import { auditService } from '../services/auditService';

const router = Router();

// All dashboard routes require authentication. Employee role sees only own data.
router.use(authenticateToken);

const ADMIN_ROLES = ['SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN'];

/** Dashboard visibility: any authenticated role, but service scopes data. */
function canSeeDashboards(role: string): boolean {
  return ADMIN_ROLES.includes(role);
}

router.get('/overview', async (req: AuthRequest, res: Response) => {
  try {
    if (!canSeeDashboards(req.user.role)) {
      res.status(403).json({ success: false, message: 'Dashboard access requires an admin role', code: 'FORBIDDEN' });
      return;
    }
    const data = await dashboardService.getOverview(req.user);
    res.json({ success: true, message: 'Overview retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load overview', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/realtime', async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const filters: Record<string, unknown> = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.sectionId) filters.sectionId = req.query.sectionId;
    if (req.query.flowId) filters.flowId = req.query.flowId;
    if (req.query.shiftId) filters.shiftId = req.query.shiftId;
    if (req.query.eventCode) filters['eventTypeId'] = req.query.eventCode;
    if (req.query.gpsStatus) filters.gpsStatus = req.query.gpsStatus;
    const data = await dashboardService.getRealtimeEvents(req.user, limit, filters);
    res.json({ success: true, message: 'Realtime events retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load realtime events', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/sections', requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getSectionDashboard(req.user);
    res.json({ success: true, message: 'Section dashboard retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load section dashboard', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/flows', requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getFlowDashboard(req.user, req.query.flowId as string);
    res.json({ success: true, message: 'Flow dashboard retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load flow dashboard', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/shifts', requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getShiftDashboard(req.user, req.query.shiftId as string);
    res.json({ success: true, message: 'Shift dashboard retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load shift dashboard', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/employees', requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getEmployeeGrid(req.user, {
      search: req.query.search as string,
      state: req.query.state as string,
      sectionId: req.query.sectionId as string,
      flowId: req.query.flowId as string,
      shiftId: req.query.shiftId as string,
      limit: parseInt(req.query.limit as string) || 60,
      page: parseInt(req.query.page as string) || 1,
    });
    res.json({ success: true, message: 'Employee grid retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load employee grid', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/attendance', requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getAttendanceDashboard(req.user, {
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string,
      shiftId: req.query.shiftId as string,
      flowId: req.query.flowId as string,
      sectionId: req.query.sectionId as string,
    });
    res.json({ success: true, message: 'Attendance dashboard retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load attendance dashboard', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/late', requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getLateDashboard(req.user, {
      sortBy: req.query.sortBy as string,
      limit: parseInt(req.query.limit as string) || 50,
    });
    res.json({ success: true, message: 'Late dashboard retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load late dashboard', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/breaks', requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getBreakDashboard(req.user);
    res.json({ success: true, message: 'Break dashboard retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load break dashboard', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/gps', requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getGpsDashboard(req.user);
    res.json({ success: true, message: 'GPS dashboard retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load GPS dashboard', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/geofence', requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getGeofenceDashboard(req.user);
    res.json({ success: true, message: 'Geofence dashboard retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load geofence dashboard', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/events', requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getEventDashboard(req.user);
    res.json({ success: true, message: 'Event dashboard retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load event dashboard', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/security', requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getSecurityDashboard(req.user);
    res.json({ success: true, message: 'Security dashboard retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load security dashboard', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/audit', requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getAuditDashboard(req.user, {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 25,
      action: req.query.action as string,
      search: req.query.search as string,
    });
    res.json({ success: true, message: 'Audit dashboard retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load audit dashboard', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/notifications', async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getNotifications(req.user, {
      unreadOnly: req.query.unreadOnly === 'true',
      type: req.query.type as string,
      limit: parseInt(req.query.limit as string) || 50,
    });
    res.json({ success: true, message: 'Notifications retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load notifications', code: 'DASHBOARD_ERROR' });
  }
});

router.patch('/notifications/:id/acknowledge', requireRole('SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const n = await NotificationModel.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!n) {
      res.status(404).json({ success: false, message: 'Notification not found', code: 'NOT_FOUND' });
      return;
    }
    await auditService.createAuditEntry({
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: 'NOTIFICATION_ACKNOWLEDGED',
      entity: 'Notification',
      entityId: n._id.toString(),
      result: 'SUCCESS',
    });
    res.json({ success: true, message: 'Notification acknowledged', data: n });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to acknowledge notification', code: 'UPDATE_ERROR' });
  }
});

router.get('/sessions', requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getSessionsDashboard(req.user);
    res.json({ success: true, message: 'Sessions retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load sessions', code: 'DASHBOARD_ERROR' });
  }
});

router.post('/sessions/:id/revoke', requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const session = await DeviceSessionModel.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found', code: 'NOT_FOUND' });
      return;
    }
    await auditService.createAuditEntry({
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: 'SESSION_REVOKED',
      entity: 'DeviceSession',
      entityId: session._id.toString(),
      result: 'SUCCESS',
    });
    res.json({ success: true, message: 'Session revoked', data: session });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to revoke session', code: 'UPDATE_ERROR' });
  }
});

router.get('/system-health', requireRole('SUPER_ADMIN', 'MAIN_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await dashboardService.getSystemHealth();
    res.json({ success: true, message: 'System health retrieved', data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load system health', code: 'DASHBOARD_ERROR' });
  }
});

export default router;
