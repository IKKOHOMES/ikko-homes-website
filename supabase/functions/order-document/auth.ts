import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function requireAdmin(request: Request): Promise<SupabaseClient> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) throw new Error('Unauthorised.');
  const token = authorization.replace(/^Bearer\s+/i, '');
  const auth = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: userError } = await auth.auth.getUser(token);
  if (userError || !userData.user) throw new Error('Unauthorised.');
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile, error: profileError } = await admin.from('profiles').select('id').eq('id', userData.user.id).maybeSingle();
  if (profileError || !profile) throw new Error('Unauthorised.');
  return admin;
}