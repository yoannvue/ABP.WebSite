(function () {
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildSponsorCard(sponsor) {
    const name = sponsor && sponsor.name ? sponsor.name : 'Sponsor';
    const image = sponsor && sponsor.file ? sponsor.file : '';
    const url = sponsor && sponsor.url ? sponsor.url : '';

    const link = url
      ? `<a class="sponsor-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Voir le site</a>`
      : '<span class="sponsor-link is-disabled"></span>';

    return `
      <article class="sponsor-card">
        <div class="sponsor-visual">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy" />
        </div>
        <div class="sponsor-body">
          <h3>${escapeHtml(name)}</h3>
          ${link}
        </div>
      </article>
    `;
  }

  function renderSponsors(sponsors) {
    const root = document.querySelector('[data-sponsors-render]');
    if (!root) {
      return;
    }

    const list = Array.isArray(sponsors) ? sponsors : [];
    root.innerHTML = list
      .map((sponsor) => buildSponsorCard(sponsor))
      .join('');
  }

  async function loadSponsors() {
    const url = new URL('../docs/sponsors.json', window.location.href).toString();

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Impossible de charger le fichier sponsors.json');
      }

      const data = await response.json();
      renderSponsors(data);
    } catch (error) {
      console.error('Sponsors render error:', error);
      const root = document.querySelector('[data-sponsors-render]');
      if (root) {
        root.innerHTML = '<p class="sponsors-empty">Aucun sponsor disponible pour le moment.</p>';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSponsors);
  } else {
    loadSponsors();
  }
})();
