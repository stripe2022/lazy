/* =========================================================
   NUEVO PROYECTO — app.js (COMPLETO)  ✅ ACTUALIZADO
   PARTE 1: IndexedDB + Importar productos + contador total
   PARTE 2: Búsqueda (filtrar select)
   PARTE 3: Carrito (añadir/eliminar/render/subtotales/total productos)
   PARTE 4: Entrega + Envío (entero) + Total final
   PARTE 5: Vista previa WhatsApp + Texto plano
   PARTE 6: Cola de pedidos + Imprimir
   PARTE 7: ✅ EDITAR pedido en cola (cargar → modificar → guardar cambios)
   PARTE 8: ✅ SUPABASE (NO LOGIN): crear receipt en server al imprimir, logs en consola
   ========================================================= */

/* =========================================================
   ✅ SUPABASE (NO LOGIN) — PRINTER KEY + RPC
   Requiere en el HTML (antes de app.js):
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ========================================================= */

const SUPABASE_URL = "PON_AQUI_TU_SUPABASE_URL";
const SUPABASE_ANON_KEY = "PON_AQUI_TU_SUPABASE_ANON_KEY";

// ✅ Opción B: fallback hardcode + autorestore a localStorage
const PRINTER_KEY_FALLBACK = "a9670d76f517cfbd329c01397234a1717c87cc22145ba3ea39da035f2219add4";

let PRINTER_KEY = localStorage.getItem("LAZY_PRINTER_KEY");
if (!PRINTER_KEY) {
  PRINTER_KEY = PRINTER_KEY_FALLBACK;
  try {
    localStorage.setItem("LAZY_PRINTER_KEY", PRINTER_KEY);
    console.log("🟢 PRINTER_KEY restaurada en localStorage (fallback).");
  } catch (e) {
    console.warn("🟠 No se pudo guardar PRINTER_KEY en localStorage:", e);
  }
} else {
  console.log("🟢 PRINTER_KEY cargada desde localStorage.");
}


// Cliente Supabase
const supabase = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY);

function logSB(...a){ console.log("🟣[LAZY/SUPABASE]", ...a); }
function warnSB(...a){ console.warn("🟠[LAZY/SUPABASE]", ...a); }
function errSB(...a){ console.error("🔴[LAZY/SUPABASE]", ...a); }

function supabaseReady() {
  const ok = !!(supabase && SUPABASE_URL && SUPABASE_ANON_KEY && PRINTER_KEY && PRINTER_KEY.length >= 16);
  if (!ok) {
    warnSB("Config incompleta:", {
      hasClient: !!supabase,
      hasUrl: !!SUPABASE_URL,
      hasAnon: !!SUPABASE_ANON_KEY,
      hasPrinterKey: !!PRINTER_KEY,
      printerKeyLen: (PRINTER_KEY || "").length
    });
  }
  return ok;
}
function isOnlineNow(){ return navigator.onLine === true; }

