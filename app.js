// app.js (ENTRY)
import { CONFIG } from "./modules/config.js";
import { logUI, warnSB } from "./modules/log.js";

import { initDB, importarProductos } from "./modules/dbIndexedDB.js";
import { abrirPantalla, initBusqueda } from "./modules/ui.js";

import {
  agregarProducto, eliminarProducto,
  setEnvio, calcularTotales, initEntregaUI, renderizarCarrito
} from "./modules/carrito.js";

import { anadirACola, vaciarCola, renderCola } from "./modules/cola.js";

import { createSupabaseClient } from "./modules/supabaseClient.js";
import { imprimirCola, imprimirColaPorTipo } from "./modules/imprimir.js";

// Contexto supabase que le pasamos a imprimir
const ctx = {
  supabase: null,
  SUPABASE_URL: CONFIG.SUPABASE_URL,
  SUPABASE_ANON_KEY: CONFIG.SUPABASE_ANON_KEY
};

window.addEventListener("DOMContentLoaded", async () => {
  // DB local
  initDB();

  // importar productos
  const inputImportar = document.getElementById("importarProductosInput");
  if (inputImportar) inputImportar.addEventListener("change", importarProductos);

  // Supabase client
  try {
    ctx.supabase = await createSupabaseClient();
    logUI("Supabase client OK");
  } catch (e) {
    warnSB("No pude iniciar Supabase client:", e?.message || e);
  }

  // Por si entras directo a pedido
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

window.anadirACola = anadirACola;
window.vaciarCola = vaciarCola;

window.imprimirCola = () => imprimirCola(ctx).catch(e => console.error("🔴[PRINT]", e));
window.imprimirColaPorTipo = (tipo) => imprimirColaPorTipo(ctx, tipo).catch(e => console.error("🔴[PRINT]", e));
