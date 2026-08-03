/**
 * utils.js - Fonctions utilitaires et helpers
 */

export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 12);
}

export function weightedRandomCard(cards) {
  // 1. Calculer le poids total
  const totalWeight = cards.reduce((sum, card) => sum + card.weight, 0);
  
  // 2. Générer un nombre aléatoire entre 0 et totalWeight
  const random = Math.random() * totalWeight;

  // 3. Accumuler les poids et vérifier la plage
  let cumulativeWeight = 0;
  
  for (const card of cards) {
    cumulativeWeight += card.weight;  // ✅ ADDITION = correct !
    
    // Si random est dans la plage [poids précédent, poids courant]
    if (random < cumulativeWeight) {
      return card;
    }
  }

  return cards[cards.length - 1];
}

export function validateCardId(cardId, validIds) {
  return validIds.has(cardId);
}

export function formatDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

export function getRarityLabel(weight) {
  if (weight == 1) return 'Commune ⭐';
  if (weight == 2) return 'Peu commune ⭐⭐';
  if (weight == 3) return 'Rare ⭐⭐⭐';
  if (weight == 4) return 'Très rare ⭐⭐⭐⭐';
  return 'Exceptionnelle 🌟';
}

export function encodeGiftValue(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function buildGiftUrl(cardId) {
  const url = new URL('https://abpecquencourt.fr/apps/paninicards/');
  url.searchParams.set('gift', encodeGiftValue(cardId));
  return url.toString();
}

export function decodeGiftValue(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