// Tus precios siempre enteros ✅. Igual guardamos numeric(12,2) en server.
function getUnitPrice(it) {
  const n = Number(it?.precioVenta ?? it?.precio ?? it?.price ?? it?.unit_price ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}
// ✅ Confirmado en tu JSON: costo = precioCosto
function getUnitCost(it) {
  const n = Number(it?.precioCosto ?? it?.costo ?? it?.unit_cost ?? it?.cost ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}
function mapEntregaToType(entrega) {
  return (String(entrega) === "domicilio") ? "delivery" : "pickup";
}

function buildSupabasePayloadFromPedido(p) {
  const type = mapEntregaToType(p?.entrega);
  const delivery_fee = (type === "delivery")
    ? Math.max(0, Math.trunc(Number(p?.envio) || 0))
    : 0;

  const itemsRaw = Array.isArray(p?.items) ? p.items : [];
  const items = itemsRaw.map(it => ({
    product_code: it?.codigo != null ? String(it.codigo) : null,
    name: String(it?.nombre || "").trim(),
    unit_price: getUnitPrice(it),
    unit_cost: getUnitCost(it),
    qty: Math.max(1, parseInt(it?.cantidad, 10) || 1),
  })).filter(x => x.name && x.qty > 0);

  return {
    type,
    info: String(p?.clienteInfo || "").trim(),
    delivery_fee,
    note: "",
    source_app: "lazy",
    items
  };
}

async function supabaseCreateReceipt(payload) {
  if (!supabaseReady()) throw new Error("Supabase no configurado.");
  if (!isOnlineNow()) throw new Error("Sin internet.");
  if (!payload?.items?.length) throw new Error("Payload sin items.");
  if (!payload.type) throw new Error("Payload sin type.");

  logSB("➡️ RPC public_create_receipt payload:", payload);

  const { data, error } = await supabase.rpc("public_create_receipt", {
    p_printer_key: PRINTER_KEY,
    p_payload: payload
  });

  if (error) {
    errSB("❌ public_create_receipt error:", error);
    throw new Error(error.message || "RPC error");
  }

  logSB("✅ Recibo creado:", data);
  return data; // {receipt_id, token, subtotal, total, ...}
}

/* =========================================================
   ================== ESTADO GLOBAL ==================
   ========================================================= */

let db = null;

let productos = [];          // todos los productos en DB
let productosEnSelect = [];  // lista EXACTA mostrada (ordenada) según búsqueda

let carrito = [];            // [{...producto, cantidad}]

// ===== EDICIÓN =====
let editingId = null;        // si no es null => estamos editando un pedido de la cola

/* =========================================================
   ================== DB ==================
   ========================================================= */

function initDB() {
  const request = indexedDB.open("barylieDB", 2);

  request.onerror = (event) => {
    console.error("❌ Error al abrir IndexedDB", event);
    alert("❌ No se pudo abrir la base de datos");
  };

  request.onupgradeneeded = (event) => {
    const _db = event.target.result;
    if (!_db.objectStoreNames.contains("productos")) {
      _db.createObjectStore("productos", { keyPath: "codigo" });
    }
  };

  request.onsuccess = (event) => {
    db = event.target.result;
    cargarProductosDesdeDB();
  };
}

/* =========================================================
   ================== CARGAR PRODUCTOS ==================
   ========================================================= */

function cargarProductosDesdeDB() {
  if (!db) return;

  const tx = db.transaction("productos", "readonly");
  const store = tx.objectStore("productos");
  const request = store.getAll();

  request.onsuccess = () => {
    productos = request.result || [];
    actualizarTotalProductosUI();
    poblarSelectConLista(productos); // si existe el select, se llena
  };

  request.onerror = (e) => {
    console.error("❌ Error leyendo productos", e);
  };
}

function actualizarTotalProductosUI() {
  const totalEl = document.getElementById("total-productos");
  if (totalEl) totalEl.textContent = String(productos.length);
}

/* =========================================================
   ================== SELECT (índices consistentes) ==================
   ========================================================= */

function poblarSelectConLista(lista) {
  const select = document.getElementById("producto");
  if (!select) return;

  productosEnSelect = (lista || [])
    .slice()
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  select.innerHTML = '<option value="">-- Selecciona un producto --</option>';

  productosEnSelect.forEach((p, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = p.nombre || "(sin nombre)";
    select.appendChild(opt);
  });
}

/* =========================================================
   ================== PARTE 2: BÚSQUEDA ==================
   ========================================================= */

function getProductosFiltrados(texto) {
  const q = (texto || "").trim().toLowerCase();
  if (!q) return productos.slice();

  return productos.filter(p =>
    String(p?.nombre || "").toLowerCase().includes(q)
  );
}

function initBusqueda() {
  const inputBusqueda = document.getElementById("busqueda");
  if (!inputBusqueda) return;

  poblarSelectConLista(productos);

  inputBusqueda.addEventListener("input", (e) => {
    const filtrados = getProductosFiltrados(e.target.value);
    poblarSelectConLista(filtrados);
  });
}

function limpiarBusquedaYSelect() {
  const busq = document.getElementById("busqueda");
  if (!busq) return;
  busq.value = "";
  poblarSelectConLista(productos);
  busq.focus();
}

/* =========================================================
   ================== PARTE 3: CARRITO ==================
   ========================================================= */

function agregarProducto() {
  const select = document.getElementById("producto");
  const cantidadInput = document.getElementById("cantidad");

  if (!select || !cantidadInput) {
    alert("Faltan elementos en el HTML (producto/cantidad).");
    return;
  }

  const idx = parseInt(select.value, 10);
  const cantidad = parseInt(cantidadInput.value, 10);

  if (Number.isNaN(idx) || idx < 0 || !productosEnSelect[idx]) {
    alert("Selecciona un producto válido");
    return;
  }

  if (Number.isNaN(cantidad) || cantidad < 1) {
    alert("Cantidad inválida");
    return;
  }

  const producto = productosEnSelect[idx];

  // comparar codigo robusto
  const existente = carrito.find(p => String(p.codigo) === String(producto.codigo));
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    carrito.push({ ...producto, cantidad });
  }

  renderizarCarrito();
  calcularTotales();

  // Reset inputs
  select.value = "";
  cantidadInput.value = "1";
  limpiarBusquedaYSelect();
}

function eliminarProducto(index) {
  carrito.splice(index, 1);
  renderizarCarrito();
  calcularTotales();
}

function renderizarCarrito() {
  const contenedor = document.getElementById("lista-productos");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  if (carrito.length === 0) {
    contenedor.innerHTML = "<p style='text-align:center;opacity:.7'>🛒 Carrito vacío</p>";
    return;
  }

  carrito.forEach((item, i) => {
    const precio = Number(item.precioVenta) || 0;
    const subtotal = precio * item.cantidad;

    const div = document.createElement("div");
    div.style.background = "#fff";
    div.style.padding = "0.8rem";
    div.style.borderRadius = "8px";
    div.style.margin = "0.5rem 0";
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.alignItems = "center";
    div.style.gap = "0.5rem";

    div.innerHTML = `
      <div style="flex:1;">
        <div style="font-weight:bold;">${item.nombre}</div>
        <div style="font-size:.9rem; opacity:.85;">
          x${item.cantidad} · $${precio} c/u · <strong>$${subtotal}</strong>
        </div>
      </div>
      <button onclick="eliminarProducto(${i})"
        style="background:#f44336;color:#fff;width:auto;padding:.6rem .8rem;border-radius:8px;">
        ✖️
      </button>
    `;

    contenedor.appendChild(div);
  });
}

/* =========================================================
   ================== PARTE 4: ENTREGA + ENVÍO + TOTALES ==================
   ========================================================= */

function getEntregaSeleccionada() {
  const sel = document.querySelector('input[name="entrega"]:checked');
  return sel ? sel.value : "tienda";
}

function normalizarEnvio(valor) {
  let n = parseInt(valor, 10);
  if (Number.isNaN(n) || n < 0) n = 0;
  return n;
}

function setEnvio(valor) {
  const envioInput = document.getElementById("envio");
  if (!envioInput) return;
  envioInput.value = String(normalizarEnvio(valor));
  calcularTotales();
}

function calcularTotalProductos() {
  return carrito.reduce((acc, item) => {
    const precio = Number(item.precioVenta) || 0;
    return acc + (precio * item.cantidad);
  }, 0);
}

function calcularTotales() {
  const totalProd = calcularTotalProductos();

  const totalProdEl = document.getElementById("total-productos-pedido");
  if (totalProdEl) totalProdEl.textContent = String(totalProd);

  const entrega = getEntregaSeleccionada();
  const envioInput = document.getElementById("envio");
  const envio = (entrega === "domicilio") ? normalizarEnvio(envioInput?.value) : 0;

  const totalFinal = totalProd + envio;

  const totalFinalEl = document.getElementById("total-final");
  if (totalFinalEl) totalFinalEl.textContent = String(totalFinal);
}

function initEntregaUI() {
  const radios = document.querySelectorAll('input[name="entrega"]');
  const bloqueEnvio = document.getElementById("bloque-envio");
  const envioInput = document.getElementById("envio");

  if (!radios.length || !bloqueEnvio) return;

  function refrescar() {
    const entrega = getEntregaSeleccionada();
    const esDomicilio = entrega === "domicilio";
    bloqueEnvio.style.display = esDomicilio ? "block" : "none";

    if (!esDomicilio && envioInput) {
      envioInput.value = "";
    }

    calcularTotales();
  }

  radios.forEach(r => r.addEventListener("change", refrescar));
  envioInput?.addEventListener("input", () => {
    if (!envioInput) return;
    envioInput.value = String(normalizarEnvio(envioInput.value));
    calcularTotales();
  });

  refrescar();
}

/* =========================================================
   ================== IMPORTAR PRODUCTOS ==================
   ========================================================= */

function importarProductos(event) {
  const file = event.target.files?.[0];
  if (!file || !db) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);

      if (!backup || !Array.isArray(backup.productos)) {
        throw new Error("El archivo no contiene { productos: [] }");
      }

      const tx = db.transaction("productos", "readwrite");
      const store = tx.objectStore("productos");

      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        backup.productos.forEach((prod) => {
          if (prod && prod.codigo != null && prod.nombre) {
            store.put(prod);
          }
        });
      };

      tx.oncomplete = () => {
        cargarProductosDesdeDB();
        alert("✅ Productos importados correctamente");
        event.target.value = "";
      };

      tx.onerror = (e) => {
        console.error("❌ Error importando productos", e);
        alert("❌ Error al importar productos (mira consola)");
        event.target.value = "";
      };

    } catch (e) {
      console.error("❌ Archivo inválido", e);
      alert("❌ Archivo inválido");
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}

