// modules/cola.js
import { state } from "./state.js";
import { renderizarCarrito, calcularTotales, initEntregaUI } from "./carrito.js";
import { limpiarBusquedaYSelect, abrirPantalla } from "./ui.js";

export const COLA_KEY = "barylie_cola_pedidos_v1";

// ================== utils ==================
function uuidLite() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function int0(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function getEntregaSeleccionada() {
  return document.querySelector('input[name="entrega"]:checked')?.value || "tienda";
}

function normalizarEnvio(valor) {
  const n = int0(valor);
  return n < 0 ? 0 : n;
}

function copiarTexto(txt, okMsg) {
  navigator.clipboard.writeText(txt)
    .then(() => alert(okMsg || "✅ Copiado"))
    .catch(() => alert("❌ No se pudo copiar"));
}

// Texto WhatsApp desde un pedido guardado
function buildPreviewTextFromPedido(pedido) {
  const lineas = [];
  lineas.push(`🧾 *Barylie Pedido*`);
  if (pedido.clienteInfo) lineas.push(`👤 ${pedido.clienteInfo}`);
  lineas.push(``);
  lineas.push(`🛍️ *Productos*`);

  (pedido.items || []).forEach(it => {
    const sub = (Number(it.precioVenta) || 0) * (Number(it.cantidad) || 0);
    lineas.push(`• ${it.nombre}  x${it.cantidad}  =  $${Math.round(sub)}`);
  });

  lineas.push(``);
  lineas.push(`💰 *Total productos:* $${Math.round(pedido.totalProductos || 0)}`);

  if (pedido.entrega === "domicilio") {
    lineas.push(`🛵 *Envío:* $${Math.round(pedido.envio || 0)}`);
    lineas.push(`✅ *TOTAL FINAL:* $${Math.round(pedido.totalFinal || 0)}`);
    lineas.push(`📍 Entrega: *Domicilio*`);
  } else {
    lineas.push(`📍 Entrega: *Recogida*`);
    lineas.push(`✅ *TOTAL FINAL:* $${Math.round(pedido.totalFinal || 0)}`);
  }

  return lineas.join("\n");
}

// ================== storage ==================
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

// ================== modo edición UI ==================
function getBtnAccionCola() {
  // Botón existente en tu index: <button onclick="anadirACola()">
  return document.querySelector('#pedido button[onclick="anadirACola()"]');
}

export function setModoEdicionUI(estado) {
  const btn = getBtnAccionCola();
  if (btn) {
    btn.textContent = estado ? "✅ Guardar cambios" : "➕ Añadir a cola (limpia automático)";
  }

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

    if (btn && btn.parentElement) btn.insertAdjacentElement("afterend", cancelBtn);
  }

  cancelBtn.style.display = estado ? "block" : "none";
}

export function refreshEdicionUI() {
  setModoEdicionUI(!!state.editingId);
}

export function cancelarEdicion() {
  state.editingId = null;
  setModoEdicionUI(false);
  limpiarPedidoActual();
}

// ================== helpers pedido->form ==================
function cargarPedidoEnFormulario(pedido) {
  if (!pedido) return;

  const inpCliente = document.getElementById("clienteInfo");
  if (inpCliente) inpCliente.value = pedido.clienteInfo || "";

  const radioTienda = document.querySelector('input[name="entrega"][value="tienda"]');
  const radioDom = document.querySelector('input[name="entrega"][value="domicilio"]');

  if (pedido.entrega === "domicilio") {
    if (radioDom) radioDom.checked = true;
    const envioInput = document.getElementById("envio");
    if (envioInput) envioInput.value = String(normalizarEnvio(pedido.envio || 0));
  } else {
    if (radioTienda) radioTienda.checked = true;
    const envioInput = document.getElementById("envio");
    if (envioInput) envioInput.value = "";
  }

  const items = Array.isArray(pedido.items) ? pedido.items : [];
  state.carrito = items.map(it => ({
    codigo: it.codigo,
    nombre: it.nombre,
    precioVenta: Number(it.precioVenta) || 0,
    // ✅ costo desde JSON (tu campo)
    precioCosto: Number(it.precioCosto ?? it.costo ?? 0) || 0,
    cantidad: Number(it.cantidad) || 0
  })).filter(x => x.nombre && x.cantidad > 0);

  renderizarCarrito();
  initEntregaUI();
  calcularTotales();

  // Si existe una función global para vista previa, la llamamos
  if (typeof window.generarVistaPrevia === "function") {
    try { window.generarVistaPrevia(); } catch {}
  }
}

export function editarPedidoEnCola(id) {
  const cola = leerCola();
  const pedido = cola.find(p => p.id === id);
  if (!pedido) {
    alert("❌ No encontré ese pedido en la cola");
    return;
  }

  state.editingId = id;
  setModoEdicionUI(true);

  // Abre pantalla pedido (esto dispara pantalla1:open)
  abrirPantalla("pedido");
  cargarPedidoEnFormulario(pedido);
}

