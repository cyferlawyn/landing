const SAVE_KEY              = 'apex_save';
const PREFS_KEY             = 'apex_prefs';
const PRESTIGE_KEY          = 'apex_prestige';
const TRAITOR_KEY           = 'apex_traitors';
const FACTION_KEY           = 'apex_faction';
const FACTION_CAPSTONES_KEY = 'apex_faction_capstones';

export function save(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Load failed:', e);
    return null;
  }
}

export function clear() {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Prefs save failed:', e);
  }
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function savePrestige(state) {
  try {
    localStorage.setItem(PRESTIGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Prestige save failed:', e);
  }
}

export function loadPrestige() {
  try {
    const raw = localStorage.getItem(PRESTIGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearPrestige() {
  localStorage.removeItem(PRESTIGE_KEY);
}

export function saveTraitors(state) {
  try {
    localStorage.setItem(TRAITOR_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Traitor save failed:', e);
  }
}

export function loadTraitors() {
  try {
    const raw = localStorage.getItem(TRAITOR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearTraitors() {
  localStorage.removeItem(TRAITOR_KEY);
}

export function saveFaction(state) {
  try {
    localStorage.setItem(FACTION_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Faction save failed:', e);
  }
}

export function loadFaction() {
  try {
    const raw = localStorage.getItem(FACTION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearFaction() {
  localStorage.removeItem(FACTION_KEY);
}

export function saveFactionCapstones(state) {
  try {
    localStorage.setItem(FACTION_CAPSTONES_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Faction capstone save failed:', e);
  }
}

export function loadFactionCapstones() {
  try {
    const raw = localStorage.getItem(FACTION_CAPSTONES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearFactionCapstones() {
  localStorage.removeItem(FACTION_CAPSTONES_KEY);
}
