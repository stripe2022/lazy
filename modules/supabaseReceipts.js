// modules/supabaseReceipts.js
import { logSB, warnSB, errSB } from "./log.js";
import { getPrinterKey, isOnlineNow } from "./supabaseClient.js";

export function supabaseReady(supabase, url, anon) {
  const printerKey = getPrinterKey();
  const ok = !!(supabase && url && anon && printerKey && printerKey.length >= 16);
  if (!ok) {
    warnSB("Config incompleta:", {
      hasClient: !!supabase,
      hasUrl: !!url,
      hasAnon: !!anon,
      hasPrinterKey: !!printerKey,
      printerKeyLen: (printerKey || "").length
    });
  }
  return ok;
}

// precios enteros pero mandamos numeric igual
function getUnitPrice(it) {
  const n = Number(it?.precioVenta ?? it?.precio ?? it?.price ?? it?.unit_price ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

// ✅ Confirmado: costo = precioCosto
function getUnitCost(it) {
  const n = Number(it?.precioCosto ?? it?.costo ?? it?.unit_cost ?? it?.cost ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

function mapEntregaToType(entrega) {
  return (String(entrega) === "domicilio") ? "delivery" : "pickup";
}

export function buildSupabasePayloadFromPedido(p) {
  const type = mapEntregaToType(p?.entrega);
  const delivery_fee = (type === "delivery")
    ? Math.max(0, Math.trunc(Number(p?.envio) || 0))
    : 0;

  const itemsRaw = Array.isArray(p?.items) ? p.items : [];
  const items = itemsRaw.map(it => ({
    product_code: it?.codigo != null ? String(it.codigo) : null,
    name: String(it?.nombre || "").trim(),
    unit_price: getUnitPrice(it),
    unit_cost: getUnitCost(it),
    qty: Math.max(1, parseInt(it?.cantidad, 10) || 1),
  })).filter(x => x.name && x.qty > 0);

  return {
    type,
    info: String(p?.clienteInfo || "").trim(),
    delivery_fee,
    note: "",
    source_app: "lazy",
    items
  };
}

export async function supabaseCreateReceipt({ supabase, SUPABASE_URL, SUPABASE_ANON_KEY }, payload) {
  const printerKey = getPrinterKey();

  if (!supabaseReady(supabase, SUPABASE_URL, SUPABASE_ANON_KEY)) throw new Error("Supabase no configurado.");
  if (!isOnlineNow()) throw new Error("Sin internet.");
  if (!payload?.items?.length) throw new Error("Payload sin items.");
  if (!payload.type) throw new Error("Payload sin type.");

  logSB("➡️ RPC lb_public_create_receipt payload:", payload);

  // ✅ RPC correcta según tu SQL
  const { data, error } = await supabase.rpc("lb_public_create_receipt", {
    p_printer_key: printerKey,
    p_payload: payload
  });

  if (error) {
    errSB("❌ lb_public_create_receipt error:", error);
    throw new Error(error.message || "RPC error");
  }

  logSB("✅ Recibo creado:", data);
  return data; // {receipt_id, token, subtotal, total, ...}
}
