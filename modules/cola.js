// modules/cola.js
import { state } from "./state.js";
import {
  calcularTotalProductos,
  getEntregaSeleccionada,
  normalizarEnvio,
  renderizarCarrito,
  initEntregaUI,
  calcularTotales
} from "./carrito.js";

import { abrirPantalla } from "./ui.js";

/* ================== COLA (storage) ================== */
const COLA_KEY = "barylie_cola_pedidos_v1";

function leerCola() {
  try {
    const raw = localStorage.getItem(COLA_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function guardarCola(arr) {
  localStorage.setItem(COLA_KEY, JSON.stringify(arr || []));
}

/* ================== UI EDICIÓN ================== */
function getBtnAccionCola() {
  return document.querySelector('#pedido button[onclick="anadirACola()"]');
}

export function refreshEditUI() {
  const btn = getBtnAccionCola();
  if (!btn) return;

  btn.textContent = state.editingId
    ? "✅ Guardar cambios"
    : "➕ Añadir a cola (limpia automático)";

  let cancelBtn = document.getElementById("btnCancelarEdicion");
  if (!cancelBtn) {
    cancelBtn = document.createElement("button");
    cancelBtn.id = "btnCancelarEdicion";
    cancelBtn.type = "button";
    cancelBtn.textContent = "❌ Cancelar edición";
    cancelBtn.style.marginTop = "0.5rem";
    cancelBtn.style.background = "#ccc";
    cancelBtn.style.fontWeight = "bold";
    cancelBtn.onclick = cancelarEdicion;
    btn.insertAdjacentElement("afterend", cancelBtn);
  }

  cancelBtn.style.display = state.editingId ? "block" : "none";
}

export function cancelarEdicion() {
  state.editingId = null;
  state.carrito = [];
  renderizarCarrito();
  calcularTotales();
  refreshEditUI();
}

/* ================== EDITAR ================== */
export function editarPedidoEnCola(id) {
  const cola = leerCola();
  const pedido = cola.find(p => p.id === id);
  if (!pedido) {
    alert("❌ No encontré ese pedido");
    return;
  }

  state.editingId = id;

  // cargar datos
  document.getElementById("clienteInfo").value = pedido.clienteInfo || "";

  if (pedido.entrega === "domicilio") {
    document.querySelector('input[value="domicilio"]').checked = true;
    document.getElementById("envio").value = pedido.envio || 0;
  } else {
    document.querySelector('input[value="tienda"]').checked = true;
    document.getElementById("envio").value = "";
  }

  state.carrito = pedido.items.map(it => ({
    codigo: it.codigo,
    nombre: it.nombre,
    precioVenta: Number(it.precioVenta) || 0,
    precioCosto: Number(it.precioCosto ?? 0) || 0,
    cantidad: Number(it.cantidad) || 0
  }));

  abrirPantalla("pedido");
  renderizarCarrito();
  initEntregaUI();
  calcularTotales();
  refreshEditUI();
}

/* ================== GUARDAR / AÑADIR ================== */
export function anadirACola() {
  if (!state.carrito.length) {
    alert("Agrega al menos un producto.");
    return;
  }

  if (state.editingId) {
    guardarCambiosEnCola();
    return;
  }

  const pedido = buildPedido();
  const cola = leerCola();
  cola.push(pedido);
  guardarCola(cola);

  limpiarActual();
  renderCola();
}

function guardarCambiosEnCola() {
  const cola = leerCola();
  const idx = cola.findIndex(p => p.id === state.editingId);
  if (idx === -1) return;

  cola[idx] = { ...cola[idx], ...buildPedido(), id: state.editingId };
  guardarCola(cola);

  state.editingId = null;
  limpiarActual();
  renderCola();
}

function buildPedido() {
  const entrega = getEntregaSeleccionada();
  const envio = entrega === "domicilio"
    ? normalizarEnvio(document.getElementById("envio").value)
    : 0;

  const totalProductos = calcularTotalProductos();

  return {
    id: crypto.randomUUID(),
    ts: Date.now(),
    clienteInfo: document.getElementById("clienteInfo").value.trim(),
    entrega,
    envio,
    totalProductos,
    totalFinal: totalProductos + envio,
    items: state.carrito.map(it => ({ ...it }))
  };
}

function limpiarActual() {
  state.carrito = [];
  renderizarCarrito();
  calcularTotales();
  document.getElementById("clienteInfo").value = "";
  document.getElementById("envio").value = "";
  refreshEditUI();
}

/* ================== RENDER ================== */
export function renderCola() {
  const cont = document.getElementById("colaLista");
  if (!cont) return;

  const cola = leerCola();
  if (!cola.length) {
    cont.innerHTML = `<div style="opacity:.7;text-align:center;">📭 Cola vacía</div>`;
    return;
  }

  cont.innerHTML = "";
  cola.sort((a,b)=>b.ts-a.ts).forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <strong>👤 ${p.clienteInfo || "—"}</strong><br>
      💰 $${p.totalFinal}
      <div style="margin-top:.5rem;display:flex;gap:.5rem;">
        <button data-edit>✏️ Editar</button>
        <button data-del style="background:#f44336;color:#fff;">🗑</button>
      </div>
    `;
    card.querySelector("[data-edit]").onclick = () => editarPedidoEnCola(p.id);
    card.querySelector("[data-del]").onclick = () => {
      guardarCola(cola.filter(x => x.id !== p.id));
      renderCola();
    };
    cont.appendChild(card);
  });
}

export function vaciarCola() {
  if (!confirm("¿Vaciar toda la cola?")) return;
  guardarCola([]);
  renderCola();
}
