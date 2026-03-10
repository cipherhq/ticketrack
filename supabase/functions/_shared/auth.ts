/**
 * Shared authentication & authorization middleware for Edge Functions
 *
 * Usage:
 *   const { user, supabase } = await requireAuth(req);
 *   await requireOrganizerOwner(supabase, user.id, organizerId);
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface AuthResult {
  user: { id: string; email?: string; role?: string };
  supabase: SupabaseClient;       // service-role client for DB ops
  userClient: SupabaseClient;     // user-scoped client (RLS enforced)
  token: string;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/**
 * Verify JWT from Authorization header. Returns user + service-role client.
 * Throws AuthError if not authenticated.
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new AuthError("Missing Authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token || token === SUPABASE_ANON_KEY) {
    throw new AuthError("Valid user token required");
  }

  // Create a user-scoped client to verify the token
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    throw new AuthError("Invalid or expired token");
  }

  // Service-role client for privileged DB operations
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  return { user: { id: user.id, email: user.email, role: user.role }, supabase, userClient, token };
}

/**
 * Optional auth — returns user if present, null if not.
 * Used for endpoints that work differently for authed vs anon users.
 */
export async function optionalAuth(req: Request): Promise<AuthResult | null> {
  try {
    return await requireAuth(req);
  } catch {
    return null;
  }
}

/**
 * Verify caller owns the organizer (user_id on organizers table matches).
 * Throws AuthError(403) if not owner.
 */
export async function requireOrganizerOwner(
  supabase: SupabaseClient,
  userId: string,
  organizerId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("organizers")
    .select("id, user_id")
    .eq("id", organizerId)
    .single();

  if (error || !data) {
    throw new AuthError("Organizer not found", 404);
  }
  if (data.user_id !== userId) {
    throw new AuthError("You don't own this organizer", 403);
  }
}

/**
 * Verify caller is an admin.
 */
export async function requireAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data || data.role !== "admin") {
    throw new AuthError("Admin access required", 403);
  }
}

/**
 * Verify caller is either the organizer owner OR an admin.
 */
export async function requireOrganizerOrAdmin(
  supabase: SupabaseClient,
  userId: string,
  organizerId: string
): Promise<void> {
  // Check admin first
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") return;

  // Check organizer ownership
  await requireOrganizerOwner(supabase, userId, organizerId);
}

/**
 * Verify the request is from a service-role caller (internal/cron).
 * Checks Authorization header contains the service role key.
 */
export function requireServiceRole(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    throw new AuthError("Service role access required", 403);
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Verify caller owns the event (via organizer ownership).
 */
export async function requireEventOwner(
  supabase: SupabaseClient,
  userId: string,
  eventId: string
): Promise<{ organizerId: string }> {
  const { data: event, error } = await supabase
    .from("events")
    .select("organizer_id")
    .eq("id", eventId)
    .single();

  if (error || !event) {
    throw new AuthError("Event not found", 404);
  }

  await requireOrganizerOwner(supabase, userId, event.organizer_id);
  return { organizerId: event.organizer_id };
}

/**
 * Return a standardized auth error response with CORS headers.
 */
export function authErrorResponse(err: AuthError | Error, corsHeaders: Record<string, string>): Response {
  const status = err instanceof AuthError ? err.status : 401;
  return new Response(
    JSON.stringify({ success: false, error: err.message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
