// modules/log.js
export const logSB  = (...a) => console.log("🟣[LAZY/SUPABASE]", ...a);
export const warnSB = (...a) => console.warn("🟠[LAZY/SUPABASE]", ...a);
export const errSB  = (...a) => console.error("🔴[LAZY/SUPABASE]", ...a);

export const logUI  = (...a) => console.log("🟦[LAZY/UI]", ...a);
export const logDB  = (...a) => console.log("🟩[LAZY/DB]", ...a);
export const logPR  = (...a) => console.log("🖨️[LAZY/PRINT]", ...a);
