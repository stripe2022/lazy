// app.js (ENTRY - módulo)
import { initDB, importarProductos } from "./modules/dbIndexedDB.js";
import { abrirPantalla, initBusqueda } from "./modules/ui.js";
import { imprimirCola, imprimirColaPorTipo } from "./modules/imprimir.js";

import {
  agregarProducto,
  eliminarProducto,
  setEnvio,
  initEntregaUI,
  renderizarCarrito,
  calcularTotales,
  generarVistaPrevia,     // ✅ ahora existe
  copiarVistaPrevia,      // ✅ ahora existe
} from "./modules/carrito.js";

import {
  anadirACola,
  vaciarCola,
  renderCola,
  editarPedidoEnCola,
  cancelarEdicion,
  refreshEditUI,
} from "./modules/cola.js";

window.addEventListener("DOMContentLoaded", () => {
  // DB local
  initDB();

  // importar productos
  document.getElementById("importarProductosInput")
    ?.addEventListener("change", importarProductos);

  // búsqueda lista (por si entras directo)
  initBusqueda();
});

document.addEventListener("pantalla1:open", () => {
  initBusqueda();
  initEntregaUI();
  document.getElementById("busqueda")?.focus();
  renderizarCarrito();
  calcularTotales();
  refreshEditUI(); // ✅ cambia el botón + muestra cancelar si editando
});

document.addEventListener("cola:open", () => {
  renderCola();
});

/* ===== HTML hooks (onclick del index.html) ===== */
window.abrirPantalla = abrirPantalla;

window.agregarProducto = agregarProducto;
window.eliminarProducto = eliminarProducto;
window.setEnvio = setEnvio;

// ✅ Estos 2 arreglan tu error del index:
window.generarVistaPrevia = generarVistaPrevia;
window.copiarVistaPrevia = copiarVistaPrevia;

window.anadirACola = anadirACola;
window.vaciarCola = vaciarCola;

// Edición (aunque los botones se crean dentro de renderCola)
window.editarPedidoEnCola = editarPedidoEnCola;
window.cancelarEdicion = cancelarEdicion;

window.imprimirCola = imprimirCola;                 // ✅ FIX
window.imprimirColaPorTipo = imprimirColaPorTipo;   // ✅ FIX
