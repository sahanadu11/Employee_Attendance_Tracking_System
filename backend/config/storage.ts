import path from 'path';
import fs from 'fs';

export const STORAGE_PATH = path.join(__dirname, '..', 'uploads');
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function ensureUploadDir(): void {
  if (!fs.existsSync(STORAGE_PATH)) {
    fs.mkdirSync(STORAGE_PATH, { recursive: true });
  }
}

export function generateStoragePath(entityType: string, entityId: string, originalName: string): string {
  const dir = path.join(STORAGE_PATH, entityType, entityId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const ext = originalName.split('.').pop() || 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
  return path.join(dir, filename);
}

export function getPublicUrl(storagePath: string): string {
  const relativePath = path.relative(STORAGE_PATH, storagePath);
  return `/api/uploads/${relativePath.replace(/\\/g, '/')}`;
}
