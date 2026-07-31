const fs = require('fs');
const path = require('path');

function normalizeText(value = '') {
  return String(value).trim().replace(/\s+/g, ' ');
}

function capitalizeWords(value = '') {
  return normalizeText(value)
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function toInitials(prenom, nom) {
  const firstName = normalizeText(prenom).charAt(0) || '';
  const lastName = normalizeText(nom).charAt(0) || '';
  return `${firstName}${lastName}`.toUpperCase();
}

function displayName(prenom, nom) {
  return `${capitalizeWords(prenom)} ${normalizeText(nom).toUpperCase()}`;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isSeparatorRow(cells) {
  if (!Array.isArray(cells) || cells.length === 0) {
    return false;
  }

  return cells.every((cell) => {
    const value = normalizeText(cell);
    return value === '' || /^:?-+:?$/.test(value);
  });
}

function parseMarkdownTable(markdownContent) {
  const lines = markdownContent.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === '## Données');

  if (startIndex === -1) {
    throw new Error('Tableau de données introuvable dans le fichier Markdown.');
  }

  const rows = [];
  let header = null;
  let inTable = false;

  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();

    if (!line) {
      continue;
    }

    if (!line.startsWith('|')) {
      if (inTable) {
        break;
      }
      continue;
    }

    inTable = true;

    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .slice(1, -1)
      .map((cell) => cell.replace(/\\\|/g, '|'));

    if (!cells.length || isSeparatorRow(cells)) {
      continue;
    }

    if (!header) {
      header = cells.map((cell) => cell.toLowerCase().replace(/[^a-z0-9]/g, ''));
      continue;
    }

    const row = {};
    header.forEach((key, index) => {
      row[key] = cells[index] || '';
    });

    rows.push(row);
  }

  return rows.map((row) => ({
    nom: normalizeText(row.nom || ''),
    prenom: normalizeText(row.prenom || ''),
    role: normalizeText(row.role || ''),
    diplome: normalizeText(row.diplome || ''),
    imagediplome: normalizeText(row.imagediplome || ''),
    specification: normalizeText(row.specification || ''),
    image: normalizeText(row.image || ''),
  }));
}

function renderCoachCard(coach) {
  const initials = toInitials(coach.prenom, coach.nom);
  const name = displayName(coach.prenom, coach.nom);
  const hasDiplome = Boolean(normalizeText(coach.diplome));
  const imageDiplomeHtml = normalizeText(coach.imagediplome)
    ? `        <img class="coach-diplome" src="${escapeHtml(coach.imagediplome)}" alt="${escapeHtml(name)}" />`
    : '';
  const hasSpecification = Boolean(normalizeText(coach.specification));
  const imageHtml = normalizeText(coach.image)
    ? `        <img src="${escapeHtml(coach.image)}" alt="${escapeHtml(name)}" />`
    : '';

  return `
<article class="coach-card">
    <div class="coach-portrait">
        <span>${escapeHtml(initials)}</span>
        ${imageHtml}
    </div>
    <div class="coach-info">
        <span class="coach-role">${escapeHtml(coach.role)}</span>
        <h2>${escapeHtml(name)}</h2>
        ${
          hasDiplome
            ? `        <div class="coach-detail">
            <div class="session-meta">
                <span class="icon icon--diplome" aria-hidden="true"></span>
                <small>Diplôme </small>
                <strong>${escapeHtml(coach.diplome)}</strong>
            </div>
            <BR/>
            ${imageDiplomeHtml}
        </div>`
            : ''
        }
        ${
          hasSpecification
            ? `        <div class="coach-detail">
            <div class="session-meta">
                <span class="icon icon--specification" aria-hidden="true"></span>
                <small>Spécialité</small>
                <strong>${escapeHtml(coach.specification)}</strong>
            </div>
        </div>`
            : ''
        }
    </div>
</article>`.trim();
}

function resolveMarkdownPath() {
  const arg = process.argv[2];
  if (arg) {
    return path.resolve(process.cwd(), arg);
  }
  return path.resolve(__dirname, 'coachs.md');
}

function resolveTargetPath() {
  const arg = process.argv[3];
  if (arg) {
    return path.resolve(process.cwd(), arg);
  }
  return path.resolve(__dirname, '..', 'pages', 'coachs.html');
}

function updateCoachesPage(markdownFilePath, targetFilePath) {
  const markdown = fs.readFileSync(markdownFilePath, 'utf8');
  const coaches = parseMarkdownTable(markdown);

  if (!coaches.length) {
    throw new Error('Aucune ligne de données trouvée dans le tableau Markdown.');
  }

  const html = fs.readFileSync(targetFilePath, 'utf8');
  const sectionPattern = /<section class="coaches-grid section-wrap">[\s\S]*?<\/section>/m;

  if (!sectionPattern.test(html)) {
    throw new Error('Section .coaches-grid introuvable dans la page cible.');
  }

  const generatedSection = `<section class="coaches-grid section-wrap">\n${coaches
    .map((coach) => renderCoachCard(coach))
    .join('\n')}\n</section>`;

  const updatedHtml = html.replace(sectionPattern, generatedSection);
  fs.writeFileSync(targetFilePath, updatedHtml, 'utf8');

  console.log(`Source Markdown : ${markdownFilePath}`);
  console.log(`Page des coachs mise à jour : ${targetFilePath}`);
  console.log(`${coaches.length} coach(s) généré(s).`);
}

try {
  const markdownFile = resolveMarkdownPath();
  const targetFile = resolveTargetPath();

  if (!fs.existsSync(markdownFile)) {
    throw new Error(`Fichier Markdown introuvable : ${markdownFile}`);
  }

  if (!fs.existsSync(targetFile)) {
    throw new Error(`Fichier cible introuvable : ${targetFile}`);
  }

  updateCoachesPage(markdownFile, targetFile);
} catch (error) {
  console.error('Erreur lors de la génération des coachs :');
  console.error(error.message);
  process.exit(1);
}
