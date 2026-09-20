(function () {
  function getBasePath() {
    return location.pathname.includes('/pages/') ? '../' : './';
  }

  function toAbsoluteUrl(url) {
    if (!url) return '';
    if (/^(https?:)?\/\//i.test(url)) {
      return url;
    }
    if (url.startsWith('/')) {
      return new URL(url, window.location.origin).toString();
    }
    return new URL(url, window.location.href).toString();
  }

  function basenameFromUrl(value) {
    const cleaned = value.split('?')[0].split('#')[0];
    const match = cleaned.match(/[^/\\]+$/);
    return match ? decodeURIComponent(match[0]) : cleaned;
  }

  function getZipEntriesFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const entries = Array.from(doc.querySelectorAll('a[href]'))
      .map((link) => {
        const href = link.getAttribute('href') || '';
        const fileName = basenameFromUrl(href);
        return {
          name: fileName,
          href: href,
        };
      })
      .filter((entry) => /\.zip$/i.test(entry.name) || /\.zip$/i.test(entry.href));

    return entries
      .filter((entry, index, list) => {
        const duplicate = list.findIndex((other) => other.name === entry.name);
        return duplicate === index;
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  function getZipEntriesFromManifest(data) {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => {
        const fileName = typeof item === 'string' ? item : item.name;
        if (!fileName || !/\.zip$/i.test(fileName)) {
          return null;
        }

        return {
          name: fileName,
          href: getBasePath() + 'data/resultats/' + fileName,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  function renderList(entries) {
    const main = document.querySelector('main#contenu');
    if (!main) return;

    main.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = 'Feuilles de matchs';
    title.className = 'page-title';
    main.appendChild(title);

    if (!entries.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Aucune feuille de match disponible pour le moment.';
      main.appendChild(empty);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'download-list';

    entries.forEach((entry) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = toAbsoluteUrl(entry.href);
      link.textContent = entry.name;
      link.className = 'download-link';
      link.setAttribute('download', entry.name);
      item.appendChild(link);
      list.appendChild(item);
    });

    main.appendChild(list);
  }

  function init() {
    const main = document.querySelector('main#contenu');
    if (!main) return;

    const manifestUrl = getBasePath() + 'data/resultats/manifest.json?v=' + Date.now();
    const directoryUrl = getBasePath() + 'data/resultats/?v=' + Date.now();

    fetch(manifestUrl, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Manifest absent');
        }
        return response.json();
      })
      .then((data) => {
        const entries = getZipEntriesFromManifest(data);
        renderList(entries);
      })
      .catch(() => {
        fetch(directoryUrl, { cache: 'no-store' })
          .then((response) => {
            if (!response.ok) {
              throw new Error('Impossible de lire le dossier data/resultats');
            }
            return response.text();
          })
          .then((html) => {
            const entries = getZipEntriesFromHtml(html);
            renderList(entries);
          })
          .catch((error) => {
            console.error('Feuilles de matchs : impossible de charger la liste', error);
            renderList([]);
          });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
