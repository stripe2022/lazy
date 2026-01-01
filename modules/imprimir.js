// modules/imprimir.js
import { leerCola } from "./cola.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildHtmlFromPedidos(lista) {
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
</style>
</head>
<body>
`;

  orden.forEach((p) => {
    const cliente = p.clienteInfo || "—";
    const entregaTxt = p.entrega === "domicilio" ? "Domicilio" : "Recogida";

    const items = Array.isArray(p.items) ? p.items : [];
    const totalProd = Math.round(Number(p.totalProductos) || 0);
    const envio = Math.round(Number(p.envio) || 0);
    const totalFinal = Math.round(
      Number(p.totalFinal) || (totalProd + (p.entrega === "domicilio" ? envio : 0))
    );

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
    </div>
`;
  });

  html += `
</body>
</html>
`;
  return html;
}

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

// ✅ imprime TODO
export function imprimirCola() {
  const cola = leerCola();
  if (!cola || cola.length === 0) {
    alert("📭 La cola está vacía");
    return;
  }
  console.log("🖨️ imprimirCola() pedidos:", cola.length);
  openPrintWindow(buildHtmlFromPedidos(cola));
}

// ✅ imprime por tipo: 'domicilio' o 'tienda'
export function imprimirColaPorTipo(tipo) {
  const cola = leerCola();
  if (!cola || cola.length === 0) {
    alert("📭 La cola está vacía");
    return;
  }

  const filtrada = cola.filter(p => String(p.entrega) === String(tipo));
  if (filtrada.length === 0) {
    alert(tipo === "domicilio"
      ? "📭 No hay pedidos de DOMICILIO en la cola"
      : "📭 No hay pedidos de RECOGIDA en la cola"
    );
    return;
  }

  console.log("🖨️ imprimirColaPorTipo()", tipo, "pedidos:", filtrada.length);
  openPrintWindow(buildHtmlFromPedidos(filtrada));
}
