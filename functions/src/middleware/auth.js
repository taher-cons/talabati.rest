/**
 * Authentication / authorization middleware for the WebAR Menu API.
 *
 * WHY THIS EXISTS
 * Before this file, every write endpoint was fully public:
 *   POST   /api/menu/admin/restaurant
 *   DELETE /api/menu/admin/menu/:id
 *   POST   /api/upload/model
 *   DELETE /api/upload/:bucket/:path
 * …executed with the Supabase SERVICE ROLE key, which bypasses RLS. Anyone who
 * knew a URL could wipe the whole menu. (Audit: Critical, not in the original
 * report — discovered during implementation.)
 *
 * TWO ACCEPTED CREDENTIALS
 *  1. `Authorization: Bearer <supabase access token>` of a user whose
 *     public.user_profiles.role is owner/admin/manager.
 *  2. `x-admin-key: <ADMIN_API_KEY>` — shared key for the current admin panel
 *     (which has no login UI yet) and for CI/scripts. Compared in constant time.
 */

import crypto from 'node:crypto';
import { getSupabaseAdmin } from '../supabase.js';

const ADMIN_ROLES = ['owner', 'admin', 'manager'];

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function deny(res, reason, status = 401) {
  return res.status(status).json({
    error: status === 403 ? 'Forbidden' : 'Unauthorized',
    reason,
    requestId: res.req?.requestId,
  });
}

/**
 * Requires an authenticated admin (Bearer token) or a valid ADMIN_API_KEY.
 */
export async function requireAdmin(req, res, next) {
  try {
    // --- Path 1: shared admin key ---
    const providedKey = req.get('x-admin-key');
    const expectedKey = process.env.ADMIN_API_KEY;

    if (providedKey) {
      if (!expectedKey) {
        console.error('[auth] ADMIN_API_KEY secret is not configured — rejecting x-admin-key');
        return deny(res, 'admin_key_not_configured', 503);
      }
      if (timingSafeEqual(providedKey, expectedKey)) {
        req.auth = { method: 'admin_key', role: 'admin' };
        return next();
      }
      return deny(res, 'invalid_admin_key');
    }

    // --- Path 2: Supabase user token ---
    const authHeader = req.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return deny(res, 'missing_credentials');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const admin = getSupabaseAdmin();

    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);

    if (error || !user) return deny(res, 'invalid_token');

    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .select('role, restaurant_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[auth] profile lookup failed:', profileError.message);
      return deny(res, 'profile_lookup_failed', 500);
    }
    if (!profile || !ADMIN_ROLES.includes(profile.role)) {
      return deny(res, 'insufficient_role', 403);
    }

    req.auth = {
      method: 'bearer',
      userId: user.id,
      email: user.email,
      role: profile.role,
      restaurantId: profile.restaurant_id,
    };
    return next();
  } catch (err) {
    console.error('[auth] unexpected error:', err);
    return deny(res, 'auth_error', 500);
  }
}

/**
 * Guards only the mutating verbs; GET/HEAD stay public.
 * Used for routers that mix public reads with admin writes.
 */
export function requireAdminForWrites(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return requireAdmin(req, res, next);
}

export default { requireAdmin, requireAdminForWrites };