/* =========================================================
   ================== HOOKS ==================
   ========================================================= */

window.addEventListener("DOMContentLoaded", () => {
  initDB();

  const inputImportar = document.getElementById("importarProductosInput");
  if (inputImportar) {
    inputImportar.addEventListener("change", importarProductos);
  }
});

document.addEventListener("pantalla1:open", () => {
  poblarSelectConLista(productos);
  initBusqueda();
  initEntregaUI();

  document.getElementById("busqueda")?.focus();

  renderizarCarrito();
  calcularTotales();

  // ✅ refresca texto del botón según modo
  setModoEdicionUI(!!editingId);
});

/* =========================================================
   ================== PARTE 5: VISTA PREVIA WHATSAPP + TEXTO PLANO ==================
   ========================================================= */

function money(n) {
  const x = Number(n) || 0;
  return `$${Math.round(x)}`;
}

function getClienteInfo() {
  const v = document.getElementById("clienteInfo")?.value || "";
  return v.trim();
}

function getEnvioActual() {
  const entrega = getEntregaSeleccionada();
  if (entrega !== "domicilio") return 0;
  return normalizarEnvio(document.getElementById("envio")?.value);
}

function getResumenPedido() {
  const entrega = getEntregaSeleccionada();
  const envio = getEnvioActual();
  const totalProd = calcularTotalProductos();
  const totalFinal = totalProd + envio;

  return { entrega, envio, totalProd, totalFinal };
}

