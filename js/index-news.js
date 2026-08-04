(function () {
  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderContentBlocks(content = []) {
    return content
      .map((block) => {
        if (!block || typeof block !== 'object') {
          return '';
        }

        if (block.type === 'texte' && block.texte) {
          return `<p>${escapeHtml(block.texte)}</p><Br/>`;
        }

        if (block.type === 'image' && block.lien) {
          return `<img src="${escapeHtml(block.lien)}" alt="${escapeHtml(block.texte || 'Image de l’actualité')}" loading="lazy" />`;
        }

        return '';
      })
      .join('');
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
        ${renderContentBlocks(item.contenu || [])}
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNews);
  } else {
    loadNews();
  }
})();
