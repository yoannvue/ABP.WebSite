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

export function getDailySeed(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0];
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) / 2147483647;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function weightedRandomCard(cards, seed) {
  // const totalWeight = cards.reduce((sum, card) => sum + card.weight, 0);
  // let random = seed * totalWeight;

  // for (const card of cards) {
  //   random -= card.weight;
  //   if (random <= 0) return card;
  // }

  //return cards[cards.length - 1];

  return cards[getRandomInt(0, cards.length - 1)];
}

export function validateCardId(cardId, validIds) {
  return validIds.has(cardId);
}

export function formatDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

export function getRarityLabel(weight) {
  if (weight >= 40) return 'Commune ⭐';
  if (weight >= 15) return 'Peu commune ⭐⭐';
  if (weight >= 5) return 'Rare ⭐⭐⭐';
  if (weight >= 2) return 'Très rare ⭐⭐⭐⭐';
  return 'Exceptionnelle 🌟';
}
