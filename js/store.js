// =========================================================
// SPEICHER
// Aktuell im Browser (localStorage) – also nur auf DIESEM Gerät.
// In Phase 4 wird dieses Modul durch Supabase ersetzt; die anderen
// Module rufen nur store.load / store.save auf und merken davon nichts.
// =========================================================
const PREFIX = "thai27:";

export const store = {
  has(key) {
    try {
      return localStorage.getItem(PREFIX + key) !== null;
    } catch {
      return false;
    }
  },
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* z. B. privater Modus – dann eben nicht speichern */
    }
  },
};

export const newId = () =>
  crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
