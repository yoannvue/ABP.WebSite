/**
 * storage.js - Wrapper pour localStorage
 */

const STORAGE_KEY = 'paniniGame';

export function getCollection() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {
      collection: [],
      lastDrawDate: null,
      checksum: null,
      version: "1.0"
    };
  } catch (e) {
    console.error('Erreur lecture localStorage', e);
    return { collection: [], lastDrawDate: null };
  }
}

export function saveCollection(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.error('localStorage plein');
      alert('Espace de stockage plein ! Veuillez libérer de l\'espace navigateur.');
    }
    return false;
  }
}

export function deleteCollection() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (e) {
    console.error('Erreur suppression', e);
    return false;
  }
}

export function exportCollection() {
  const data = getCollection();
  return JSON.stringify(data, null, 2);
}

export function importCollection(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.collection || !Array.isArray(data.collection)) {
      throw new Error('Format invalide');
    }
    saveCollection(data);
    return true;
  } catch (e) {
    console.error('Import invalide', e);
    return false;
  }
}
