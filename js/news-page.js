(function () {
  const status = document.querySelector('[data-news-status]');
  const contentRoot = document.querySelector('[data-news-content]');
  const lightbox = document.querySelector('[data-news-lightbox]');
  const lightboxImage = document.querySelector('[data-lightbox-image]');
  const lightboxVideo = document.querySelector('[data-lightbox-video]');
  const lightboxCaption = document.querySelector('[data-lightbox-caption]');
  const lightboxCount = document.querySelector('[data-lightbox-count]');
  const previousButton = document.querySelector('[data-lightbox-prev]');
  const nextButton = document.querySelector('[data-lightbox-next]');
  const closeButton = document.querySelector('[data-lightbox-close]');
  let media = [];
  let activeMedia = 0;
  let lastFocusedElement = null;

  function safeUrl(value) {
    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }

    try {
      const url = new URL(value, document.baseURI);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch (error) {
      return null;
    }
  }

  function addText(parent, tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function addLink(parent, value, label, className) {
    const href = safeUrl(value);
    if (!href) {
      return false;
    }

    const link = document.createElement('a');
    link.className = className || '';
    link.href = href;
    link.textContent = label;
    if (new URL(href).origin !== window.location.origin) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    parent.appendChild(link);
    return true;
  }

  function showMedia(index) {
    activeMedia = (index + media.length) % media.length;
    const item = media[activeMedia];
    lightboxCaption.textContent = item.caption;
    lightboxCount.textContent = `${activeMedia + 1} / ${media.length}`;

    if (item.type === 'video') {
      lightboxImage.hidden = true;
      lightboxImage.removeAttribute('src');
      lightboxVideo.hidden = false;
      lightboxVideo.src = item.src;
      lightboxVideo.load();
    } else {
      lightboxVideo.pause();
      lightboxVideo.removeAttribute('src');
      lightboxVideo.load();
      lightboxVideo.hidden = true;
      lightboxImage.src = item.src;
      lightboxImage.alt = item.alt;
      lightboxImage.hidden = false;
    }

    const multipleMedia = media.length > 1;
    previousButton.hidden = !multipleMedia;
    nextButton.hidden = !multipleMedia;
  }

  function openLightbox(mediaIndex, trigger) {
    lastFocusedElement = trigger;
    showMedia(mediaIndex);
    lightbox.showModal();
    closeButton.focus();
  }

  function renderImage(block, mediaIndex) {
    const src = safeUrl(block.lien);
    const card = document.createElement('article');
    card.className = 'news-content-card news-image-card';

    if (!src) {
      addText(card, 'p', 'news-unavailable', 'Cette image ne peut pas être affichée.');
      return card;
    }

    const caption = typeof block.titre === 'string' ? block.titre : '';
    const alt = caption || `Photo ${mediaIndex + 1} de l’actualité`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'news-image-button';
    button.setAttribute('aria-label', `Agrandir : ${alt}`);

    const image = document.createElement('img');
    image.src = src;
    image.alt = alt;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      button.remove();
      addText(card, 'p', 'news-unavailable', 'Impossible de charger cette image.');
    }, { once: true });

    button.appendChild(image);
    button.addEventListener('click', () => openLightbox(mediaIndex, button));
    card.appendChild(button);

    if (caption) {
      addText(card, 'p', 'news-image-caption', caption);
    }
    return card;
  }

  function renderVideo(block, mediaIndex) {
    const src = safeUrl(block.lien);
    const card = document.createElement('article');
    card.className = 'news-content-card news-image-card news-video-card';

    if (!src) {
      addText(card, 'p', 'news-unavailable', 'Cette vidéo ne peut pas être affichée.');
      return card;
    }

    const caption = typeof block.titre === 'string' ? block.titre : '';
    const label = caption || `Vidéo ${mediaIndex + 1} de l’actualité`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'news-image-button news-video-button';
    button.setAttribute('aria-label', `Voir la vidéo : ${label}`);

    const video = document.createElement('video');
    video.src = src;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-hidden', 'true');
    video.addEventListener('error', () => {
      button.remove();
      addText(card, 'p', 'news-unavailable', 'Impossible de charger cette vidéo.');
    }, { once: true });

    button.appendChild(video);
    addText(button, 'span', 'news-video-play', '▶');
    button.addEventListener('click', () => openLightbox(mediaIndex, button));
    card.appendChild(button);

    if (caption) {
      addText(card, 'p', 'news-image-caption', caption);
    }
    return card;
  }

  function renderText(block) {
    const card = document.createElement('article');
    card.className = 'news-content-card news-text-card';
    addText(card, 'p', '', typeof block.texte === 'string' ? block.texte : '');

    if (block.lien) {
      const linkContainer = document.createElement('p');
      linkContainer.className = 'news-block-link';
      if (!addLink(linkContainer, block.lien, 'En savoir plus', 'text-link')) {
        addText(linkContainer, 'span', 'news-unavailable', 'Lien indisponible.');
      }
      card.appendChild(linkContainer);
    }
    return card;
  }

  function renderContent(blocks) {
    media = [];
    contentRoot.replaceChildren();

    blocks.forEach((block, index) => {
      if (!block || typeof block !== 'object') {
        addText(contentRoot, 'article', 'news-content-card news-text-card', 'Contenu indisponible.');
        return;
      }

      if (block.type === 'image' || block.type === 'video') {
        const mediaIndex = media.length;
        const src = safeUrl(block.lien);
        if (src) {
          media.push({
            src,
            alt: typeof block.titre === 'string' && block.titre ? block.titre : `Photo ${mediaIndex + 1}`,
            caption: typeof block.titre === 'string' ? block.titre : '',
            type: block.type
          });
          contentRoot.appendChild(block.type === 'video'
            ? renderVideo(block, mediaIndex)
            : renderImage(block, mediaIndex));
        } else {
          contentRoot.appendChild(block.type === 'video'
            ? renderVideo(block, index)
            : renderImage(block, index));
        }
        return;
      }

      if (block.type === 'texte') {
        contentRoot.appendChild(renderText(block));
        return;
      }

      const card = document.createElement('article');
      card.className = 'news-content-card news-text-card';
      addText(card, 'p', '', 'Ce type de contenu ne peut pas être affiché.');
      contentRoot.appendChild(card);
    });

    if (blocks.length === 0) {
      status.textContent = 'Cette actualité ne contient pas encore de contenu.';
      status.hidden = false;
    } else {
      status.hidden = true;
    }
  }

  function renderNews(item) {
    document.querySelector('[data-news-category]').textContent = item.categorie || 'Actualité';
    document.querySelector('[data-news-date]').textContent = item.date || '';

    const title = item.titre || 'Actualité';
    document.querySelector('[data-news-title]').textContent = title;
    document.title = `${title} - Actualités | Amicale Basket Pecquencourt`;

    if (item.lien) {
      const linkContainer = document.querySelector('[data-news-link-container]');
      const link = document.querySelector('[data-news-link]');
      const href = safeUrl(item.lien);
      linkContainer.hidden = false;
      if (href) {
        link.href = href;
        link.textContent = item.lien;
        if (new URL(href).origin !== window.location.origin) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      } else {
        link.textContent = 'Lien indisponible.';
      }
    }

    renderContent(Array.isArray(item.contenu) ? item.contenu : []);
  }

  async function loadNews() {
    const reference = new URLSearchParams(window.location.search).get('reference');
    if (!reference) {
      status.textContent = 'Aucune référence d’actualité n’a été indiquée.';
      document.querySelector('[data-news-title]').textContent = 'Actualité introuvable';
      return;
    }

    try {
      const url = new URL('../docs/actualites.json', window.location.href);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Impossible de charger les actualités (HTTP ${response.status}).`);
      }

      const items = await response.json();
      if (!Array.isArray(items)) {
        throw new Error('Le fichier actualites.json ne contient pas une liste d’actualités.');
      }

      const item = items.find((news) => news && String(news.reference) === reference);
      if (!item) {
        status.textContent = 'Cette actualité est introuvable.';
        document.querySelector('[data-news-title]').textContent = 'Actualité introuvable';
        return;
      }

      renderNews(item);
    } catch (error) {
      console.error('Erreur de chargement de l’actualité :', error);
      status.textContent = 'Impossible de charger cette actualité pour le moment.';
      document.querySelector('[data-news-title]').textContent = 'Actualité indisponible';
    }
  }

  previousButton.addEventListener('click', () => showMedia(activeMedia - 1));
  nextButton.addEventListener('click', () => showMedia(activeMedia + 1));
  closeButton.addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('close', () => {
    lightboxImage.removeAttribute('src');
    lightboxImage.hidden = true;
    lightboxVideo.pause();
    lightboxVideo.removeAttribute('src');
    lightboxVideo.load();
    lightboxVideo.hidden = true;
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  });
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) {
      lightbox.close();
    }
  });
  lightbox.addEventListener('keydown', (event) => {
    if (media.length < 2) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      showMedia(activeMedia - 1);
    } else if (event.key === 'ArrowRight') {
      showMedia(activeMedia + 1);
    }
  });

  loadNews();
})();