function generarVistaPrevia() {
  const box = document.getElementById("previewBox");
  if (!box) return;

  if (carrito.length === 0) {
    box.innerHTML = `<div style="text-align:center; opacity:.7;">🛒 Carrito vacío</div>`;
    return;
  }

  const cliente = getClienteInfo();
  const { entrega, envio, totalProd, totalFinal } = getResumenPedido();

  const lineas = [];
  lineas.push(`🧾 *Barylie Pedido*`);
  if (cliente) lineas.push(`👤 ${cliente}`);

  lineas.push(``);
  lineas.push(`🛍️ *Productos*`);
  carrito.forEach((it) => {
    const precio = Number(it.precioVenta) || 0;
    const sub = precio * it.cantidad;
    lineas.push(`• ${it.nombre}  x${it.cantidad}  =  ${money(sub)}`);
  });

  lineas.push(``);
  lineas.push(`💰 *Total productos:* ${money(totalProd)}`);

  if (entrega === "domicilio") {
    lineas.push(`🛵 *Envío:* ${money(envio)}`);
    lineas.push(`✅ *TOTAL FINAL:* ${money(totalFinal)}`);
    lineas.push(`📍 Entrega: *Domicilio*`);
  } else {
    lineas.push(`📍 Entrega: *Recogida*`);
    lineas.push(`✅ *TOTAL FINAL:* ${money(totalFinal)}`);
  }

  box.textContent = lineas.join("\n");
}

function copiarVistaPrevia() {
  const box = document.getElementById("previewBox");
  if (!box) return;

  const txt = (box.textContent || "").trim();
  if (!txt || txt.includes("Aún no hay vista previa")) {
    alert("Primero genera la vista previa.");
    return;
  }

  navigator.clipboard.writeText(txt)
    .then(() => alert("✅ Copiado para WhatsApp"))
    .catch(() => alert("❌ No se pudo copiar"));
}

