(function () {
  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderPhoto(imageUrl, teamName, index) {
    if (!imageUrl) {
      return '';
    }

    return `
      <figure class="team-photo">
        <a href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener noreferrer">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(teamName)} - photo ${index + 1}" loading="lazy" />
        </a>
      </figure>
    `;
  }

  function renderTeamCard(team = {}) {
    const teamName = team.equipe || 'Équipe';
    const coach = team.coach || 'Coach à confirmer';
    const photos = Array.isArray(team.photos) ? team.photos.filter(Boolean) : [];

    return `
      <article class="team-card">
        <div class="team-card-header">
          <div>
            <span class="team-category">Équipe</span>
            <h3>${escapeHtml(teamName)}</h3>
          </div>
          <span class="team-level">Equipe entrainée par ${escapeHtml(coach)}</span>
        </div>

        ${photos.length
          ? `<div class="team-card-gallery">${photos.map((photo, index) => renderPhoto(photo, teamName, index)).join('')}</div>`
          : '<p class="team-card-empty">Aucune photo disponible pour cette équipe.</p>'}
      </article>
    `;
  }

  function renderSeason(season = {}) {
    const teams = Array.isArray(season.equipes) ? season.equipes : [];

    return `
      <section class="season-block">
        <div class="season-header">
          <span class="eyebrow">Saison</span>
          <h2>${escapeHtml(season.saison || 'Saison')}</h2>
        </div>

        <div class="season-teams">
          ${teams.map((team) => renderTeamCard(team)).join('')}
        </div>
      </section>
    `;
  }

  function renderTeams(data) {
    const root = document.querySelector('[data-teams-render]');
    if (!root) {
      return;
    }

    const seasons = Array.isArray(data) ? data : [];
    root.innerHTML = seasons.map((season) => renderSeason(season)).join('');
  }

  async function loadTeams() {
    const url = new URL('../docs/equipes.json', window.location.href).toString();

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Impossible de charger le fichier equipes.json');
      }

      const data = await response.json();
      renderTeams(data);
    } catch (error) {
      console.error('Equipes render error:', error);
      const root = document.querySelector('[data-teams-render]');
      if (root) {
        root.innerHTML = '<p class="teams-empty">Aucune équipe disponible pour le moment.</p>';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTeams);
  } else {
    loadTeams();
  }
})();
