import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function readConfig() {
  const w = window as any;
  const url = localStorage.getItem("supabase_url") || w.__SUPABASE_URL__ || "";
  const anon = localStorage.getItem("supabase_anon") || w.__SUPABASE_ANON_KEY__ || "";
  return { url, anon };
}

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const { url, anon } = readConfig();
  if (!url || !anon) return null;
  client = createClient(url, anon);
  return client;
}

export async function getCurrentUser() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export function onAuthStateChange(callback: Parameters<SupabaseClient["auth"]["onAuthStateChange"]>[0]) {
  const supabase = getSupabase();
  if (!supabase) return { data: { subscription: { unsubscribe() {} } } } as any;
  return supabase.auth.onAuthStateChange(callback);
}
