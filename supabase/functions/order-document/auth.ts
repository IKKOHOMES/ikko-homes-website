import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type DocumentCaller = {
  id: string;
  isAdmin: boolean;
};

export function isDocumentAdministrator(profile: unknown): boolean {
  return typeof profile === 'object' && profile !== null &&
    (profile as { role?: unknown }).role === 'admin';
}

export async function requireDocumentCaller(
  request: Request,
): Promise<{ admin: SupabaseClient; caller: DocumentCaller }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw new Error('Unauthorised.');
  }

  const token = authorization.replace(/^Bearer\s+/i, '');
  const auth = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await auth.auth.getUser(token);
  if (userError || !userData.user) throw new Error('Unauthorised.');

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profileError) throw new Error('Unauthorised.');

  return {
    admin,
    caller: { id: userData.user.id, isAdmin: isDocumentAdministrator(profile) },
  };
}