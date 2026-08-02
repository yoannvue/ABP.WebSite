/**
 * ui.js - Manipulation du DOM et affichage
 */

import { FlipCard } from './flip-card.js';
import { getRarityLabel } from './utils.js';

export function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view');
  const currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  navBtns.forEach(btn => {
    const href = btn.getAttribute('href') || '';
    const targetPage = (href.split('/').pop() || 'index.html').toLowerCase();
    const isPageMatch = targetPage === currentPage;

    btn.classList.toggle('active', isPageMatch);

    if (!btn.dataset.view) {
      return;
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();

      navBtns.forEach(b => b.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      const viewName = btn.dataset.view;
      btn.classList.add('active');

      const targetView = document.getElementById(`${viewName}-view`);
      if (targetView) {
        targetView.classList.add('active');
      }
    });
  });
}

export function displayDrawnCards(cards) {
  const container = document.getElementById('drawn-cards');
  const flipBtn = document.getElementById('flip-btn');

  container.innerHTML = '';
  flipBtn.style.display = 'block';
  flipBtn.disabled = false;

  const flipCards = [];

  cards.forEach((card, index) => {
    const flipCard = new FlipCard(card);
    const cardEl = flipCard.create();

    cardEl.style.animationDelay = `${index * 100}ms`;
    container.appendChild(cardEl);

    flipCards.push({
      flipCard,
      delayBeforeFlip: 1000 + (index * 200)
    });
  });

  const handler = () => {
    flipBtn.disabled = true;

    flipCards.forEach(({ flipCard, delayBeforeFlip }) => {
      flipCard.flipWithDelay(delayBeforeFlip);
    });

    const maxDelay = Math.max(...flipCards.map(f => f.delayBeforeFlip)) + 600;
    setTimeout(() => {
      flipBtn.disabled = false;
    }, maxDelay);
  };

  flipBtn.replaceWith(flipBtn.cloneNode(true));
  const newFlipBtn = document.getElementById('flip-btn');
  newFlipBtn.addEventListener('click', handler);
}

export function updateProgress(stats) {
  document.getElementById('progress-text').textContent =
    `${stats.unique}/${stats.total} cartes`;

  const percentage = Math.min(100, (stats.unique / stats.total) * 100);
  document.getElementById('progress-fill').style.width = `${percentage}%`;
}

export function displayMissing(missing) {
  const list = document.getElementById('missing-list');
  list.innerHTML = '';

  missing.slice(0, 5).forEach(card => {
    const li = document.createElement('li');
    li.textContent = card.displayName;
    list.appendChild(li);
  });

  if (missing.length > 5) {
    const li = document.createElement('li');
    li.textContent = `... et ${missing.length - 5} autres`;
    li.style.fontStyle = 'italic';
    list.appendChild(li);
  }
}

export function setupConsentBanner() {
  const banner = document.getElementById('consent-banner');
  const btn = document.getElementById('consent-btn');

  if (!localStorage.getItem('paniniConsent')) {
    btn.addEventListener('click', () => {
      localStorage.setItem('paniniConsent', 'true');
      banner.style.display = 'none';
      document.getElementById('draw-section').classList.remove('hidden');
    });
  } else {
    banner.style.display = 'none';
    document.getElementById('draw-section').classList.remove('hidden');
  }
}

export function showCardDetail(card, isOwned) {
  const modal = document.getElementById('card-modal');
  
  modal.querySelector('#modal-image').src = card.images[0]?.url || '';
  modal.querySelector('#modal-title').textContent = card.displayName;
  modal.querySelector('#modal-category').textContent = card.category;
  modal.querySelector('#modal-owned').innerHTML = isOwned ? '✅ Obtenue' : '❌ Manquante';
  modal.querySelector('#modal-rarity').textContent = getRarityLabel(card.weight);
  
  modal.style.display = 'flex';

  const closeBtn = modal.querySelector('.modal-close');
  const handler = () => {
    modal.style.display = 'none';
  };
  
  closeBtn.removeEventListener('click', handler);
  closeBtn.addEventListener('click', handler);
  
  modal.removeEventListener('click', (e) => {
    if (e.target === modal) handler();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) handler();
  });
}
