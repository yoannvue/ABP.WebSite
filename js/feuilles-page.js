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

  function stripTeamNumberSuffix(value) {
    // Retire un suffixe de type "-3" ou "_1" en fin de nom d'équipe
    // (ex: "TEMPLEUVE_L_P-3" -> "TEMPLEUVE_L_P", "LAMBRES_BASKET_CLUB-1" -> "LAMBRES_BASKET_CLUB")
    return String(value || '').replace(/[-_]\d+$/, '');
  }

  function getOpponentFromMatchName(fileName) {
    const rawName = String(fileName || '').replace(/\.zip$/i, '');
    if (!rawName) {
      return null;
    }

    const prefix = 'AMICALE_BASKET_PECQUENCOURT';

    // Le nom de fichier suit le motif "0059_DIVISION_CODE_MATCHNUM_EQUIPE_A_EQUIPE_B".
    // On retire les 4 premiers segments (0059, division, code, numéro de match) pour
    // isoler la partie qui ne contient que les deux noms d'équipes.
    const parts = rawName.split('_');
    const teamsSegment = parts.length > 4 ? parts.slice(4).join('_') : rawName;

    const normalizedTeams = teamsSegment.toUpperCase();
    const markerIndex = normalizedTeams.indexOf(prefix);
    if (markerIndex === -1) {
      return null;
    }

    const before = teamsSegment.slice(0, markerIndex).replace(/[-_]+$/, '');
    const after = teamsSegment.slice(markerIndex + prefix.length).replace(/^[-_]+/, '');

    // Ce qui suit immédiatement notre nom de club peut n'être que le suffixe de
    // numéro de notre propre équipe (ex: "..._PECQUENCOURT-1"), pas un adversaire.
    const afterIsOnlyOwnSuffix = after === '' || /^\d+$/.test(after);

    let opponentPart = afterIsOnlyOwnSuffix ? before : after;
    if (!opponentPart) {
      return null;
    }

    opponentPart = stripTeamNumberSuffix(opponentPart);
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

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'download-table-wrapper';

    const table = document.createElement('table');
    table.className = 'download-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');

    ['Catégorie / adversaire', 'Feuille de match', 'Résumé'].forEach((label) => {
      const th = document.createElement('th');
      th.textContent = label;
      headRow.appendChild(th);
    });

    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    entries.forEach((entry) => {
      const row = document.createElement('tr');
      row.className = 'download-table__row';

      const matchCell = document.createElement('td');
      matchCell.className = 'download-table__cell download-table__cell--match';

      const matchSummary = document.createElement('div');
      matchSummary.className = 'download-table__match';

      const categoryLabel = document.createElement('span');
      categoryLabel.className = 'download-table__category';
      categoryLabel.textContent = entry.category || (entry.displayName || entry.name.replace(/\.zip$/i, ''));
      matchSummary.appendChild(categoryLabel);

      if (entry.opponent) {
        const opponentLabel = document.createElement('span');
        opponentLabel.className = 'download-table__opponent';
        opponentLabel.textContent = entry.opponent;
        matchSummary.appendChild(opponentLabel);
      }

      matchCell.appendChild(matchSummary);
      row.appendChild(matchCell);

      const sheetCell = document.createElement('td');
      sheetCell.className = 'download-table__cell';
      const sheetLink = (entry.links || []).find((linkInfo) => {
        const haystack = `${linkInfo.name || ''} ${linkInfo.label || ''} ${linkInfo.href || ''}`.toLowerCase();
        return haystack.includes('feuillematch') || haystack.includes('feuille de match');
      });

      if (sheetLink) {
        const link = document.createElement('a');
        link.href = toAbsoluteUrl(sheetLink.href);
        link.textContent = 'Ouvrir';
        link.className = 'download-table__link';
        link.setAttribute('download', sheetLink.name || 'feuille-de-match.pdf');
        sheetCell.appendChild(link);
      } else {
        sheetCell.innerHTML = '<span class="download-table__empty">-</span>';
      }
      row.appendChild(sheetCell);

      const resumeCell = document.createElement('td');
      resumeCell.className = 'download-table__cell';
      const resumeLink = (entry.links || []).find((linkInfo) => {
        const haystack = `${linkInfo.name || ''} ${linkInfo.label || ''} ${linkInfo.href || ''}`.toLowerCase();
        return haystack.includes('resume') || haystack.includes('résumé');
      });

      if (resumeLink) {
        const link = document.createElement('a');
        link.href = toAbsoluteUrl(resumeLink.href);
        link.textContent = 'Ouvrir';
        link.className = 'download-table__link';
        link.setAttribute('download', resumeLink.name || 'resume.pdf');
        resumeCell.appendChild(link);
      } else {
        resumeCell.innerHTML = '<span class="download-table__empty">-</span>';
      }
      row.appendChild(resumeCell);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    main.appendChild(tableWrapper);
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