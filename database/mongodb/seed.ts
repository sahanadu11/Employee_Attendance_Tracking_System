/**
 * Canonical seed entry point.
 *
 * The actual seeding implementation lives in `backend/seed/seedData.ts`
 * (it needs Mongoose models and bcrypt from the backend). This file exists
 * so the database folder documents and owns the canonical dataset; it simply
 * forwards to the backend implementation.
 *
 * Run:  cd backend && npm run seed
 */
export { seed } from '../../backend/seed/seedData';
