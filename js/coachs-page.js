(function () {
  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getInitials(prenom = '', nom = '') {
    const first = String(prenom || '').trim().charAt(0) || '';
    const last = String(nom || '').trim().charAt(0) || '';
    return `${first}${last}`.toUpperCase();
  }

  function buildFullName(prenom = '', nom = '') {
    const first = String(prenom || '').trim();
    const last = String(nom || '').trim();
    return `${first} ${last}`.trim();
  }

  function renderCoachCard(coach) {
    const initials = getInitials(coach.prenom, coach.nom);
    const name = buildFullName(coach.prenom, coach.nom).toUpperCase();
    const role = coach.role || '';
    const image = coach.image || '';
    const diplome = coach.diplome || '';
    const imageDiplome = coach.imageDiplome || '';
    const specification = coach.specification || '';

    const portraitImage = image
      ? `<img class="coach-portrait-image" src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy" />`
      : '';

    const diplomeHtml = diplome
      ? `
        <div class="coach-detail">
            <div class="session-meta">
                <span class="icon icon--diplome" aria-hidden="true"></span>
                <small>Diplôme</small>
                <strong>${escapeHtml(diplome)}</strong>
            </div>
            ${imageDiplome ? `<br/><img class="coach-diplome" src="${escapeHtml(imageDiplome)}" alt="${escapeHtml(name)}" />` : ''}
        </div>`
      : '';

    const specificationHtml = specification
      ? `
        <div class="coach-detail">
            <div class="session-meta">
                <span class="icon icon--specification" aria-hidden="true"></span>
                <small>Spécialité</small>
                <strong>${escapeHtml(specification)}</strong>
            </div>
        </div>`
      : '';

    return `
      <article class="coach-card">
        <div class="coach-portrait">
          <span>${escapeHtml(initials)}</span>
          ${portraitImage}
        </div>
        <div class="coach-info">
          <span class="coach-role">${escapeHtml(role)}</span>
          <h2>${escapeHtml(name)}</h2>
          ${diplomeHtml}
          ${specificationHtml}
        </div>
      </article>
    `;
  }

  function renderCoaches(coaches) {
    const root = document.querySelector('[data-coaches-render]');
    if (!root) {
      return;
    }

    const list = Array.isArray(coaches) ? coaches : [];
    root.innerHTML = list
      .map((coach) => renderCoachCard(coach))
      .join('');
  }

  async function loadCoaches() {
    const url = new URL('../docs/coachs.json', window.location.href).toString();

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Impossible de charger le fichier coachs.json');
      }

      const data = await response.json();
      renderCoaches(data);
    } catch (error) {
      console.error('Coaches render error:', error);
      const root = document.querySelector('[data-coaches-render]');
      if (root) {
        root.innerHTML = '<p class="coaches-empty">Aucun coach disponible pour le moment.</p>';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCoaches);
  } else {
    loadCoaches();
  }
})();
