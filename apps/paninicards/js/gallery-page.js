/**
 * gallery-page.js - Point d'entrée pour la page galerie
 */

import { showCardDetail } from './ui.js';
import { getCollection } from './storage.js';

let config = null;

async function init() {
  try {
    // Charger la config
    const response = await fetch('config.json');
    config = await response.json();
    console.log('Config chargée :', config);

    // Afficher la galerie
    buildGalleryFromConfig(config);

  } catch (error) {
    console.error('Erreur lors de l\'initialisation', error);
    alert('Erreur lors du chargement de la galerie. Rafraîchissez la page.');
  }
}



export function buildGalleryFromConfig(config) {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';

  const stored = getCollection();
  const ownedIds = new Set(stored.collection || []);

  const sections = {};
  // Préparer les sections et sous-sections à partir de la configuration
  config.gallery.sections.forEach(section => {
    let gallerySection = { name: section.name, cards: [], subsections: {} };

    section.cards?.forEach(card => {
      gallerySection.cards.push(card);
    });

    section.subsections?.forEach(subsection => {
      let subgallerySection = { name: subsection.name, cards: [] };
      subsection.cards.forEach(card => {
        subgallerySection.cards.push(card);
      });
      gallerySection.subsections[subsection.name] = subgallerySection;
    });

    sections[section.name] = gallerySection;
  });

  // Gallery des sections (Equipes, Encadrement, Bureau)
  Object.entries(sections).forEach(([sectionName, section]) => {

    const title = document.createElement('h2');
    title.textContent = sectionName;
    gallery.appendChild(title);
    
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'gallery-section';

    if (Object.keys(section.cards || {}).length > 0) {
      // Gallery des cartes principales de la section
      const grid = document.createElement('div');
      grid.className = 'gallery gallery-full';

      section.cards.forEach(cardid => {
        const cardEl = createGalleryCard(config, cardid, ownedIds);
        grid.appendChild(cardEl);
      });

      sectionDiv.appendChild(grid);
    }

    
    // Gallery des sous-sections
    Object.entries(section.subsections).forEach(([subsectionName, subsection]) => {
      const subsectionDiv = document.createElement('div');
      subsectionDiv.className = 'gallery-subsection';

      if (subsectionName !== 'default') {
        const subtitle = document.createElement('h3');
        subtitle.textContent = subsectionName;
        subsectionDiv.appendChild(subtitle);
      }

      const grid = document.createElement('div');
      grid.className = 'gallery gallery-equipe';

      subsection.cards.forEach(cardid => {
        const cardEl = createGalleryCard(config, cardid, ownedIds);
        grid.appendChild(cardEl);
      });

      subsectionDiv.appendChild(grid);
      sectionDiv.appendChild(subsectionDiv);
    });

    gallery.appendChild(sectionDiv);
  });
}

function createGalleryCard(config, cardid, ownedIds) {
  const div = document.createElement('div');
  div.className = 'gallery-card';

  const isOwned = ownedIds.has(cardid);
  if (isOwned) div.classList.add('owned');

  const card = config.cards.find(c => c.id === cardid);

  const imageUrl = card.images[0]?.url || '';
  let cardstyleimg = 'full';
    switch (card.images[0]?.side) {
      case 'left':
        cardstyleimg = 'clip-gauche';
        break;
      case 'right':
        cardstyleimg = 'clip-droite';
        break;
      default:
        cardstyleimg = '';
    }

  div.innerHTML = `
    <img src="${imageUrl}" 
         alt="${card.displayName}"
         class="gallery-card-image vignette-collection ${cardstyleimg}"
         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 300%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22200%22 height=%22300%22/%3E%3Ctext x=%22100%22 y=%22150%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%2２%236b7280%２２ font-size=%２２1２%２２%3EImage%3C/text%3E%3C/svg%3E'">
  `;

  div.addEventListener('click', () => showCardDetail(card, isOwned));

  return div;
}


// Lancer l'app
window.addEventListener('DOMContentLoaded', init);