function generarTextoPlano() {
  const ta = document.getElementById("textoPlano");
  if (!ta) return;

  if (carrito.length === 0) {
    ta.value = "Carrito vacío";
    return;
  }

  const cliente = getClienteInfo();
  const { entrega, envio, totalProd, totalFinal } = getResumenPedido();

  const out = [];
  out.push("BARYLIE - PEDIDO");
  if (cliente) out.push(`CLIENTE: ${cliente}`);
  out.push("");

  out.push("PRODUCTOS:");
  carrito.forEach((it) => {
    const precio = Number(it.precioVenta) || 0;
    const sub = precio * it.cantidad;
    out.push(`- ${it.nombre} x${it.cantidad} = ${Math.round(sub)}`);
  });

  out.push("");
  out.push(`TOTAL PRODUCTOS: ${Math.round(totalProd)}`);

  if (entrega === "domicilio") {
    out.push(`ENVIO: ${Math.round(envio)}`);
    out.push(`ENTREGA: DOMICILIO`);
  } else {
    out.push(`ENTREGA: RECOGIDA`);
  }

  out.push(`TOTAL FINAL: ${Math.round(totalFinal)}`);

  ta.value = out.join("\n");
}

function copiarTextoPlano() {
  const ta = document.getElementById("textoPlano");
  if (!ta) return;

  const txt = (ta.value || "").trim();
  if (!txt) {
    alert("Primero genera el texto plano.");
    return;
  }

  navigator.clipboard.writeText(txt)
    .then(() => alert("✅ Texto plano copiado"))
    .catch(() => alert("❌ No se pudo copiar"));
}

/* =========================================================
   ================== PARTE 6: COLA DE PEDIDOS ==================
   ========================================================= */

const COLA_KEY = "barylie_cola_pedidos_v1";

function uuidLite() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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

function limpiarPedidoActual() {
  carrito = [];
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

  const ta = document.getElementById("textoPlano");
  if (ta) ta.value = "";

  if (typeof initEntregaUI === "function") initEntregaUI();

  setModoEdicionUI(!!editingId);
}

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

function buildPlainTextFromPedido(pedido) {
  const out = [];
  out.push("BARYLIE - PEDIDO");
  if (pedido.clienteInfo) out.push(`CLIENTE: ${pedido.clienteInfo}`);
  out.push("");
  out.push("PRODUCTOS:");
  (pedido.items || []).forEach(it => {
    const sub = (Number(it.precioVenta) || 0) * (Number(it.cantidad) || 0);
    out.push(`- ${it.nombre} x${it.cantidad} = ${Math.round(sub)}`);
  });
  out.push("");
  out.push(`TOTAL PRODUCTOS: ${Math.round(pedido.totalProductos || 0)}`);
  if (pedido.entrega === "domicilio") {
    out.push(`ENVIO: ${Math.round(pedido.envio || 0)}`);
    out.push(`ENTREGA: DOMICILIO`);
  } else {
    out.push(`ENTREGA: RECOGIDA`);
  }
  out.push(`TOTAL FINAL: ${Math.round(pedido.totalFinal || 0)}`);
  return out.join("\n");
}

/* =========================================================
   ================== PARTE 7: ✅ EDICIÓN EN COLA ==================
   ========================================================= */

function getBtnAccionCola() {
  return document.querySelector('#pedido button[onclick="anadirACola()"]');
}

function setModoEdicionUI(estado) {
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

function cancelarEdicion() {
  editingId = null;
  setModoEdicionUI(false);
  limpiarPedidoActual();
}

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
  carrito = items.map(it => ({
    codigo: it.codigo,
    nombre: it.nombre,
    precioVenta: Number(it.precioVenta) || 0,
    // ✅ costo desde JSON: precioCosto
    precioCosto: Number(it.precioCosto ?? it.costo ?? 0) || 0,
    cantidad: Number(it.cantidad) || 0
  })).filter(x => x.nombre && x.cantidad > 0);

  renderizarCarrito();
  initEntregaUI();
  calcularTotales();
  generarVistaPrevia();
}

function editarPedidoEnCola(id) {
  const cola = leerCola();
  const pedido = cola.find(p => p.id === id);
  if (!pedido) {
    alert("❌ No encontré ese pedido en la cola");
    return;
  }

  editingId = id;
  setModoEdicionUI(true);

  if (typeof window.abrirPantalla === "function") {
    window.abrirPantalla("pedido");
  } else {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('pedido')?.classList.add('active');
    document.dispatchEvent(new Event('pantalla1:open'));
  }

  cargarPedidoEnFormulario(pedido);
}

