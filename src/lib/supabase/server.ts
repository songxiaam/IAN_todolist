import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

function getEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

function getSupabaseCredentials(): SupabaseCredentials {
  const url = getEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_URL',
    'COZE_SUPABASE_URL',
  );
  const anonKey = getEnv(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'COZE_SUPABASE_ANON_KEY',
  );

  if (!url) {
    throw new Error(
      'Supabase URL is not set. Configure NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.',
    );
  }
  if (!anonKey) {
    throw new Error(
      'Supabase anon key is not set. Configure NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY.',
    );
  }

  return { url, anonKey };
}

function getSupabaseServiceRoleKey(): string | undefined {
  return getEnv('SUPABASE_SERVICE_ROLE_KEY', 'COZE_SUPABASE_SERVICE_ROLE_KEY');
}

function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const key = token ? anonKey : (serviceRoleKey ?? anonKey);

  const globalOptions: { headers?: { Authorization: string } } = {};
  if (token) {
    globalOptions.headers = { Authorization: `Bearer ${token}` };
  }

  return createClient(url, key, {
    global: globalOptions,
    db: { timeout: 60000 },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export { getSupabaseCredentials, getSupabaseServiceRoleKey, getSupabaseClient };
