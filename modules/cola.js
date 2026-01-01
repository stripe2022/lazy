// modules/cola.js
import { state } from "./state.js";
import { renderizarCarrito, calcularTotales, initEntregaUI } from "./carrito.js";
import { limpiarBusquedaYSelect } from "./ui.js";

export const COLA_KEY = "barylie_cola_pedidos_v1";

function uuidLite() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function leerCola() {
  try {
    const raw = localStorage.getItem(COLA_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function guardarCola(arr) {
  localStorage.setItem(COLA_KEY, JSON.stringify(arr || []));
}

export function limpiarPedidoActual() {
  state.carrito = [];
  renderizarCarrito();
  calcularTotales();

  document.getElementById("clienteInfo") && (document.getElementById("clienteInfo").value = "");
  document.getElementById("cantidad") && (document.getElementById("cantidad").value = "1");
  limpiarBusquedaYSelect();

  const radioTienda = document.querySelector('input[name="entrega"][value="tienda"]');
  if (radioTienda) radioTienda.checked = true;

  const envioInput = document.getElementById("envio");
  if (envioInput) envioInput.value = "";

  const box = document.getElementById("previewBox");
  if (box) box.innerHTML = `<div style="opacity:.7; text-align:center;">Aún no hay vista previa</div>`;

  initEntregaUI();
}

export function anadirACola() {
  if (!state.carrito || state.carrito.length === 0) {
    alert("Agrega al menos un producto.");
    return;
  }

  const clienteInfo = (document.getElementById("clienteInfo")?.value || "").trim();

  const entrega = document.querySelector('input[name="entrega"]:checked')?.value || "tienda";
  const envio = (entrega === "domicilio") ? Math.max(0, parseInt(document.getElementById("envio")?.value || "0", 10) || 0) : 0;

  const totalProductos = state.carrito.reduce((acc, it) => acc + (Number(it.precioVenta || 0) * Number(it.cantidad || 0)), 0);
  const totalFinal = totalProductos + envio;

  const pedido = {
    id: uuidLite(),
    ts: Date.now(),
    clienteInfo,
    entrega,
    envio,
    totalProductos,
    totalFinal,
    items: state.carrito.map(it => ({
      codigo: it.codigo,
      nombre: it.nombre,
      precioVenta: Number(it.precioVenta) || 0,
      precioCosto: Number(it.precioCosto ?? 0) || 0,
      cantidad: Number(it.cantidad) || 0,
    })),
  };

  const cola = leerCola();
  cola.push(pedido);
  guardarCola(cola);

  alert("✅ Pedido añadido a la cola");
  limpiarPedidoActual();
  renderCola();
}

export function eliminarDeCola(id) {
  const cola = leerCola().filter(p => p.id !== id);
  guardarCola(cola);
  renderCola();
}

export function vaciarCola() {
  if (!confirm("¿Vaciar toda la cola?")) return;
  guardarCola([]);
  renderCola();
}

export function renderCola() {
  const cont = document.getElementById("colaLista");
  if (!cont) return;

  const cola = leerCola();

  if (cola.length === 0) {
    cont.innerHTML = `<div style="opacity:.7; text-align:center; margin-top:1rem;">📭 Cola vacía</div>`;
    return;
  }

  const orden = cola.slice().sort((a,b) => (b.ts||0) - (a.ts||0));

  cont.innerHTML = "";
  orden.forEach((p) => {
    const fecha = new Date(p.ts || Date.now()).toLocaleString("es-ES");

    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.borderRadius = "12px";
    card.style.padding = "1rem";
    card.style.margin = "0.8rem 0";
    card.style.boxShadow = "0 1px 4px rgba(0,0,0,.08)";

    card.innerHTML = `
      <div style="font-weight:bold; font-size:1.05rem;">📦 Pedido</div>
      <div style="opacity:.8; margin-top:.2rem;">🕒 ${fecha}</div>
      <div style="margin-top:.4rem;"><strong>👤</strong> ${p.clienteInfo || "—"}</div>
      <div style="margin-top:.2rem;"><strong>📍</strong> ${p.entrega === "domicilio" ? "Domicilio" : "Recogida"} ${p.entrega === "domicilio" ? `(Envío $${Math.round(p.envio||0)})` : ""}</div>
      <div style="margin-top:.2rem;"><strong>💰</strong> Total final: $${Math.round(p.totalFinal || 0)}</div>

      <div style="display:flex; flex-direction:column; gap:.5rem; margin-top:1rem;">
        <button type="button" style="background:#f44336;color:#fff;font-weight:bold;" data-action="del">🗑 Eliminar</button>
      </div>
    `;

    card.querySelector('[data-action="del"]').addEventListener("click", () => eliminarDeCola(p.id));
    cont.appendChild(card);
  });
}
