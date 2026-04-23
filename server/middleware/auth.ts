import type { Context, Next } from 'hono';
import { supabase } from '../db/supabase.js';

/**
 * Middleware that validates a Supabase JWT from the Authorization header.
 * Sets c.set('userId', ...) for downstream routes.
 */
export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    c.set('userId', data.user.id);
    c.set('userEmail', data.user.email);
    await next();
  } catch {
    return c.json({ error: 'Authentication failed' }, 401);
  }
}
