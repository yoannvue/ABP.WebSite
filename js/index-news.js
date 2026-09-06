(function () {
  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Regroupe les blocs "image" consécutifs. Un groupe de plus de 2 photos
  // est rendu en éventail (.photo-fan) ; 1 ou 2 photos restent affichées
  // telles quelles, comme avant.
  function renderContentBlocks(content = [], titre = '') {
    const parts = [];
    let imageBuffer = [];

    const flushImages = () => {
      if (imageBuffer.length === 0) {
        return;
      }

      if (imageBuffer.length > 2) {
        const imgsHtml = imageBuffer
          .map((block, i) => {
            const alt = block.titre || block.texte || `Photo ${i + 1} de l’actualité « ${titre} »`;
            const caption = block.titre ? ` data-titre="${escapeHtml(block.titre)}"` : '';
            return `<img src="${escapeHtml(block.lien)}" alt="${escapeHtml(alt)}"${caption} loading="lazy" />`;
          })
          .join('');
        parts.push(`<div class="photo-fan">${imgsHtml}</div>`);
      } else {
        imageBuffer.forEach((block) => {
          const alt = block.titre || block.texte || 'Image de l’actualité';
          parts.push(`<img src="${escapeHtml(block.lien)}" alt="${escapeHtml(alt)}" loading="lazy" />`);
        });
      }

      imageBuffer = [];
    };

    content.forEach((block) => {
      if (!block || typeof block !== 'object') {
        return;
      }

      if (block.type === 'image' && block.lien) {
        imageBuffer.push(block);
        return;
      }

      flushImages();

      if (block.type === 'texte' && block.texte) {
        parts.push(`<p>${escapeHtml(block.texte)}</p><br/>`);
      }
    });

    flushImages();

    return parts.join('');
  }

  function getNewsCardClass(index = 0) {
    const palette = ['post-orange', 'post-blue', 'post-cream'];
    return `post-card ${palette[index % palette.length]}`;
  }

  function renderNewsCard(item = {}, index = 0) {
    const hasLink = typeof item.lien === 'string' && item.lien.trim() !== '';
    const external = hasLink && /^https?:\/\//i.test(item.lien);
    const cardClass = getNewsCardClass(index);
    const cardMarkup = `
      <article>
        <div class="post-number">${String(index + 1).padStart(2, '0')}</div>
        <div class="post-meta">
          <span>${escapeHtml(item.categorie || 'Actualité')}</span>
          <time>${escapeHtml(item.date || '')}</time>
        </div>
        <h3>${escapeHtml(item.titre || 'Actualité')}</h3>
        ${renderContentBlocks(item.contenu || [], item.titre || '')}
        ${hasLink ? '<span class="post-read">Consulter <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>' : ''}
      </article>
    `;

    if (!hasLink) {
      return `<div class="${cardClass}">${cardMarkup}</div>`;
    }

    return `
      <a
        href="${escapeHtml(item.lien)}"
        class="${cardClass}"
        ${external ? 'target="_blank" rel="noopener noreferrer"' : ''}
      >${cardMarkup}</a>
    `;
  }

  function renderNews(items) {
    const root = document.querySelector('[data-news-render]');
    if (!root) {
      return;
    }

    const list = Array.isArray(items) ? items : [];
    root.innerHTML = list.map((item, index) => renderNewsCard(item, index)).join('');

    initPhotoFans(root);
  }

  async function loadNews() {
    const url = new URL('./docs/actualites.json', window.location.href).toString();

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Impossible de charger le fichier actualites.json');
      }

      const data = await response.json();
      renderNews(data);
    } catch (error) {
      console.error('Actualités render error:', error);
      const root = document.querySelector('[data-news-render]');
      if (root) {
        root.innerHTML = '<p class="posts-empty">Aucune actualité disponible pour le moment.</p>';
      }
    }
  }

  // ============================================================
  // COMPOSANT : éventail de photos
  // Transforme un <div class="photo-fan"> contenant des <img>
  // en carrousel visuel en éventail, navigable au clic, au clavier
  // et au tactile. Nécessite le fichier photo-fan.css.
  // ============================================================
  class PhotoFan {
    constructor(el) {
      this.el = el;
      this.maxSide = 2; // nombre de photos visibles de chaque côté de la photo active
      this.active = 0;
      this.build();
    }

    build() {
      const photos = Array.from(this.el.querySelectorAll('img')).map((img) => ({
        src: img.currentSrc || img.src,
        alt: img.alt || '',
        titre: img.dataset.titre || '',
      }));
      if (photos.length === 0) {
        return;
      }

      this.el.innerHTML = '';
      this.el.setAttribute('role', 'group');
      this.el.setAttribute('aria-roledescription', 'carrousel de photos');
      this.el.tabIndex = 0;

      const stage = document.createElement('div');
      stage.className = 'photo-fan__stage';

      this.cards = photos.map((p, i) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'photo-fan__card';
        card.setAttribute('aria-label', p.alt || `Photo ${i + 1} sur ${photos.length}`);
        const img = document.createElement('img');
        img.src = p.src;
        img.alt = p.alt;
        img.loading = 'lazy';
        if (p.titre) {
          img.dataset.titre = p.titre;
        }
        card.appendChild(img);

        if (p.titre) {
          const caption = document.createElement('span');
          caption.className = 'photo-fan__caption';
          caption.textContent = p.titre;
          card.appendChild(caption);
        }
        card.addEventListener('click', (e) => {
          // Empêche la navigation si l'éventail se trouve dans une
          // actualité elle-même cliquable (carte <a class="post-card">).
          e.preventDefault();
          e.stopPropagation();
          this.step(1);
        });
        stage.appendChild(card);
        return card;
      });
      this.el.appendChild(stage);
      this.stage = stage;

      if (photos.length > 1) {
        const nav = document.createElement('div');
        nav.className = 'photo-fan__nav';

        const prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'photo-fan__arrow photo-fan__arrow--prev';
        prev.setAttribute('aria-label', 'Photo précédente');
        prev.textContent = '‹';
        prev.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.step(-1);
        });

        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'photo-fan__arrow photo-fan__arrow--next';
        next.setAttribute('aria-label', 'Photo suivante');
        next.textContent = '›';
        next.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.step(1);
        });

        const dots = document.createElement('div');
        dots.className = 'photo-fan__dots';
        this.dots = photos.map((_, i) => {
          const d = document.createElement('button');
          d.type = 'button';
          d.className = 'photo-fan__dot';
          d.setAttribute('aria-label', `Aller à la photo ${i + 1}`);
          d.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.goTo(i);
          });
          dots.appendChild(d);
          return d;
        });

        nav.appendChild(prev);
        nav.appendChild(dots);
        nav.appendChild(next);
        this.el.appendChild(nav);

        this.el.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') {
            this.step(-1);
            e.preventDefault();
          }
          if (e.key === 'ArrowRight') {
            this.step(1);
            e.preventDefault();
          }
        });

        let startX = null;
        stage.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
        stage.addEventListener('touchend', (e) => {
          if (startX === null) return;
          const dx = e.changedTouches[0].clientX - startX;
          if (Math.abs(dx) > 40) this.step(dx > 0 ? -1 : 1);
          startX = null;
        });
      }
      this.el.appendChild(document.createElement('BR'));
      this.el.appendChild(document.createElement('BR'));
      this.render();
    }

    step(dir) {
      const n = this.cards.length;
      this.goTo((this.active + dir + n) % n);
    }

    goTo(i) {
      this.active = i;
      this.render();
    }

    render() {
      const n = this.cards.length;
      this.cards.forEach((card, i) => {
        let offset = i - this.active;
        if (offset > n / 2) offset -= n;
        if (offset < -n / 2) offset += n;
        const abs = Math.abs(offset);
        const visible = abs <= this.maxSide;

        card.style.setProperty('--offset', offset);
        card.style.setProperty('--abs', abs);
        card.style.zIndex = 100 - abs;
        card.classList.toggle('is-active', offset === 0);
        card.classList.toggle('is-hidden', !visible);
        card.setAttribute('aria-hidden', visible ? 'false' : 'true');
      });
      if (this.dots) {
        this.dots.forEach((d, i) => d.classList.toggle('is-active', i === this.active));
      }
    }
  }

  function initPhotoFans(root) {
    root.querySelectorAll('.photo-fan').forEach((el) => new PhotoFan(el));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNews);
  } else {
    loadNews();
  }
})();