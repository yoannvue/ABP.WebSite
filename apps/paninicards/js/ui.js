/**
 * ui.js - Manipulation du DOM et affichage
 */

import { FlipCard } from './flip-card.js';
import { buildGiftUrl, getRarityLabel } from './utils.js';

function generateGiftQrCode(cardId) {
  const giftUrl = buildGiftUrl(cardId);
  const qrUrl = new URL('https://api.qrserver.com/v1/create-qr-code/');
  qrUrl.searchParams.set('data', giftUrl);
  qrUrl.searchParams.set('size', '320x320');
  qrUrl.searchParams.set('format', 'png');
  qrUrl.searchParams.set('ecc', 'M');
  return qrUrl.toString();
}

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

  container.innerHTML = '';

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

  // Scroll vers les cartes sur mobile
  if (window.innerWidth <= 768) {
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Retournement automatique après 1 seconde
  setTimeout(() => {
    flipCards.forEach(({ flipCard, delayBeforeFlip }) => {
      flipCard.flipWithDelay(delayBeforeFlip);
    });
  }, 1000);
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

export function showCardDetail(card, isOwned, onGive = null) {
  const modal = document.getElementById('card-modal');
  const modalContent = modal.querySelector('.modal-content');
  const modalImage = modal.querySelector('#modal-image');
  const giftUrlEl = modalContent.querySelector('.gift-url');
  const giftUrlParagraph = giftUrlEl || document.createElement('p');

  if (!giftUrlEl) {
    giftUrlParagraph.className = 'gift-url';
    giftUrlParagraph.style.display = 'none';
    modalContent.appendChild(giftUrlParagraph);
  }
  
  modalImage.src = card.images[0]?.url || '';
  modalImage.alt = card.displayName;
  modal.querySelector('#modal-title').textContent = card.displayName;
  modal.querySelector('#modal-category').textContent = card.category;
  modal.querySelector('#modal-owned').innerHTML = isOwned ? '✅ Obtenue' : '❌ Manquante';
  modal.querySelector('#modal-rarity').textContent = getRarityLabel(card.weight);
  if (giftUrlParagraph) {
    giftUrlParagraph.style.display = 'none';
    giftUrlParagraph.textContent = '';
  }

  let actionsContainer = modalContent.querySelector('.modal-actions');
  if (!actionsContainer) {
    actionsContainer = document.createElement('div');
    actionsContainer.className = 'modal-actions';
    modalContent.appendChild(actionsContainer);
  }

  actionsContainer.innerHTML = '';

  if (onGive) {
    const giveBtn = document.createElement('button');
    giveBtn.type = 'button';
    giveBtn.className = 'btn-secondary';
    giveBtn.textContent = 'Donner';
    giveBtn.addEventListener('click', () => {
      try {
        const qrCodeUrl = generateGiftQrCode(card.id);
        const giftUrl = buildGiftUrl(card.id);

        modalImage.src = qrCodeUrl;
        modalImage.alt = `QR code pour donner ${card.displayName}`;
        modal.querySelector('#modal-title').textContent = 'Code QR de donation';
        modal.querySelector('#modal-category').textContent = 'Carte à offrir';
        modal.querySelector('#modal-owned').innerHTML = '🚚 Donnée';
        modal.querySelector('#modal-rarity').textContent = 'QR code';

        giftUrlParagraph.textContent = `URL générée : ${giftUrl}`;
        giftUrlParagraph.style.display = 'block';
        giftUrlParagraph.style.wordBreak = 'break-all';
        giftUrlParagraph.style.fontSize = '12px';
        giftUrlParagraph.style.color = '#4b5563';
        giftUrlParagraph.style.marginTop = '12px';

        actionsContainer.innerHTML = '';
        onGive();
      } catch (error) {
        console.error('Erreur génération QR code', error);
        alert('Impossible de générer le QR code pour cette carte.');
      }
    });
    actionsContainer.appendChild(giveBtn);
  }
  
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
