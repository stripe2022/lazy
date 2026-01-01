// modules/dbIndexedDB.js
import { state, setDB } from "./state.js";
import { logDB } from "./log.js";
import { actualizarTotalProductosUI, poblarSelectConLista } from "./ui.js";

export function initDB() {
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
    const db = event.target.result;
    setDB(db);
    cargarProductosDesdeDB();
  };
}

export function cargarProductosDesdeDB() {
  if (!state.db) return;

  const tx = state.db.transaction("productos", "readonly");
  const store = tx.objectStore("productos");
  const request = store.getAll();

  request.onsuccess = () => {
    state.productos = request.result || [];
    logDB("Productos cargados:", state.productos.length);
    actualizarTotalProductosUI();
    poblarSelectConLista(state.productos);
  };

  request.onerror = (e) => {
    console.error("❌ Error leyendo productos", e);
  };
}

export function importarProductos(event) {
  const file = event.target.files?.[0];
  if (!file || !state.db) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      if (!backup || !Array.isArray(backup.productos)) {
        throw new Error("El archivo no contiene { productos: [] }");
      }

      const tx = state.db.transaction("productos", "readwrite");
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
