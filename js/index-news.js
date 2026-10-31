(function () {
  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Regroupe les blocs image/vidéo consécutifs dans un éventail.
  function renderContentBlocks(content = [], titre = '') {
    const parts = [];
    let mediaBuffer = [];

    const flushMedia = () => {
      if (mediaBuffer.length === 0) {
        return;
      }

      const hasVideo = mediaBuffer.some((block) => block.type === 'video');
      if (mediaBuffer.length > 2 || hasVideo) {
        const mediaHtml = mediaBuffer
          .map((block, i) => {
            const alt = block.titre || block.texte || `${block.type === 'video' ? 'Vidéo' : 'Photo'} ${i + 1} de l’actualité « ${titre} »`;
            const caption = block.titre ? ` data-titre="${escapeHtml(block.titre)}"` : '';
            if (block.type === 'video') {
              return `<video src="${escapeHtml(block.lien)}" aria-label="${escapeHtml(alt)}"${caption} muted playsinline preload="metadata"></video><span class="photo-fan__video-play" aria-hidden="true">▶</span>`;
            }
            return `<img src="${escapeHtml(block.lien)}" alt="${escapeHtml(alt)}"${caption} loading="lazy" />`;
          })
          .join('');
        parts.push(`<div class="photo-fan">${mediaHtml}</div>`);
      } else {
        mediaBuffer.forEach((block) => {
          const alt = block.titre || block.texte || 'Image de l’actualité';
          parts.push(`<img src="${escapeHtml(block.lien)}" alt="${escapeHtml(alt)}" loading="lazy" />`);
        });
      }

      mediaBuffer = [];
    };

    content.forEach((block) => {
      if (!block || typeof block !== 'object') {
        return;
      }

      if ((block.type === 'image' || block.type === 'video') && block.lien) {
        mediaBuffer.push(block);
        return;
      }

      flushMedia();

      if (block.type === 'texte' && block.texte) {
        parts.push(`<p>${escapeHtml(block.texte)}</p><br/>`);
      }
    });

    flushMedia();

    return parts.join('');
  }

  function getNewsCardClass(index = 0) {
    const palette = ['post-orange', 'post-blue', 'post-cream'];
    return `post-card ${palette[index % palette.length]}`;
  }

  function renderNewsCard(item = {}, index = 0) {
    const hasReference = item.reference !== undefined && item.reference !== null;
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
        ${hasReference ? `<a href="pages/news.html?reference=${encodeURIComponent(item.reference)}" class="post-read">Lire l’actualité <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></a>` : ''}
      </article>
    `;

    return `<div class="${cardClass}">${cardMarkup}</div>`;
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
  // COMPOSANT : éventail de médias
  // Transforme un <div class="photo-fan"> contenant des images et vidéos
  // en carrousel visuel en éventail, navigable au clic, au clavier
  // et au tactile. Nécessite le fichier news.css.
  // ============================================================
  class PhotoFan {
    constructor(el) {
      this.el = el;
      this.maxSide = 2; // nombre de photos visibles de chaque côté de la photo active
      this.active = 0;
      this.build();
    }

    build() {
      const media = Array.from(this.el.querySelectorAll('img, video')).map((element) => ({
        src: element.currentSrc || element.src,
        alt: element.alt || element.getAttribute('aria-label') || '',
        titre: element.dataset.titre || '',
        type: element.tagName.toLowerCase(),
      }));
      if (media.length === 0) {
        return;
      }

      this.el.innerHTML = '';
      this.el.setAttribute('role', 'group');
      this.el.setAttribute('aria-roledescription', 'carrousel de médias');
      this.el.tabIndex = 0;

      const stage = document.createElement('div');
      stage.className = 'photo-fan__stage';

      this.cards = media.map((p, i) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'photo-fan__card';
        card.setAttribute('aria-label', `${p.type === 'video' ? 'Vidéo' : 'Photo'} ${i + 1} sur ${media.length}${p.alt ? ` : ${p.alt}` : ''}`);
        const preview = document.createElement(p.type);
        preview.src = p.src;
        if (p.type === 'img') {
          preview.alt = p.alt;
          preview.loading = 'lazy';
          card.appendChild(preview);
        } else {
          preview.muted = true;
          preview.playsInline = true;
          preview.preload = 'metadata';
          preview.setAttribute('aria-hidden', 'true');
          const play = document.createElement('span');
          play.className = 'photo-fan__video-play';
          play.setAttribute('aria-hidden', 'true');
          play.textContent = '▶';
          card.appendChild(preview);
          card.appendChild(play);
        }
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

      if (media.length > 1) {
        const nav = document.createElement('div');
        nav.className = 'photo-fan__nav';

        const prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'photo-fan__arrow photo-fan__arrow--prev';
        prev.setAttribute('aria-label', 'Contenu précédent');
        prev.textContent = '‹';
        prev.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.step(-1);
        });

        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'photo-fan__arrow photo-fan__arrow--next';
        next.setAttribute('aria-label', 'Contenu suivant');
        next.textContent = '›';
        next.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.step(1);
        });

        const dots = document.createElement('div');
        dots.className = 'photo-fan__dots';
        this.dots = media.map((_, i) => {
          const d = document.createElement('button');
          d.type = 'button';
          d.className = 'photo-fan__dot';
          d.setAttribute('aria-label', `Aller au contenu ${i + 1}`);
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