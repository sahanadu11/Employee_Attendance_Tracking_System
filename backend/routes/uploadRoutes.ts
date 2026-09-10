import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.post(
  '/',
  authenticateToken,
  upload.single('photo'),
  (req: AuthRequest, res: Response): void => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No file uploaded', code: 'NO_FILE' });
        return;
      }
      const url = `/api/uploads/${req.file.filename}`;
      res.json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          filename: req.file.filename,
          url,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message, code: 'UPLOAD_ERROR' });
    }
  }
);

export default router;
