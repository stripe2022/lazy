/* =========================================================
   NUEVO PROYECTO — app.js (COMPLETO)
   PARTE 1: IndexedDB + Importar productos + contador total
   PARTE 2: Búsqueda (filtrar select)
   PARTE 3: Carrito (añadir/eliminar/render/subtotales/total productos)
   PARTE 4: Entrega + Envío (entero) + Total final
   ========================================================= */

// ================== ESTADO GLOBAL ==================
let db = null;

let productos = [];          // todos los productos en DB
let productosEnSelect = [];  // lista EXACTA mostrada (ordenada) según búsqueda

let carrito = [];            // [{...producto, cantidad}]

// ================== DB ==================
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

// ================== CARGAR PRODUCTOS ==================
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

// ================== SELECT (índices consistentes) ==================
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

// ================== PARTE 2: BÚSQUEDA ==================
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

// ================== PARTE 3: CARRITO ==================
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

// ================== PARTE 4: ENTREGA + ENVÍO + TOTALES ==================
function getEntregaSeleccionada() {
  const sel = document.querySelector('input[name="entrega"]:checked');
  return sel ? sel.value : "tienda";
}

function normalizarEnvio(valor) {
  // entero >= 0
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
      envioInput.value = ""; // limpia cuando no es domicilio
    }

    calcularTotales();
  }

  radios.forEach(r => r.addEventListener("change", refrescar));
  envioInput?.addEventListener("input", () => {
    // forzar entero en tiempo real (sin molestar)
    if (!envioInput) return;
    envioInput.value = String(normalizarEnvio(envioInput.value));
    calcularTotales();
  });

  refrescar(); // inicial
}

// ================== IMPORTAR PRODUCTOS ==================
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

// ================== HOOKS ==================
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
});
