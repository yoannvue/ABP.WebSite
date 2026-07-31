(function () {
  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderSession(session = {}) {
    return `
      <div class="session">
        <div class="session-meta">
          <span class="icon icon--clock" aria-hidden="true"></span>
          <strong>${escapeHtml(session.day || '')}</strong>
        </div>
        <span>${escapeHtml(session.time || '')}</span>
        <small>
          <div class="session-meta">
            <span class="icon icon--pin" aria-hidden="true"></span>
            ${escapeHtml(session.place || '')}
          </div>
        </small>
      </div>
    `;
  }

  function renderScheduleRow(row = {}) {
    const accent = row.accent || 'cream';
    const sessions = Array.isArray(row.sessions) ? row.sessions : [];

    return `
      <article class="schedule-row accent-${escapeHtml(accent)}">
        <div class="schedule-category">
          <span>${escapeHtml(row.age || '')}</span>
          <h2>${escapeHtml(row.label || '')}</h2>
          <span class="coach">${escapeHtml(row.coach || '')}</span>
        </div>

        <div class="schedule-sessions">
          ${sessions.map((session) => renderSession(session)).join('')}
        </div>
      </article>
    `;
  }

  function renderSchedule(rows) {
    const root = document.querySelector('[data-schedule-render]');
    if (!root) {
      return;
    }

    const list = Array.isArray(rows) ? rows : [];
    root.innerHTML = list
      .map((row) => renderScheduleRow(row))
      .join('');
  }

  async function loadSchedule() {
    const url = new URL('../docs/entrainements.json', window.location.href).toString();

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Impossible de charger le fichier entrainements.json');
      }

      const data = await response.json();
      renderSchedule(data.rows || []);
    } catch (error) {
      console.error('Schedule render error:', error);
      const root = document.querySelector('[data-schedule-render]');
      if (root) {
        root.innerHTML = '<p class="schedule-empty">Aucun créneau disponible pour le moment.</p>';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSchedule);
  } else {
    loadSchedule();
  }
})();
