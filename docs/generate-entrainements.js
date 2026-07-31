const fs = require('fs');
const path = require('path');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function extractCodeBlock(markdownContent, language) {
  const escapedLanguage = String(language).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    '(?:^|\\n)\\s*```\\s*' + escapedLanguage + '\\s*\\n([\\s\\S]*?)\\n\\s*```\\s*(?:\\n|$)',
    'i'
  );
  const match = markdownContent.match(regex);

  if (!match) {
    throw new Error(`Bloc ${language} introuvable dans le fichier Markdown.`);
  }

  return match[1].trim();
}

function normalizeData(data) {
  if (!data || typeof data !== 'object') {
    return { rows: [] };
  }

  const rows = Array.isArray(data.rows)
    ? data.rows
    : Array.isArray(data.scheduleRows)
      ? data.scheduleRows
      : [];

  return { rows };
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
</div>`.trim();
}

function renderScheduleRow(row = {}) {
  const sessions = Array.isArray(row.sessions) ? row.sessions : [];
  const accent = row.accent || 'cream';

  return `
<article class="schedule-row accent-${escapeHtml(accent)}">
    <div class="schedule-category">
        <span>${escapeHtml(row.age || '')}</span>
        <h2>${escapeHtml(row.label || '')}</h2>
        <span class="coach">${escapeHtml(row.coach || '')}</span>
    </div>

    <div class="schedule-sessions">
        ${sessions.map(renderSession).join('\n')}
    </div>
</article>`.trim();
}

function renderSchedule(data) {
  const { rows } = normalizeData(data);

  return rows
    .map(renderScheduleRow)
    .join('\n');
}

function updateSchedulePage(markdownFilePath, targetFilePath) {
  const markdownContent = fs.readFileSync(markdownFilePath, 'utf8');
  const jsonSource = extractCodeBlock(markdownContent, 'json');
  const data = JSON.parse(jsonSource);
  const html = fs.readFileSync(targetFilePath, 'utf8');

  const pattern = /<div class="schedule-list">[\s\S]*?<\/div>\s*<\/section>/m;
  if (!pattern.test(html)) {
    throw new Error('Conteneur .schedule-list introuvable dans la page cible.');
  }

  const generatedSection = `<div class="schedule-list">\n${renderSchedule(data)}\n</div>\n</section>`;
  const updatedHtml = html.replace(pattern, generatedSection);

  fs.writeFileSync(targetFilePath, updatedHtml, 'utf8');

  console.log(`Source Markdown : ${markdownFilePath}`);
  console.log(`Page d'entraînements mise à jour : ${targetFilePath}`);
  console.log(`${normalizeData(data).rows.length} créneau(x) généré(s).`);
}

function resolveMarkdownPath() {
  const arg = process.argv[2];
  if (arg) {
    return path.resolve(process.cwd(), arg);
  }

  return path.resolve(__dirname, 'entrainements.md');
}

function resolveTargetPath() {
  const arg = process.argv[3];
  if (arg) {
    return path.resolve(process.cwd(), arg);
  }

  return path.resolve(__dirname, '..', 'pages', 'entrainements.html');
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

  updateSchedulePage(markdownFile, targetFile);
} catch (error) {
  console.error('Erreur lors de la génération des entraînements :');
  console.error(error.message);
  process.exit(1);
}
