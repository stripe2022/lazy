// modules/preview.js
import { state } from "./state.js";
import { calcularTotalProductos, getEntregaSeleccionada, normalizarEnvio } from "./carrito.js";

function money(n) {
  const x = Number(n) || 0;
  return `$${Math.round(x)}`;
}

function getClienteInfo() {
  const v = document.getElementById("clienteInfo")?.value || "";
  return v.trim();
}

function getEnvioActual() {
  const entrega = getEntregaSeleccionada();
  if (entrega !== "domicilio") return 0;
  return normalizarEnvio(document.getElementById("envio")?.value);
}

function getResumenPedido() {
  const entrega = getEntregaSeleccionada();
  const envio = getEnvioActual();
  const totalProd = calcularTotalProductos();
  const totalFinal = totalProd + envio;
  return { entrega, envio, totalProd, totalFinal };
}

export function generarVistaPrevia() {
  const box = document.getElementById("previewBox");
  if (!box) return;

  if (state.carrito.length === 0) {
    box.innerHTML = `<div style="text-align:center; opacity:.7;">🛒 Carrito vacío</div>`;
    return;
  }

  const cliente = getClienteInfo();
  const { entrega, envio, totalProd, totalFinal } = getResumenPedido();

  const lineas = [];
  lineas.push(`🧾 *Barylie Pedido*`);
  if (cliente) lineas.push(`👤 ${cliente}`);

  lineas.push(``);
  lineas.push(`🛍️ *Productos*`);
  state.carrito.forEach((it) => {
    const precio = Number(it.precioVenta) || 0;
    const sub = precio * (Number(it.cantidad) || 0);
    lineas.push(`• ${it.nombre}  x${it.cantidad}  =  ${money(sub)}`);
  });

  lineas.push(``);
  lineas.push(`💰 *Total productos:* ${money(totalProd)}`);

  if (entrega === "domicilio") {
    lineas.push(`🛵 *Envío:* ${money(envio)}`);
    lineas.push(`✅ *TOTAL FINAL:* ${money(totalFinal)}`);
    lineas.push(`📍 Entrega: *Domicilio*`);
  } else {
    lineas.push(`📍 Entrega: *Recogida*`);
    lineas.push(`✅ *TOTAL FINAL:* ${money(totalFinal)}`);
  }

  box.textContent = lineas.join("\n");
}

export function copiarVistaPrevia() {
  const box = document.getElementById("previewBox");
  if (!box) return;

  const txt = (box.textContent || "").trim();
  if (!txt || txt.includes("Aún no hay vista previa")) {
    alert("Primero genera la vista previa.");
    return;
  }

  navigator.clipboard.writeText(txt)
    .then(() => alert("✅ Copiado para WhatsApp"))
    .catch(() => alert("❌ No se pudo copiar"));
}
