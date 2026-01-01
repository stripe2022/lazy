// modules/carrito.js
import { state } from "./state.js";
import { limpiarBusquedaYSelect } from "./ui.js";

export function agregarProducto() {
  const select = document.getElementById("producto");
  const cantidadInput = document.getElementById("cantidad");

  if (!select || !cantidadInput) {
    alert("Faltan elementos en el HTML (producto/cantidad).");
    return;
  }

  const idx = parseInt(select.value, 10);
  const cantidad = parseInt(cantidadInput.value, 10);

  if (Number.isNaN(idx) || idx < 0 || !state.productosEnSelect[idx]) {
    alert("Selecciona un producto válido");
    return;
  }

  if (Number.isNaN(cantidad) || cantidad < 1) {
    alert("Cantidad inválida");
    return;
  }

  const producto = state.productosEnSelect[idx];

  const existente = state.carrito.find(p => String(p.codigo) === String(producto.codigo));
  if (existente) existente.cantidad += cantidad;
  else state.carrito.push({ ...producto, cantidad });

  renderizarCarrito();
  calcularTotales();

  select.value = "";
  cantidadInput.value = "1";
  limpiarBusquedaYSelect();
}

export function eliminarProducto(index) {
  state.carrito.splice(index, 1);
  renderizarCarrito();
  calcularTotales();
}

export function renderizarCarrito() {
  const contenedor = document.getElementById("lista-productos");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  if (state.carrito.length === 0) {
    contenedor.innerHTML = "<p style='text-align:center;opacity:.7'>🛒 Carrito vacío</p>";
    return;
  }

  state.carrito.forEach((item, i) => {
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

// Entrega/envío
export function getEntregaSeleccionada() {
  const sel = document.querySelector('input[name="entrega"]:checked');
  return sel ? sel.value : "tienda";
}

export function normalizarEnvio(valor) {
  let n = parseInt(valor, 10);
  if (Number.isNaN(n) || n < 0) n = 0;
  return n;
}

export function setEnvio(valor) {
  const envioInput = document.getElementById("envio");
  if (!envioInput) return;
  envioInput.value = String(normalizarEnvio(valor));
  calcularTotales();
}

export function calcularTotalProductos() {
  return state.carrito.reduce((acc, item) => {
    const precio = Number(item.precioVenta) || 0;
    return acc + (precio * item.cantidad);
  }, 0);
}

export function calcularTotales() {
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

export function initEntregaUI() {
  const radios = document.querySelectorAll('input[name="entrega"]');
  const bloqueEnvio = document.getElementById("bloque-envio");
  const envioInput = document.getElementById("envio");

  if (!radios.length || !bloqueEnvio) return;

  function refrescar() {
    const entrega = getEntregaSeleccionada();
    const esDomicilio = entrega === "domicilio";
    bloqueEnvio.style.display = esDomicilio ? "block" : "none";
    if (!esDomicilio && envioInput) envioInput.value = "";
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
