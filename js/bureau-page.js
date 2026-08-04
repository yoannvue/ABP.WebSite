(function () {
  const MEMBER_CARD_TEMPLATE = `
    <article class="member-card">
      <div class="card-header"></div>
      {{photoMarkup}}
      <div class="member-content">
        <h3 class="member-name">{{nom}}</h3>
        <span class="member-role">{{role}}</span>
        <p class="member-description">{{description}}</p>
      </div>
    </article>
  `;

  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildPhotoMarkup(photo, altText) {
    if (!photo) {
      return `
        <div class="member-photo member-photo--empty">
          <span>${escapeHtml(altText || 'Membre')}</span>
        </div>
      `;
    }

    return `
      <div class="member-photo">
        <img src="${escapeHtml(photo)}" alt="${escapeHtml(altText)}" loading="lazy" />
      </div>
    `;
  }

  function renderMemberCard(member = {}) {
    const name = member.nom || 'Membre';
    const role = member.role || 'Membre';
    const description = member.description || '';
    const photo = member.photo || '';
    const altText = `${name} - ${role}`;

    return MEMBER_CARD_TEMPLATE
      .replace('{{photoMarkup}}', buildPhotoMarkup(photo, altText))
      .replace('{{nom}}', escapeHtml(name))
      .replace('{{role}}', escapeHtml(role))
      .replace('{{description}}', escapeHtml(description));
  }

  function renderMembers(members) {
    const root = document.querySelector('.bureau-grid');
    if (!root) {
      return;
    }

    const list = Array.isArray(members) ? members : [];
    root.innerHTML = list.map((member) => renderMemberCard(member)).join('');
  }

  async function loadMembers() {
    const url = new URL('../docs/bureau.json', window.location.href).toString();

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Impossible de charger le fichier bureau.json');
      }

      const data = await response.json();
      renderMembers(data);
    } catch (error) {
      console.error('Bureau render error:', error);
      const root = document.querySelector('.bureau-grid');
      if (root) {
        root.innerHTML = '<p class="bureau-empty">Aucun membre du bureau disponible pour le moment.</p>';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMembers);
  } else {
    loadMembers();
  }
})();
