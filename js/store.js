// =========================================================
// SPEICHER
//
// Zwei Betriebsarten:
//   "cloud" – Supabase ist eingerichtet und ihr seid eingeloggt:
//             Daten liegen in der Datenbank, Änderungen kommen live an.
//   "local" – Supabase ist (noch) nicht eingerichtet:
//             Daten liegen nur im Browser dieses Geräts (localStorage).
//   "login" – Supabase ist eingerichtet, aber niemand ist eingeloggt.
//
// Die anderen Module benutzen nur store.load / store.save / store.has
// und merken vom Unterschied nichts.
// =========================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const PREFIX = "thai27:";
const TABLE = "app_state";
// Diese Listen werden synchronisiert
export const KEYS = ["blocks", "activities", "nights", "todos", "expenses", "places"];

let supabase = null;
let user = null;
const cache = new Map();          // key → value (im Cloud-Modus)
const meta = new Map();           // key → { updated_at, updated_by } – wer hat zuletzt geändert?
const listeners = new Set();      // werden bei Änderungen von anderen Geräten aufgerufen
const errorListeners = new Set();

// ---------- lokaler Speicher ----------
const local = {
  get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch {
      return undefined;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* z. B. privater Modus */
    }
  },
};

export const store = {
  mode: "local",

  get userEmail() {
    return user?.email || "";
  },

  // Wird einmal beim Start der Seite aufgerufen (siehe app.js)
  async init() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      this.mode = "local";
      return this.mode;
    }

    // Supabase-Bibliothek erst laden, wenn sie gebraucht wird
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Kommt man über den Login-Link aus der E-Mail, liest Supabase das Token
    // aus der Adresse. Danach räumen wir die Adresse auf (sonst stört es die Navigation).
    const { data } = await supabase.auth.getSession();
    if (location.hash.includes("access_token") || location.hash.includes("error_description")) {
      history.replaceState(null, "", location.pathname + location.search);
    }

    user = data.session?.user || null;
    if (!user) {
      this.mode = "login";
      return this.mode;
    }

    // Alle Listen auf einmal laden
    const { data: rows, error } = await supabase.from(TABLE).select("key, value, updated_at, updated_by");
    if (error) {
      // Eingeloggt, aber nicht auf der Liste – oder Tabelle fehlt
      console.error(error);
      this.mode = "login";
      this.loginError = "Kein Zugriff auf die Daten. Steht deine E-Mail-Adresse in der Tabelle allowed_emails?";
      return this.mode;
    }
    rows.forEach((r) => {
      cache.set(r.key, r.value);
      meta.set(r.key, { updated_at: r.updated_at, updated_by: r.updated_by });
    });
    this.mode = "cloud";

    // Einmalig: Was bisher nur lokal gespeichert war, in die Datenbank übernehmen
    for (const key of KEYS) {
      const localValue = local.get(key);
      if (!cache.has(key) && localValue !== undefined) this.save(key, localValue);
    }

    // Live-Updates von anderen Geräten
    supabase
      .channel("app_state_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        const row = payload.new;
        if (!row?.key) return;
        meta.set(row.key, { updated_at: row.updated_at, updated_by: row.updated_by });
        // Eigene Änderungen kommen auch zurück – die ignorieren wir
        if (JSON.stringify(cache.get(row.key)) === JSON.stringify(row.value)) return;
        cache.set(row.key, row.value);
        listeners.forEach((fn) => fn(row.key));
      })
      .subscribe();

    return this.mode;
  },

  has(key) {
    return this.mode === "cloud" ? cache.has(key) : local.get(key) !== undefined;
  },

  load(key, fallback) {
    const value = this.mode === "cloud" ? cache.get(key) : local.get(key);
    // Kopie zurückgeben, damit Änderungen erst beim Speichern wirksam werden
    return value === undefined ? fallback : structuredClone(value);
  },

  save(key, value) {
    if (this.mode !== "cloud") {
      local.set(key, value);
      return;
    }
    cache.set(key, structuredClone(value));
    local.set(key, value); // zusätzlich lokale Kopie als Notfall-Backup
    const stamp = { updated_at: new Date().toISOString(), updated_by: user.email };
    meta.set(key, stamp);
    supabase
      .from(TABLE)
      .upsert({ key, value, ...stamp })
      .then(({ error }) => {
        if (error) {
          console.error(error);
          errorListeners.forEach((fn) => fn("Speichern fehlgeschlagen. Bist du online?"));
        }
      });
  },

  // Wer hat diese Liste zuletzt gespeichert und wann? (nur im Cloud-Modus)
  meta(key) {
    return meta.get(key) || null;
  },

  // Andere Module können sich benachrichtigen lassen
  onRemoteChange(fn) {
    listeners.add(fn);
  },
  onError(fn) {
    errorListeners.add(fn);
  },

  // ---------- Login ----------
  // Login mit E-Mail + Passwort (es werden keine Mails verschickt)
  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  },

  async changePassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    return error;
  },

  async signOut() {
    await supabase?.auth.signOut();
    location.hash = "";
    location.reload();
  },
};

export const newId = () =>
  crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
