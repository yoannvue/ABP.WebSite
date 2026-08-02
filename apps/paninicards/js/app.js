/**
 * app.js - Point d'entrée principal et orchestration
 */

import { initGame, drawCardsForToday, getPlayerStats } from './game.js';
import { setupNavigation, displayDrawnCards, updateProgress, displayMissing, setupConsentBanner } from './ui.js';
import { getCollection, saveCollection, exportCollection, importCollection, deleteCollection } from './storage.js';

let config = null;

async function init() {
  try {
    // 1. Charger la config
    config = await initGame();
    console.log('Config chargée :', config);

    // 2. Setup UI général
    setupConsentBanner();
    setupNavigation();

    // 4. Setup tirage quotidien
    setupDailyDraw();

    // 5. Setup actions
    setupActions();

  } catch (error) {
    console.error('Erreur lors de l\'initialisation', error);
    alert('Erreur lors du chargement du jeu. Rafraîchissez la page.');
  }
}

function setupDailyDraw() {
  const drawBtn = document.getElementById('draw-btn');

  drawBtn?.addEventListener('click', () => {
    try {
      const result = drawCardsForToday();

      if (result.status === 'success') {
        // Masquer le div tirage
        const tirageDiv = document.getElementById('tirage');
        if (tirageDiv) {
          tirageDiv.style.display = 'none';
        }
        displayDrawnCards(result.cards);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Erreur tirage', error);
      alert('Erreur lors du tirage. Rafraîchissez la page.');
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
          buildGalleryBySection(config);
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



function displayMyCollection(stats) {
  const container = document.getElementById('my-collection');
  container.innerHTML = '';

  if (stats.unique === 0) {
    container.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 40px;">Aucune carte obtenue pour le moment. Tirez une carte pour commencer !</p>';
    return;
  }

  const stored = getCollection();
  const cardCounts = {};

  stored.collection?.forEach(cardId => {
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

      container.appendChild(cardEl);
    }
  });
}

// Lancer l'app
window.addEventListener('DOMContentLoaded', init);
