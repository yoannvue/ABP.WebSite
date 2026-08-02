/**
 * flip-card.js - Classe FlipCard avec animation
 */

export class FlipCard {
  constructor(card) {
    this.card = card;
    this.element = null;
    this.isFlipped = false;
    this.delayMs = 0;
  }

  create() {
    const div = document.createElement('div');
    div.className = 'flip-card appearing';
    
    const imageUrl = this.card.images[0]?.url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"%3E%3Crect fill="%23e5e7eb" width="200" height="300"/%3E%3Ctext x="100" y="150" text-anchor="middle" dy=".3em" fill="%236b7280" font-size="12"%3EImage manquante%3C/text%3E%3C/svg%3E';
    
    let cardstyleimg = 'full';
    switch (this.card.images[0]?.side) {
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
      <div class="flip-card-inner">
        <div class="flip-card-front">
          <img src="/ressources/logo-abp.png" alt="Logo ABP" style="width: 100px; object-fit: cover;filter: grayscale(100%);">
        </div>
        <div class="flip-card-back">
          <img src="${imageUrl}" class="${cardstyleimg} "
               alt="${this.card.displayName}"
               onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 300%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22200%22 height=%22300%22/%3E%3Ctext x=%22100%22 y=%22150%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%236b7280%22 font-size=%2212%22%3EImage manquante%3C/text%3E%3C/svg%3E'">
        </div>
      </div>
    `;

    this.element = div;
    return div;
  }

  flip() {
    this.isFlipped = true;
    this.element?.classList.add('flipping');
  }

  setAppearanceDelay(ms) {
    if (this.element) {
      this.element.style.animationDelay = `${ms}ms`;
    }
  }

  flipWithDelay(delayMs) {
    this.delayMs = delayMs;
    setTimeout(() => this.flip(), delayMs);
  }
}
