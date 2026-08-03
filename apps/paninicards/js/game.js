/**
 * game.js - Logique du jeu (tirage, seed, validation)
 */

import { weightedRandomCard, simpleHash, formatDate, validateCardId } from './utils.js';
import { getCollection, saveCollection } from './storage.js';

let config = null;

export async function initGame() {
  try {
    const response = await fetch('config.json');
    config = await response.json();
    console.log('Config chargée :', config);
    return config;
  } catch (e) {
    console.error('Impossible charger config.json', e);
    throw e;
  }
}

export function isInIncreasePhase() {
  if (!config || !config.drawsIncreasePhase?.enabled) return false;
  const today = formatDate();
  return today >= config.drawsIncreasePhase.startDate;
}

export function getCardsPerDraw() {
  if (isInIncreasePhase()) {
    return config.drawsIncreasePhase.cardsPerDraw;
  }
  return config.mechanics.cardsPerDraw;
}

export function canDrawToday() {
  return true; // Always allow drawing for testing purposes
  // const stored = getCollection();
  // const today = formatDate();
  // return stored.lastDrawDate !== today;
}

export function drawCardsForToday() {
  if (!config) throw new Error('Game not initialized');

  const stored = getCollection();
  const today = formatDate();

  if (!canDrawToday()) {
    return {
      status: 'already_drawn',
      cards: [],
      message: 'Vous avez déjà tiré aujourd\'hui !'
    };
  }

  const cardsPerDraw = getCardsPerDraw();
  const drawnCards = [];
  const ownedIds = new Set(stored.collection || []);

  for (let i = 0; i < cardsPerDraw; i++) {
    const card = weightedRandomCard(config.cards);
    drawnCards.push({
      ...card,
      isNew: !ownedIds.has(card.id)
    });
  }

  const validIds = new Set(config.cards.map(c => c.id));
  const collection = stored.collection || [];
  const newIds = drawnCards.map(c => c.id).filter(id => validateCardId(id, validIds));

  collection.push(...newIds);

  const checksum = simpleHash(JSON.stringify(collection.sort()));

  const newData = {
    collection,
    lastDrawDate: today,
    checksum,
    version: "1.0"
  };

  saveCollection(newData);

  return {
    status: 'success',
    cards: drawnCards,
    message: `Vous avez tiré ${drawnCards.length} carte(s) !`
  };
}

export function getPlayerStats() {
  if (!config) throw new Error('Game not initialized');

  const stored = getCollection();
  const collection = stored.collection || [];

  const unique = new Set(collection);
  const duplicates = collection.length - unique.size;
  const percentage = Math.round((unique.size / config.cards.length) * 100);

  return {
    total: collection.length,
    unique: unique.size,
    duplicates,
    percentage,
    missing: config.cards.filter(c => !unique.has(c.id))
  };
}
