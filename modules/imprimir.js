// modules/imprimir.js
import { leerCola } from "./cola.js";
import { CONFIG, getPrinterKey } from "./config.js";


// ================== utils ==================
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isOnlineNow() {
  return navigator.onLine === true;
}

// Tus precios son enteros ✅
function getUnitPrice(it) {
  const n = Number(it?.precioVenta ?? it?.precio ?? it?.price ?? it?.unit_price ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

// En tu JSON el costo viene como precioCosto ✅
function getUnitCost(it) {
  const n = Number(it?.precioCosto ?? it?.costo ?? it?.unit_cost ?? it?.cost ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

function mapEntregaToType(entrega) {
  return String(entrega) === "domicilio" ? "delivery" : "pickup";
}

function buildPayloadFromPedido(p) {
  const type = mapEntregaToType(p?.entrega);

  const delivery_fee =
    type === "delivery" ? Math.max(0, Math.trunc(Number(p?.envio) || 0)) : 0;

  const itemsRaw = Array.isArray(p?.items) ? p.items : [];
  const items = itemsRaw
    .map((it) => ({
      product_code: it?.codigo != null ? String(it.codigo) : null,
      name: String(it?.nombre || "").trim(),
      unit_price: getUnitPrice(it),
      unit_cost: getUnitCost(it),
      qty: Math.max(1, parseInt(it?.cantidad, 10) || 1),
    }))
    .filter((x) => x.name && x.qty > 0);

  return {
    type,
    info: String(p?.clienteInfo || "").trim(),
    delivery_fee,
    note: "",
    source_app: "lazy",
    items,
  };
}



async function createReceiptInSupabase(ctx, payload) {
  const supabase = ctx?.supabase;

  if (!supabase) throw new Error("Supabase client no existe en ctx");
  if (!isOnlineNow()) throw new Error("Offline (sin internet)");
  if (!payload?.items?.length) throw new Error("Payload sin items");

  const PRINTER_KEY = getPrinterKey();

  if (!PRINTER_KEY || PRINTER_KEY.length < 16) {
    throw new Error("PRINTER_KEY no encontrada en localStorage (LAZY_PRINTER_KEY)");
  }

  console.log("🟣[LAZY/SUPABASE] RPC lb_public_create_receipt ->", {
    type: payload.type,
    items: payload.items.length,
    delivery_fee: payload.delivery_fee,
    infoLen: (payload.info || "").length,
  });

  const { data, error } = await supabase.rpc("lb_public_create_receipt", {
    p_printer_key: PRINTER_KEY,
    p_payload: payload,
  });

  if (error) {
    console.error("🔴[LAZY/SUPABASE] RPC error:", error);
    throw new Error(error.message || "RPC error");
  }

  // Esperamos {receipt_id, token, ...}
  const receipt_id = data?.receipt_id;
  const token = data?.token;

  if (!receipt_id || !token) {
    console.warn("🟠[LAZY/SUPABASE] Respuesta sin receipt_id/token:", data);
    throw new Error("Respuesta RPC sin receipt_id/token");
  }

  console.log("🟢[LAZY/SUPABASE] Recibo creado:", { receipt_id, token });
  return { receipt_id, token, raw: data };
}

/* =========================================================
   ✅ NUEVO: QR como imagen (PNG dataURL) usando CDN "qrcode"
   Requiere en index.html:
   <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
   ========================================================= */
async function qrToDataUrl(text) {
  if (!text) return null;

  // librería global del CDN
  if (!window.QRCode || typeof window.QRCode.toDataURL !== "function") {
    console.warn("🟠[QR] Falta el CDN de qrcode. No se puede generar imagen.");
    return null;
  }

  try {
    // Ajusta width según tu impresión
    return await window.QRCode.toDataURL(String(text), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 180,
    });
  } catch (e) {
    console.error("🔴[QR] Error generando PNG:", e);
    return null;
  }
}

// ================== impresión ==================
function openPrintWindow(html) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("❌ No se pudo abrir la ventana de impresión.");
    return;
  }

  w.document.open();
  w.document.write(html);
  w.document.close();

  w.onload = () => {
    w.focus();
    w.print();
  };
}

// Genera HTML PERO ahora incluye QR (si se pudo crear receipt)
async function buildHtmlFromPedidosOnlineFirst(ctx, lista) {
  const orden = (lista || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));

  let html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Imprimir</title>
<style>
  @page { margin: 6mm; }
  body{
    font-family: system-ui, Arial, sans-serif;
    margin: 0;
    color: #111;
    font-size: 11px;
    line-height: 1.15;
  }
  .pedido{
    break-inside: avoid;
    border: 1px solid #bbb;
    border-radius: 6px;
    padding: 6px;
    margin: 0 0 6px 0;
  }
  .row{ display:flex; justify-content:space-between; gap:6px; }
  .cliente{ font-weight:700; margin:2px 0 4px 0; }
  ul{ margin:2px 0 4px 10px; padding:0; }
  li{ margin:1px 0; }
  .totales{ margin-top:4px; border-top:1px dashed #aaa; padding-top:4px; }
  .totales .row{ margin:1px 0; }
  .tag{ font-weight:700; }

  .qrbox{
    margin-top:6px;
    border-top:1px dashed #aaa;
    padding-top:6px;
    font-size:10px;
    text-align:center;
  }
  .mono{
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    word-break: break-all;
  }
  .warn{ color:#b00020; font-weight:800; }

  /* ✅ NUEVO: QR en imagen centrada */
  .qrwrap{
    margin-top:6px;
    display:flex;
    justify-content:center;
    align-items:center;
  }
  .qrimg{
    width: 170px;
    height: 170px;
    object-fit: contain;
  }
  .qrtext{
    margin-top:4px;
    text-align:center;
    font-size:9px;
    opacity:.75;
  }
</style>
</head>
<body>
`;

  for (const p of orden) {
    const cliente = p.clienteInfo || "—";
    const entregaTxt = p.entrega === "domicilio" ? "Domicilio" : "Recogida";

    const items = Array.isArray(p.items) ? p.items : [];
    const totalProd = Math.round(Number(p.totalProductos) || 0);
    const envio = Math.round(Number(p.envio) || 0);
    const totalFinal = Math.round(
      Number(p.totalFinal) || (totalProd + (p.entrega === "domicilio" ? envio : 0))
    );

    let qrText = "";
    let qrErr = "";
    let qrImg = null;

    try {
      const payload = buildPayloadFromPedido(p);
      const created = await createReceiptInSupabase(ctx, payload);
      qrText = `LB|${created.receipt_id}|${created.token}`;

      // ✅ convertir texto -> PNG dataURL
      qrImg = await qrToDataUrl(qrText);
      if (!qrImg) {
        // si falla la imagen, al menos imprimimos el texto
        console.warn("🟠[QR] No pude generar imagen, dejo texto.");
      }
    } catch (e) {
      qrErr = e?.message || String(e);
      console.warn("🟠[PRINT] Sin QR (fallback):", qrErr);
    }

    html += `
    <div class="pedido">
      <div class="row">
        <div class="cliente">👤 ${escapeHtml(cliente)}</div>
        <div><span class="tag">Entrega:</span> ${escapeHtml(entregaTxt)}</div>
      </div>

      <div><span class="tag">Productos:</span></div>
      <ul>
        ${items
          .map((it) => {
            const nombre = it?.nombre || "";
            const cant = Number(it?.cantidad) || 0;
            const precio = Number(it?.precioVenta) || 0;
            const sub = Math.round(precio * cant);
            return `<li>${escapeHtml(nombre)} x${cant} — ${sub}</li>`;
          })
          .join("")}
      </ul>

      <div class="totales">
        <div class="row"><div><span class="tag">Total productos:</span></div><div>$${totalProd}</div></div>
        ${
          p.entrega === "domicilio"
            ? `<div class="row"><div><span class="tag">Envío:</span></div><div>$${envio}</div></div>`
            : ``
        }
        <div class="row" style="font-weight:800;"><div><span class="tag">Total final:</span></div><div>$${totalFinal}</div></div>
      </div>

      <div class="qrbox" style="text-align:center;">
  ${
    qrText
      ? `
        <div style="margin:6px 0;">
        <img
         src="${buildQrImageUrl(qrText, 70)}"
        alt="QR"
        style="width:60px;height:60px;"
        />


        </div>
        <div class="mono" style="font-size:9px;opacity:.7;">
          ${escapeHtml(qrText)}
        </div>
      `
      : `
        <div class="warn">SIN QR (offline o error)</div>
        <div class="mono" style="opacity:.75;">
          ${escapeHtml(qrErr || "desconocido")}
        </div>
      `
  }
</div>

    </div>
`;
  }

  html += `
</body>
</html>
`;
  return html;
}

// ================== API pública ==================

// ✅ imprime TODO (online-first)
export async function imprimirCola(ctx) {
  const cola = leerCola();
  if (!cola || cola.length === 0) {
    alert("📭 La cola está vacía");
    return;
  }
  console.log("🖨️ imprimirCola() pedidos:", cola.length, "online:", isOnlineNow());
  const html = await buildHtmlFromPedidosOnlineFirst(ctx, cola);
  openPrintWindow(html);
}

// ✅ imprime por tipo: 'domicilio' o 'tienda'
export async function imprimirColaPorTipo(ctx, tipo) {
  const cola = leerCola();
  if (!cola || cola.length === 0) {
    alert("📭 La cola está vacía");
    return;
  }

  const filtrada = cola.filter((p) => String(p.entrega) === String(tipo));
  if (filtrada.length === 0) {
    alert(
      tipo === "domicilio"
        ? "📭 No hay pedidos de DOMICILIO en la cola"
        : "📭 No hay pedidos de RECOGIDA en la cola"
    );
    return;
  }

  console.log("🖨️ imprimirColaPorTipo()", tipo, "pedidos:", filtrada.length, "online:", isOnlineNow());
  const html = await buildHtmlFromPedidosOnlineFirst(ctx, filtrada);
  openPrintWindow(html);
}
function buildQrImageUrl(qrText, size = 180) {
  const encoded = encodeURIComponent(qrText);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
}

