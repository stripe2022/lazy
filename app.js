// ================== app.js (ENTRY POINT) ==================

// ===== DB / Estado local =====
import { initDB, importarProductos } from "./modules/dbIndexedDB.js";

// ===== UI =====
import {
  abrirPantalla,
  generarVistaPrevia,
  copiarVistaPrevia
} from "./modules/ui.js";

// ===== Carrito =====
import {
  agregarProducto,
  eliminarProducto,
  setEnvio,
  initEntregaUI,
  renderizarCarrito,
  calcularTotales
} from "./modules/carrito.js";

// ===== Cola + Edición =====
import {
  anadirACola,
  vaciarCola,
  renderCola,
  editarPedidoEnCola,
  cancelarEdicion,
  refreshEditUI
} from "./modules/cola.js";

// ==========================================================
// ================== BOOTSTRAP APP ==========================
// ==========================================================

window.addEventListener("DOMContentLoaded", () => {
  // Inicializar IndexedDB
  initDB();

  // Importar productos
  document
    .getElementById("importarProductosInput")
    ?.addEventListener("change", importarProductos);
});

// ==========================================================
// ================== EVENTOS DE PANTALLA ====================
// ==========================================================

// Cuando se abre la pantalla de pedido
document.addEventListener("pantalla1:open", () => {
  initEntregaUI();
  renderizarCarrito();
  calcularTotales();

  // 🔑 IMPORTANTE: refresca UI si estamos editando
  refreshEditUI();

  document.getElementById("busqueda")?.focus();
});

// Cuando se abre la pantalla de cola
document.addEventListener("cola:open", () => {
  renderCola();
});

// ==========================================================
// ================== EXPONER A HTML =========================
// ==========================================================
// (Necesario porque index.html usa onclick="...")

window.abrirPantalla = abrirPantalla;

// ---- carrito ----
window.agregarProducto = agregarProducto;
window.eliminarProducto = eliminarProducto;
window.setEnvio = setEnvio;

// ---- vista previa WhatsApp ----
window.generarVistaPrevia = generarVistaPrevia;
window.copiarVistaPrevia = copiarVistaPrevia;

// ---- cola ----
window.anadirACola = anadirACola;
window.vaciarCola = vaciarCola;

// ---- edición ----
window.editarPedidoEnCola = editarPedidoEnCola;
window.cancelarEdicion = cancelarEdicion;