function guardarCambiosEnCola() {
  if (!editingId) return;

  if (!carrito || carrito.length === 0) {
    alert("Agrega al menos un producto.");
    return;
  }

  const clienteInfo = (document.getElementById("clienteInfo")?.value || "").trim();
  const entrega = getEntregaSeleccionada();
  const envio = (entrega === "domicilio") ? normalizarEnvio(document.getElementById("envio")?.value) : 0;

  const totalProductos = calcularTotalProductos();
  const totalFinal = totalProductos + envio;

  const cola = leerCola();
  const idx = cola.findIndex(p => p.id === editingId);

  if (idx === -1) {
    alert("❌ No encontré ese pedido para actualizar");
    editingId = null;
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
    items: carrito.map(it => ({
      codigo: it.codigo,
      nombre: it.nombre,
      precioVenta: Number(it.precioVenta) || 0,
      // ✅ costo
      precioCosto: Number(it.precioCosto ?? 0) || 0,
      cantidad: Number(it.cantidad) || 0,
    })),
  };

  guardarCola(cola);

  alert("✅ Cambios guardados");
  editingId = null;
  setModoEdicionUI(false);
  limpiarPedidoActual();

  if (typeof window.abrirPantalla === "function") {
    window.abrirPantalla("cola");
  }
  renderCola();
}

/* =========================================================
   ================== AÑADIR A COLA (CREAR o GUARDAR CAMBIOS) ==================
   ========================================================= */

