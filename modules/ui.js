// modules/ui.js
import { state } from "./state.js";

export function abrirPantalla(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");

  if (id === "pedido") document.dispatchEvent(new Event("pantalla1:open"));
  if (id === "cola") document.dispatchEvent(new Event("cola:open"));
}

export function actualizarTotalProductosUI() {
  const totalEl = document.getElementById("total-productos");
  if (totalEl) totalEl.textContent = String(state.productos.length);
}

// Select consistente
export function poblarSelectConLista(lista) {
  const select = document.getElementById("producto");
  if (!select) return;

  state.productosEnSelect = (lista || [])
    .slice()
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  select.innerHTML = '<option value="">-- Selecciona un producto --</option>';

  state.productosEnSelect.forEach((p, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = p.nombre || "(sin nombre)";
    select.appendChild(opt);
  });
}

// Búsqueda
export function initBusqueda() {
  const inputBusqueda = document.getElementById("busqueda");
  if (!inputBusqueda) return;

  poblarSelectConLista(state.productos);

  inputBusqueda.addEventListener("input", (e) => {
    const q = (e.target.value || "").trim().toLowerCase();
    const filtrados = !q
      ? state.productos.slice()
      : state.productos.filter(p => String(p?.nombre || "").toLowerCase().includes(q));

    poblarSelectConLista(filtrados);
  });
}

export function limpiarBusquedaYSelect() {
  const busq = document.getElementById("busqueda");
  if (!busq) return;
  busq.value = "";
  poblarSelectConLista(state.productos);
  busq.focus();
}
