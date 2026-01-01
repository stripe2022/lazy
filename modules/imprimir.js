// modules/imprimir.js
import { escapeHtml } from "./printUtil.js";
import { leerCola } from "./cola.js";
import { logPR } from "./log.js";
import { buildSupabasePayloadFromPedido, supabaseCreateReceipt } from "./supabaseReceipts.js";
import { isOnlineNow } from "./supabaseClient.js";

export async function imprimirCola(ctx) {
  const cola = leerCola();
  if (!cola || cola.length === 0) return alert("📭 La cola está vacía");
  await imprimirListaPedidos(ctx, cola);
}

export async function imprimirColaPorTipo(ctx, tipo) {
  const cola = leerCola();
  if (!cola || cola.length === 0) return alert("📭 La cola está vacía");

  const filtrada = cola.filter(p => String(p.entrega) === String(tipo));
  if (filtrada.length === 0) {
    return alert(tipo === "domicilio"
      ? "📭 No hay pedidos de DOMICILIO en la cola"
      : "📭 No hay pedidos de RECOGIDA en la cola"
    );
  }

  await imprimirListaPedidos(ctx, filtrada);
}

export async function imprimirListaPedidos(ctx, lista) {
  const orden = (lista || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
  logPR("imprimirListaPedidos()", { pedidos: orden.length, online: isOnlineNow() });

  let html = baseHtmlStart();

  for (const p of orden) {
    const cliente = p.clienteInfo || "—";
    const entregaTxt = p.entrega === "domicilio" ? "Domicilio" : "Recogida";

    const items = Array.isArray(p.items) ? p.items : [];
    const totalProd = Math.round(Number(p.totalProductos) || 0);
    const envio = Math.round(Number(p.envio) || 0);
    const totalFinal = Math.round(Number(p.totalFinal) || (totalProd + (p.entrega === "domicilio" ? envio : 0)));

    let qrText = null;
    let supabaseError = null;

    try {
      const payload = buildSupabasePayloadFromPedido(p);
      const created = await supabaseCreateReceipt(ctx, payload);

      const receipt_id = created?.receipt_id || null;
      const token = created?.token || null;

      if (receipt_id && token) qrText = `LB|${receipt_id}|${token}`;
      else supabaseError = "Respuesta RPC sin receipt_id/token";

    } catch (e) {
      supabaseError = e?.message || String(e);
    }

    html += `
    <div class="pedido">
      <div class="row">
        <div class="cliente">👤 ${escapeHtml(cliente)}</div>
        <div><span class="tag">Entrega:</span> ${escapeHtml(entregaTxt)}</div>
      </div>

      <div><span class="tag">Productos:</span></div>
      <ul>
        ${items.map(it => {
          const nombre = it?.nombre || "";
          const cant = Number(it?.cantidad) || 0;
          const precio = Number(it?.precioVenta) || 0;
          const sub = Math.round(precio * cant);
          return `<li>${escapeHtml(nombre)} x${cant} — ${sub}</li>`;
        }).join("")}
      </ul>

      <div class="totales">
        <div class="row"><div><span class="tag">Total productos:</span></div><div>$${totalProd}</div></div>
        ${p.entrega === "domicilio"
          ? `<div class="row"><div><span class="tag">Envío:</span></div><div>$${envio}</div></div>`
          : ``}
        <div class="row" style="font-weight:800;"><div><span class="tag">Total final:</span></div><div>$${totalFinal}</div></div>
      </div>

      <div class="qrbox">
        ${qrText
          ? `<div><span class="tag">QR:</span> <span class="mono">${escapeHtml(qrText)}</span></div>`
          : `<div class="warn">SIN QR (offline o error)</div>
             <div class="mono" style="opacity:.75;">${escapeHtml(supabaseError || "desconocido")}</div>`
        }
      </div>
    </div>
    `;
  }

  html += baseHtmlEnd();

  const w = window.open("", "_blank");
  if (!w) return alert("❌ No se pudo abrir la ventana de impresión.");

  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

function baseHtmlStart() {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Imprimir</title>
<style>
  @page { margin: 6mm; }
  body{ font-family: system-ui, Arial, sans-serif; margin:0; color:#111; font-size:11px; line-height:1.15; }
  .pedido{ break-inside: avoid; border:1px solid #bbb; border-radius:6px; padding:6px; margin:0 0 6px 0; }
  .row{ display:flex; justify-content:space-between; gap:6px; }
  .cliente{ font-weight:700; margin:2px 0 4px 0; }
  ul{ margin:2px 0 4px 10px; padding:0; }
  li{ margin:1px 0; }
  .totales{ margin-top:4px; border-top:1px dashed #aaa; padding-top:4px; }
  .totales .row{ margin:1px 0; }
  .tag{ font-weight:700; }
  .qrbox{ margin-top:6px; border-top:1px dashed #aaa; padding-top:6px; font-size:10px; }
  .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break: break-all; }
  .warn{ color:#b00020; font-weight:800; }
</style>
</head>
<body>
`;
}
function baseHtmlEnd(){ return `</body></html>`; }
