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

  function getDivisionFromMatchName(fileName) {
    const normalized = String(fileName || '').replace(/\.zip$/i, '');
    const match = normalized.match(/^0059_([^_]+)_/i);
    return match ? match[1] : null;
  }

  function getCategoryFromMatchName(fileName, teamsData) {
    const division = getDivisionFromMatchName(fileName);
    if (!division || !teamsData || !teamsData.divisions) {
      return null;
    }

    const divisionInfo = teamsData.divisions[division];
    if (!divisionInfo || !divisionInfo.categorie) {
      return null;
    }

    return divisionInfo.categorie;
  }

  function getCategoryOrder(category, teamsData) {
    if (!teamsData || !teamsData.categories) {
      return Number.MAX_SAFE_INTEGER;
    }

    if (teamsData.categories[category] !== undefined) {
      return teamsData.categories[category];
    }

    return Number.MAX_SAFE_INTEGER;
  }

  function formatTeamName(value) {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/(^|\s|-)([a-z])/g, (match, separator, letter) => separator + letter.toUpperCase());
  }

  function getOpponentFromMatchName(fileName) {
    const rawName = String(fileName || '').replace(/\.zip$/i, '');
    if (!rawName) {
      return null;
    }

    const prefix = 'AMICALE_BASKET_PECQUENCOURT';
    const normalized = rawName.toUpperCase();
    const markerIndex = normalized.indexOf(prefix);
    if (markerIndex === -1) {
      return null;
    }

    const opponentPart = rawName.slice(markerIndex + prefix.length).replace(/^[-_]+/, '').replace(/^[0-9]+[-_]+/, '');
    if (!opponentPart) {
      return null;
    }

    return formatTeamName(opponentPart);
  }

  function getZipEntriesFromManifest(data, teamsData) {
    if (!Array.isArray(data)) {
      return [];
    }

    const entries = data
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const sourceName = typeof item.source === 'string' ? item.source : item.name;
        if (!sourceName) {
          return null;
        }

        const category = getCategoryFromMatchName(sourceName, teamsData);
        if (!category) {
          return null;
        }

        const displayName = sourceName.replace(/\.zip$/i, '');
        const opponent = getOpponentFromMatchName(sourceName);

        const files = Array.isArray(item.fichiers) ? item.fichiers : [];
        const links = files
          .map((fileName) => {
            const cleanName = typeof fileName === 'string' ? fileName : '';
            if (!cleanName) return null;

            const lower = cleanName.toLowerCase();
            const label = lower.includes('resume') ? 'Résumé' : lower.includes('feuillematch') ? 'Feuille de match' : null;

            if (!label) return null;

            return {
              label,
              href: getBasePath() + 'data/resultats/' + cleanName,
              name: cleanName,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.label.localeCompare(b.label));

        if (!links.length) {
          return {
            name: sourceName,
            category,
            displayName,
            opponent,
            href: getBasePath() + 'data/resultats/' + sourceName,
            links: [
              {
                label: 'Télécharger',
                href: getBasePath() + 'data/resultats/' + sourceName,
                name: sourceName,
              },
            ],
          };
        }

        return {
          name: sourceName,
          category,
          displayName,
          opponent,
          href: getBasePath() + 'data/resultats/' + sourceName,
          links,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const orderDiff = getCategoryOrder(a.category, teamsData) - getCategoryOrder(b.category, teamsData);
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

    if (entries.length) {
      return entries;
    }

    return data
      .map((item) => {
        const fileName = typeof item === 'string' ? item : item.name;
        if (!fileName || !/\.zip$/i.test(fileName)) {
          return null;
        }

        const category = getCategoryFromMatchName(fileName, teamsData);
        if (!category) {
          return null;
        }

        return {
          name: fileName,
          category,
          displayName: fileName.replace(/\.zip$/i, ''),
          opponent: getOpponentFromMatchName(fileName),
          href: getBasePath() + 'data/resultats/' + fileName,
          links: [
            {
              label: 'Télécharger',
              href: getBasePath() + 'data/resultats/' + fileName,
              name: fileName,
            },
          ],
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const orderDiff = getCategoryOrder(a.category, teamsData) - getCategoryOrder(b.category, teamsData);
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
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
      item.className = 'download-item';

      const itemHeader = document.createElement('div');
      itemHeader.className = 'download-item__title';

      const categoryText = document.createElement('span');
      categoryText.className = 'download-item__category';
      categoryText.textContent = entry.category || (entry.displayName || entry.name.replace(/\.zip$/i, ''));
      itemHeader.appendChild(categoryText);

      if (entry.opponent) {
        const opponentText = document.createElement('span');
        opponentText.className = 'download-item__opponent';
        opponentText.textContent = ' - ' + entry.opponent;
        itemHeader.appendChild(opponentText);
      }

      item.appendChild(itemHeader);

      const subList = document.createElement('ul');
      subList.className = 'download-sublist';

      (entry.links || []).forEach((linkInfo) => {
        const subItem = document.createElement('li');
        const link = document.createElement('a');
        link.href = toAbsoluteUrl(linkInfo.href);
        link.textContent = linkInfo.label;
        link.className = 'download-sub-link';
        link.setAttribute('download', linkInfo.name || linkInfo.label);
        subItem.appendChild(link);
        subList.appendChild(subItem);
      });

      item.appendChild(subList);
      list.appendChild(item);
    });

    main.appendChild(list);
  }

  function init() {
    const main = document.querySelector('main#contenu');
    if (!main) return;

    const manifestUrl = getBasePath() + 'data/resultats/manifest.json?v=' + Date.now();
    const teamsUrl = getBasePath() + 'docs/teams.json?v=' + Date.now();
    const directoryUrl = getBasePath() + 'data/resultats/?v=' + Date.now();

    Promise.all([
      fetch(manifestUrl, { cache: 'no-store' }),
      fetch(teamsUrl, { cache: 'no-store' }),
    ])
      .then(async ([manifestResponse, teamsResponse]) => {
        if (!manifestResponse.ok) {
          throw new Error('Manifest absent');
        }
        if (!teamsResponse.ok) {
          throw new Error('Fichier teams.json absent');
        }

        const [data, teamsData] = await Promise.all([
          manifestResponse.json(),
          teamsResponse.json(),
        ]);

        const entries = getZipEntriesFromManifest(data, teamsData);
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
