// app.js (ENTRY - módulo)
import { CONFIG } from "./modules/config.js";

import { initDB, importarProductos } from "./modules/dbIndexedDB.js";
import { abrirPantalla, initBusqueda } from "./modules/ui.js";

import {
  agregarProducto,
  eliminarProducto,
  setEnvio,
  initEntregaUI,
  renderizarCarrito,
  calcularTotales,
  generarVistaPrevia,
  copiarVistaPrevia,
} from "./modules/carrito.js";

import {
  anadirACola,
  vaciarCola,
  renderCola,
  editarPedidoEnCola,
  cancelarEdicion,
  refreshEditUI,
} from "./modules/cola.js";

import {
  imprimirCola,
  imprimirColaPorTipo,
} from "./modules/imprimir.js";

/* =====================================================
   CONTEXTO GLOBAL (ÚNICA FUENTE DE VERDAD)
   ===================================================== */
const ctx = {
  supabase: null,
};

/* =====================================================
   INIT
   ===================================================== */
window.addEventListener("DOMContentLoaded", () => {
  /* ===============================
     DB local
  =============================== */
  initDB();

  document
    .getElementById("importarProductosInput")
    ?.addEventListener("change", importarProductos);

  /* ===============================
     SUPABASE (TEST DE CONEXIÓN REAL)
  =============================== */
  if (!window.supabase) {
    console.error("🔴 Supabase SDK no cargado (CDN)");
    console.warn(
      "👉 Asegúrate de tener esto en index.html ANTES de app.js:\n" +
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
    );
  } else {
    ctx.supabase = window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY
    );

    console.log("🟢 Supabase client creado correctamente");
    console.log("🔗 Supabase URL:", CONFIG.SUPABASE_URL);
  }

  /* ===============================
     UI inicial
  =============================== */
  initBusqueda();
});

/* =====================================================
   EVENTOS DE NAVEGACIÓN
   ===================================================== */
document.addEventListener("pantalla1:open", () => {
  initBusqueda();
  initEntregaUI();
  document.getElementById("busqueda")?.focus();
  renderizarCarrito();
  calcularTotales();
  refreshEditUI();
});

document.addEventListener("cola:open", () => {
  renderCola();
});

/* =====================================================
   EXPONER FUNCIONES AL HTML (onclick)
   ===================================================== */
window.abrirPantalla = abrirPantalla;

// carrito
window.agregarProducto = agregarProducto;
window.eliminarProducto = eliminarProducto;
window.setEnvio = setEnvio;
window.generarVistaPrevia = generarVistaPrevia;
window.copiarVistaPrevia = copiarVistaPrevia;

// cola
window.anadirACola = anadirACola;
window.vaciarCola = vaciarCola;
window.editarPedidoEnCola = editarPedidoEnCola;
window.cancelarEdicion = cancelarEdicion;

// impresión (🔥 aquí estaba el error antes)
window.imprimirCola = () => {
  if (!ctx.supabase) {
    console.warn("⚠️ Imprimiendo SIN Supabase (offline)");
  }
  return imprimirCola(ctx).catch((e) =>
    console.error("🔴[PRINT]", e)
  );
};

window.imprimirColaPorTipo = (tipo) => {
  if (!ctx.supabase) {
    console.warn("⚠️ Imprimiendo SIN Supabase (offline)");
  }
  return imprimirColaPorTipo(ctx, tipo).catch((e) =>
    console.error("🔴[PRINT]", e)
  );
};
