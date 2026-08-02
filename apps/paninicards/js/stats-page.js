/**
 * stats-page.js - Point d'entrée pour la page statistiques
 */

import { getCollection, saveCollection, exportCollection, importCollection, deleteCollection } from './storage.js';
import { showCardDetail } from './ui.js';
import { getRarityLabel } from './utils.js';

let config = null;

async function init() {
  try {
    // Charger la config
    const response = await fetch('config.json');
    config = await response.json();
    console.log('Config chargée :', config);

    // Setup actions
    setupActions();

    // Afficher stats
    updateStats();

  } catch (error) {
    console.error('Erreur lors de l\'initialisation', error);
    alert('Erreur lors du chargement. Rafraîchissez la page.');
  }
}

function updateStats() {
  const stored = getCollection();
  const collection = stored.collection || [];

  const unique = new Set(collection);
  const duplicates = collection.length - unique.size;
  const percentage = Math.round((unique.size / config.cards.length) * 100);

  // Mise à jour des stats
  document.getElementById('stat-total').textContent = collection.length;
  document.getElementById('stat-unique').textContent = unique.size;
  document.getElementById('stat-duplicates').textContent = duplicates;
  document.getElementById('stat-percentage').textContent = `${percentage}%`;

  // Progression
  document.getElementById('progress-text').textContent = 
    `${unique.size}/${config.cards.length} cartes`;
  
  const progressPercentage = Math.min(100, (unique.size / config.cards.length) * 100);
  document.getElementById('progress-fill').style.width = `${progressPercentage}%`;

  // Afficher les cartes obtenues
  displayMyCollection(collection, unique);
}

function displayMyCollection(collection, unique) {
  const container = document.getElementById('my-collection');
  container.innerHTML = '';

  if (unique.size === 0) {
    container.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 40px;">Aucune carte obtenue pour le moment. Allez faire un tirage !</p>';
    return;
  }

  const cardCounts = {};
  collection.forEach(cardId => {
    cardCounts[cardId] = (cardCounts[cardId] || 0) + 1;
  });

  config.cards.forEach(card => {
    if (cardCounts[card.id]) {
      const count = cardCounts[card.id];
      const cardEl = document.createElement('div');
      cardEl.className = 'collection-card';

      const imageUrl = card.images[0]?.url || '';

      cardEl.innerHTML = `
        <img src="${imageUrl}" 
             alt="${card.displayName}"
             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 300%22%3E%3Crect fill=%22%23667eea%22 width=%22200%22 height=%22300%22/%3E%3Ctext x=%22100%22 y=%22150%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22white%22 font-size=%2212%22%3E${card.displayName}%3C/text%3E%3C/svg%3E'">
        ${count > 1 ? `<div class="collection-card-count">×${count}</div>` : ''}
      `;

      cardEl.addEventListener('click', () => {
        showCardDetail(card, true);
      });

      container.appendChild(cardEl);
    }
  });
}

function setupActions() {
  // Export
  const exportBtn = document.getElementById('export-btn');
  exportBtn?.addEventListener('click', () => {
    const data = exportCollection();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `panini-collection-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  // Import
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');

  importBtn?.addEventListener('click', () => {
    importFile?.click();
  });

  importFile?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        if (importCollection(content)) {
          alert('Collection importée avec succès !');
          updateStats();
        } else {
          alert('Erreur lors de l\'importation. Vérifiez le format du fichier.');
        }
      } catch (error) {
        console.error('Erreur import', error);
        alert('Erreur lors de l\'importation.');
      }
    };
    reader.readAsText(file);
  });

  // Reset (test)
  const resetBtn = document.getElementById('reset-btn');
  resetBtn?.addEventListener('click', () => {
    if (confirm('⚠️ Êtes-vous sûr ? Cela effacera TOUTE votre collection.')) {
      deleteCollection();
      localStorage.removeItem('paniniConsent');
      alert('Collection réinitialisée. Rafraîchissez la page.');
      location.reload();
    }
  });
}

// Lancer l'app
window.addEventListener('DOMContentLoaded', init);