// modules/supabaseClient.js
import { CONFIG } from "./config.js";
import { logSB, warnSB } from "./log.js";

// Guarda PRINTER_KEY en localStorage (y la restaura si se borra)
export function getPrinterKey() {
  let key = localStorage.getItem(CONFIG.PRINTER_KEY_LS);
  if (!key) {
    key = CONFIG.PRINTER_KEY_FALLBACK;
    try {
      localStorage.setItem(CONFIG.PRINTER_KEY_LS, key);
      logSB("🟢 PRINTER_KEY restaurada en localStorage (fallback).");
    } catch (e) {
      warnSB("🟠 No se pudo guardar PRINTER_KEY en localStorage:", e);
    }
  } else {
    logSB("🟢 PRINTER_KEY cargada desde localStorage.");
  }
  return key;
}

export function isOnlineNow(){ return navigator.onLine === true; }

export async function createSupabaseClient() {
  // ESM import dinámico (CDN)
  // (Alternativa también funciona: https://esm.sh/@supabase/supabase-js@2 )
  const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  const { createClient } = mod;

  const url = CONFIG.SUPABASE_URL;
  const anon = CONFIG.SUPABASE_ANON_KEY;

  const client = createClient(url, anon, {
    auth: { persistSession: false },
  });

  return client;
}
