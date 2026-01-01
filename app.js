import { initDB, importarProductos } from "./modules/dbIndexedDB.js";
import { abrirPantalla } from "./modules/ui.js";
import {
  agregarProducto,
  eliminarProducto,
  setEnvio,
  initEntregaUI,
  renderizarCarrito,
  calcularTotales
} from "./modules/carrito.js";

import {
  anadirACola,
  vaciarCola,
  renderCola,
  editarPedidoEnCola,
  cancelarEdicion,
  refreshEditUI
} from "./modules/cola.js";

window.addEventListener("DOMContentLoaded", () => {
  initDB();

  document.getElementById("importarProductosInput")
    ?.addEventListener("change", importarProductos);
});

document.addEventListener("pantalla1:open", () => {
  initEntregaUI();
  renderizarCarrito();
  calcularTotales();
  refreshEditUI();
});

document.addEventListener("cola:open", () => {
  renderCola();
});

/* ===== HTML hooks ===== */
window.abrirPantalla = abrirPantalla;
window.agregarProducto = agregarProducto;
window.eliminarProducto = eliminarProducto;
window.setEnvio = setEnvio;

window.anadirACola = anadirACola;
window.vaciarCola = vaciarCola;
window.editarPedidoEnCola = editarPedidoEnCola;
window.cancelarEdicion = cancelarEdicion;
