// =========================================================
// KONFIGURATION – hier stehen alle Daten, die du anpassen willst
// =========================================================

export const PEOPLE = ["Lisa", "Michel"];

export const TRIP = {
  subtitle: "Lisa & Michel · Februar 2027",
  // Abflug mit Zeitzone (+01:00 = deutsche Winterzeit)
  departure: "2027-02-26T14:30:00+01:00",
  destinationLabel: "Bangkok",
  // Reisezeitraum. Die Timeline zeigt mindestens diese Tage
  // (und wird automatisch länger, wenn eine Etappe darüber hinausgeht).
  start: "2027-02-26",
  end: "2027-03-16",
};

// Farben für Etappen und Abschnitte
export const COLORS = [
  { name: "Türkis", value: "#0f766e" },
  { name: "Koralle", value: "#e11d48" },
  { name: "Mango", value: "#d97706" },
  { name: "Blau", value: "#2563eb" },
  { name: "Lila", value: "#7c3aed" },
  { name: "Grün", value: "#15803d" },
  { name: "Grau", value: "#64748b" },
];

// Start-Etappen, solange noch nichts gespeichert ist.
// Auf der Seite "Reiseroute" kannst du sie frei ändern.
export const DEFAULT_BLOCKS = [
  { name: "Anreise", from: "2027-02-26", to: "2027-02-27", color: "#64748b" },
  { name: "Bangkok", from: "2027-02-28", to: "2027-03-02", color: "#e11d48" },
  { name: "Rundreise Süden", from: "2027-03-03", to: "2027-03-12", color: "#0f766e" },
  { name: "Singapur", from: "2027-03-13", to: "2027-03-15", color: "#d97706" },
  { name: "Rückflug", from: "2027-03-16", to: "2027-03-16", color: "#64748b" },
];

export const DEFAULT_TODOS = [
  { text: "Reisepass prüfen", description: "Muss bei Einreise noch mind. 6 Monate gültig sein.", who: "beide" },
  { text: "Flüge buchen", description: "", who: "beide" },
  { text: "Auslandskrankenversicherung abschließen", description: "", who: "beide" },
  { text: "Unterkunft in Bangkok buchen", description: "", who: "beide" },
];

export const EXPENSE_CATEGORIES = ["Flug", "Unterkunft", "Transport", "Aktivität", "Essen", "Versicherung", "Sonstiges"];

// Startansicht der Karte (Süd-Thailand)
export const MAP_VIEW = { lat: 8.4, lon: 99.2, zoom: 7 };