export function guardarCambiosEnCola() {
  if (!state.editingId) return;

  if (!state.carrito || state.carrito.length === 0) {
    alert("Agrega al menos un producto.");
    return;
  }

  const clienteInfo = (document.getElementById("clienteInfo")?.value || "").trim();
  const entrega = getEntregaSeleccionada();
  const envio = (entrega === "domicilio") ? normalizarEnvio(document.getElementById("envio")?.value) : 0;

  const totalProductos = state.carrito.reduce((acc, it) => acc + (Number(it.precioVenta || 0) * Number(it.cantidad || 0)), 0);
  const totalFinal = totalProductos + envio;

  const cola = leerCola();
  const idx = cola.findIndex(p => p.id === state.editingId);

  if (idx === -1) {
    alert("❌ No encontré ese pedido para actualizar");
    state.editingId = null;
    setModoEdicionUI(false);
    return;
  }

  cola[idx] = {
    ...cola[idx],
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

  guardarCola(cola);

  alert("✅ Cambios guardados");
  state.editingId = null;
  setModoEdicionUI(false);
  limpiarPedidoActual();

  abrirPantalla("cola");
  renderCola();
}

// ================== limpiar ==================
export function limpiarPedidoActual() {
  state.carrito = [];
  renderizarCarrito();
  calcularTotales();

  const ci = document.getElementById("clienteInfo");
  if (ci) ci.value = "";

  const cant = document.getElementById("cantidad");
  if (cant) cant.value = "1";

  limpiarBusquedaYSelect();

  const radioTienda = document.querySelector('input[name="entrega"][value="tienda"]');
  if (radioTienda) radioTienda.checked = true;

  const envioInput = document.getElementById("envio");
  if (envioInput) envioInput.value = "";

  const box = document.getElementById("previewBox");
  if (box) box.innerHTML = `<div style="opacity:.7; text-align:center;">Aún no hay vista previa</div>`;

  initEntregaUI();
  setModoEdicionUI(!!state.editingId);
}

// ================== crear / guardar ==================
export function anadirACola() {
  // ✅ si estás editando -> guarda cambios
  if (state.editingId) {
    guardarCambiosEnCola();
    return;
  }

  if (!state.carrito || state.carrito.length === 0) {
    alert("Agrega al menos un producto.");
    return;
  }

  const clienteInfo = (document.getElementById("clienteInfo")?.value || "").trim();
  const entrega = getEntregaSeleccionada();
  const envio = (entrega === "domicilio") ? normalizarEnvio(document.getElementById("envio")?.value) : 0;

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
      // ✅ costo
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

// ================== render cola (con Editar) ==================
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
  orden.forEach((p, idx) => {
    const fecha = new Date(p.ts || Date.now()).toLocaleString("es-ES");
    const preview = buildPreviewTextFromPedido(p);

    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.borderRadius = "12px";
    card.style.padding = "1rem";
    card.style.margin = "0.8rem 0";
    card.style.boxShadow = "0 1px 4px rgba(0,0,0,.08)";

    card.innerHTML = `
      <div style="font-weight:bold; font-size:1.05rem;">📦 Pedido ${orden.length - idx}</div>
      <div style="opacity:.8; margin-top:.2rem;">🕒 ${fecha}</div>
      <div style="margin-top:.4rem;"><strong>👤</strong> ${p.clienteInfo || "—"}</div>
      <div style="margin-top:.2rem;"><strong>📍</strong> ${p.entrega === "domicilio" ? "Domicilio" : "Recogida"} ${p.entrega === "domicilio" ? `(Envío $${Math.round(p.envio||0)})` : ""}</div>
      <div style="margin-top:.2rem;"><strong>💰</strong> Total final: $${Math.round(p.totalFinal || 0)}</div>

      <div style="display:flex; flex-direction:column; gap:.5rem; margin-top:1rem;">
        <button type="button" style="font-weight:bold;" data-action="copy-wp">📋 Copiar WhatsApp</button>
        <button type="button" style="font-weight:bold;" data-action="edit">✏️ Editar</button>
        <button type="button" style="background:#f44336;color:#fff;font-weight:bold;" data-action="del">🗑 Eliminar</button>
      </div>
    `;

    card.querySelector('[data-action="copy-wp"]').addEventListener("click", () => copiarTexto(preview, "✅ WhatsApp copiado"));
    card.querySelector('[data-action="edit"]').addEventListener("click", () => editarPedidoEnCola(p.id));
    card.querySelector('[data-action="del"]').addEventListener("click", () => eliminarDeCola(p.id));

    cont.appendChild(card);
  });
}
