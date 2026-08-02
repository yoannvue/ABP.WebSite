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
  const totalWeight = cards.reduce((sum, card) => sum + card.weight, 0);
  let random = Math.random() * totalWeight;

  for (const card of cards) {
    random -= card.weight;
    if (random <= 0) return card;
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
