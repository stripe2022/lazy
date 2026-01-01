// modules/state.js
export const state = {
  db: null,

  productos: [],
  productosEnSelect: [],
  carrito: [],

  editingId: null,
};

export function setDB(db){ state.db = db; }