function anadirACola() {
  if (editingId) {
    guardarCambiosEnCola();
    return;
  }

  if (!carrito || carrito.length === 0) {
    alert("Agrega al menos un producto.");
    return;
  }

  const clienteInfo = (document.getElementById("clienteInfo")?.value || "").trim();
  const entrega = getEntregaSeleccionada();
  const envio = (entrega === "domicilio") ? normalizarEnvio(document.getElementById("envio")?.value) : 0;

  const totalProductos = calcularTotalProductos();
  const totalFinal = totalProductos + envio;

  const pedido = {
    id: uuidLite(),
    ts: Date.now(),
    clienteInfo,
    entrega,
    envio,
    totalProductos,
    totalFinal,
    items: carrito.map(it => ({
      codigo: it.codigo,
      nombre: it.nombre,
      precioVenta: Number(it.precioVenta) || 0,
      // ✅ costo: si el producto tiene precioCosto, lo guardamos aquí desde ya
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

function eliminarDeCola(id) {
  const cola = leerCola().filter(p => p.id !== id);
  guardarCola(cola);
  renderCola();
}

function vaciarCola() {
  if (!confirm("¿Vaciar toda la cola?")) return;
  guardarCola([]);
  renderCola();
}

function copiarTexto(txt, okMsg) {
  navigator.clipboard.writeText(txt)
    .then(() => alert(okMsg || "✅ Copiado"))
    .catch(() => alert("❌ No se pudo copiar"));
}

/* =========================================================
   ================== RENDER COLA (con Editar) ==================
   ========================================================= */

function renderCola() {
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

document.addEventListener("cola:open", () => {
  renderCola();
});

/* =========================================================
   ================== IMPRIMIR COLA (TODOS LOS PEDIDOS) ==================
   ========================================================= */

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function imprimirCola() {
  const cola = leerCola();
  if (!cola || cola.length === 0) {
    alert("📭 La cola está vacía");
    return;
  }
  imprimirListaPedidos(cola).catch(e => console.error("🔴[PRINT]", e));
}

function imprimirColaPorTipo(tipo) {
  const cola = leerCola();
  if (!cola || cola.length === 0) {
    alert("📭 La cola está vacía");
    return;
  }

  const filtrada = cola.filter(p => String(p.entrega) === String(tipo));

  if (filtrada.length === 0) {
    alert(tipo === "domicilio"
      ? "📭 No hay pedidos de DOMICILIO en la cola"
      : "📭 No hay pedidos de RECOGIDA en la cola"
    );
    return;
  }

  imprimirListaPedidos(filtrada).catch(e => console.error("🔴[PRINT]", e));
}

/* =========================================================
   ===== Motor común de impresión (ONLINE-FIRST + fallback) =====
   - Intenta crear receipt en Supabase para cada pedido.
   - Si ok => imprime texto QR LB|id|token
   - Si falla => imprime SIN QR y log de error en consola.
   ========================================================= */

async function imprimirListaPedidos(lista) {
  const orden = (lista || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
  logSB("🖨️ imprimirListaPedidos() pedidos:", orden.length, "online:", isOnlineNow());

  let html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Imprimir</title>
<style>
  @page { margin: 6mm; }
  body{
    font-family: system-ui, Arial, sans-serif;
    margin: 0;
    color: #111;
    font-size: 11px;
    line-height: 1.15;
  }
  .pedido{
    break-inside: avoid;
    border: 1px solid #bbb;
    border-radius: 6px;
    padding: 6px;
    margin: 0 0 6px 0;
  }
  .row{ display:flex; justify-content:space-between; gap:6px; }
  .cliente{ font-weight:700; margin:2px 0 4px 0; }
  ul{ margin:2px 0 4px 10px; padding:0; }
  li{ margin:1px 0; }
  .totales{ margin-top:4px; border-top:1px dashed #aaa; padding-top:4px; }
  .totales .row{ margin:1px 0; }
  .tag{ font-weight:700; }

  .qrbox{
    margin-top:6px;
    border-top:1px dashed #aaa;
    padding-top:6px;
    font-size:10px;
  }
  .mono{
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    word-break: break-all;
  }
  .warn{ color:#b00020; font-weight:800; }
</style>
</head>
<body>
`;

  // ✅ for...of para poder await
  for (const p of orden) {
    const cliente = p.clienteInfo || "—";
    const entregaTxt = p.entrega === "domicilio" ? "Domicilio" : "Recogida";

    const items = Array.isArray(p.items) ? p.items : [];
    const totalProd = Math.round(Number(p.totalProductos) || 0);
    const envio = Math.round(Number(p.envio) || 0);
    const totalFinal = Math.round(
      Number(p.totalFinal) || (totalProd + (p.entrega === "domicilio" ? envio : 0))
    );

    let qrText = null;
    let supabaseError = null;

    try {
      const payload = buildSupabasePayloadFromPedido(p);

      logSB("🧾 Pedido -> payload resumen:", {
        entrega: p.entrega,
        type: payload.type,
        items: payload.items.length,
        delivery_fee: payload.delivery_fee,
        infoLen: (payload.info || "").length
      });

      const created = await supabaseCreateReceipt(payload);

      const receipt_id = created?.receipt_id || null;
      const token = created?.token || null;

      if (receipt_id && token) {
        qrText = `LB|${receipt_id}|${token}`;
        logSB("📌 QR listo:", qrText);
      } else {
        supabaseError = "Respuesta RPC sin receipt_id/token";
        warnSB("⚠️", supabaseError, created);
      }

    } catch (e) {
      supabaseError = e?.message || String(e);
      errSB("❌ Supabase fallo en este pedido:", { cliente, entrega: p.entrega, error: supabaseError });
    }

    html += `
    <div class="pedido">
      <div class="row">
        <div class="cliente">👤 ${escapeHtml(cliente)}</div>
        <div><span class="tag">Entrega:</span> ${escapeHtml(entregaTxt)}</div>
      </div>

      <div><span class="tag">Productos:</span></div>
      <ul>
        ${items.map(it => {
          const nombre = it?.nombre || "";
          const cant = Number(it?.cantidad) || 0;
          const precio = Number(it?.precioVenta) || 0;
          const sub = Math.round(precio * cant);
          return `<li>${escapeHtml(nombre)} x${cant} — ${sub}</li>`;
        }).join("")}
      </ul>

      <div class="totales">
        <div class="row"><div><span class="tag">Total productos:</span></div><div>$${totalProd}</div></div>
        ${p.entrega === "domicilio"
          ? `<div class="row"><div><span class="tag">Envío:</span></div><div>$${envio}</div></div>`
          : ``}
        <div class="row" style="font-weight:800;"><div><span class="tag">Total final:</span></div><div>$${totalFinal}</div></div>
      </div>

      <div class="qrbox">
        ${qrText
          ? `<div><span class="tag">QR:</span> <span class="mono">${escapeHtml(qrText)}</span></div>`
          : `<div class="warn">SIN QR (offline o error)</div>
             <div class="mono" style="opacity:.75;">${escapeHtml(supabaseError || "desconocido")}</div>`
        }
      </div>
    </div>
`;
  }

  html += `
</body>
</html>
`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("❌ No se pudo abrir la ventana de impresión.");
    return;
  }

  w.document.open();
  w.document.write(html);
  w.document.close();

  w.onload = () => {
    w.focus();
    w.print();
  };
}
