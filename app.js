// app.js (ENTRY)
import { CONFIG } from "./modules/config.js";
import { logUI, warnSB } from "./modules/log.js";

import { initDB, importarProductos } from "./modules/dbIndexedDB.js";
import { abrirPantalla, initBusqueda } from "./modules/ui.js";

import {
  agregarProducto,
  eliminarProducto,
  setEnvio,
  calcularTotales,
  initEntregaUI,
  renderizarCarrito
} from "./modules/carrito.js";

import { anadirACola, vaciarCola, renderCola } from "./modules/cola.js";

import { createSupabaseClient } from "./modules/supabaseClient.js";
import { imprimirCola, imprimirColaPorTipo } from "./modules/imprimir.js";

// ✅ (si ya creaste preview.js como te pasé)
import { generarVistaPrevia, copiarVistaPrevia } from "./modules/preview.js";

// Contexto supabase que le pasamos a imprimir
const ctx = {
  supabase: null,
  SUPABASE_URL: CONFIG.SUPABASE_URL,
  SUPABASE_ANON_KEY: CONFIG.SUPABASE_ANON_KEY,
  // opcional si lo necesitas en imprimir/supabase:
  PRINTER_KEY: CONFIG.PRINTER_KEY || null
};

window.addEventListener("DOMContentLoaded", async () => {
  // 1) DB local (productos)
  initDB();

  // 2) importar productos
  const inputImportar = document.getElementById("importarProductosInput");
  if (inputImportar) inputImportar.addEventListener("change", importarProductos);

  // 3) Supabase client
  try {
    ctx.supabase = await createSupabaseClient();
    logUI("✅ Supabase client OK");
  } catch (e) {
    warnSB("⚠️ No pude iniciar Supabase client:", e?.message || e);
  }

  // 4) Prepara listeners UI (aunque el listado real se refresca en pantalla1:open)
  initBusqueda();
});

document.addEventListener("pantalla1:open", () => {
  initBusqueda();
  initEntregaUI();
  document.getElementById("busqueda")?.focus();
  renderizarCarrito();
  calcularTotales();
});

document.addEventListener("cola:open", () => {
  renderCola();
});

// ✅ Exponer funciones para onclick del HTML
window.abrirPantalla = abrirPantalla;

window.agregarProducto = agregarProducto;
window.eliminarProducto = eliminarProducto;
window.setEnvio = setEnvio;

window.generarVistaPrevia = generarVistaPrevia;
window.copiarVistaPrevia = copiarVistaPrevia;

window.anadirACola = anadirACola;
window.vaciarCola = vaciarCola;

window.imprimirCola = () =>
  imprimirCola(ctx).catch(e => console.error("🔴[PRINT]", e));

window.imprimirColaPorTipo = (tipo) =>
  imprimirColaPorTipo(ctx, tipo).catch(e => console.error("🔴[PRINT]", e));
