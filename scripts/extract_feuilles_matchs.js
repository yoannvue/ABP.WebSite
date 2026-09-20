const puppeteer = require('puppeteer');
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const AdmZip = require("adm-zip");
const { PDFDocument } = require("@cantoo/pdf-lib");

const outputSpec = process.argv[2];
const projectRoot = process.cwd();

function resolveOutputPath(spec) {
    if (!spec) {
        return path.resolve(projectRoot, 'data/resultats');
    }

    const normalized = String(spec).replace(/^[.][/\\]+/, '');
    const candidate = path.isAbsolute(spec)
        ? spec
        : path.resolve(projectRoot, normalized);

    const rootPrefix = path.resolve(projectRoot) + path.sep;
    if (candidate.startsWith(rootPrefix) || candidate === path.resolve(projectRoot)) {
        return candidate;
    }

    return path.resolve(projectRoot, 'data/resultats');
}

if (!process.env.CI) {
    require("dotenv").config({ path: path.resolve(projectRoot, '.env.local') });
}

const ZIP_PASSWORD = process.env.ZIP_PASSWORD;
if (!ZIP_PASSWORD) {
    throw new Error('❌ ZIP_PASSWORD manquant : refus de publier des PDF non protégés.');
}

// Préfixes (sans accents, en minuscules) des PDF à extraire de chaque archive
const PDF_PREFIXES = ['resume', 'feuillematch'];

function normalize(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // "Résumé" -> "resume"
}

/**
 * Extrait de l'archive les PDF dont le nom commence par un des préfixes,
 * les chiffre (AES-256, via @cantoo/pdf-lib) et les écrit dans targetDir.
 * Retourne la liste des noms de fichiers produits.
 */
async function extractAndProtectPdfs(zipPath, targetDir, password) {
    const zip = new AdmZip(zipPath);
    const produced = [];

    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;

        const name = path.basename(entry.entryName); // basename : évite tout "zip slip"
        const norm = normalize(name);
        if (!norm.endsWith('.pdf') || !PDF_PREFIXES.some((p) => norm.startsWith(p))) continue;

        const outName = name;
        if (produced.includes(outName)) {
            console.log(`⚠️ Doublon ignoré dans l'archive : ${name}`);
            continue;
        }

        const pdfDoc = await PDFDocument.load(entry.getData());
        pdfDoc.encrypt({
            userPassword: password, // mot de passe d'ouverture
            ownerPassword: crypto.randomBytes(16).toString('hex'), // aléatoire et jeté
            permissions: {
                printing: 'highResolution',
                copying: true,
                contentAccessibility: true,
                annotating: true,
                fillingForms: true,
                documentAssembly: true,
            },
        });
        fs.writeFileSync(path.join(targetDir, outName), await pdfDoc.save());
        produced.push(outName);
        console.log('🔒 PDF chiffré :', outName);
    }

    return produced;
}

function formatDate(d) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

const today = new Date();
const day = today.getDay(); // 0=dimanche, 1=lundi, ..., 6=samedi
const daysSinceMonday = (day + 6) % 7; // lundi=0 ... dimanche=6

const dateRencontreDeb = new Date(today);
if (day === 1) {
    // exécution le lundi : on prend le lundi précédent
    dateRencontreDeb.setDate(today.getDate() - 7);
} else {
    // exécution le dimanche, ou tout autre jour : on prend le lundi de la semaine en cours
    dateRencontreDeb.setDate(today.getDate() - daysSinceMonday);
}

const dateRencontreFin = new Date(dateRencontreDeb);
dateRencontreFin.setDate(dateRencontreDeb.getDate() + 6);

(async () => {

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // nécessaire sur les runners GitHub
    });
    const page = await browser.newPage();

    // Dossier de téléchargement (vidé avant chaque run pour être sûr de récupérer le bon fichier)
    const downloadPath = path.resolve(__dirname, '../downloads');
    fs.rmSync(downloadPath, { recursive: true, force: true });
    fs.mkdirSync(downloadPath, { recursive: true });

    const manifestPath = path.resolve(__dirname, '../data/resultats/manifest.json');
    if (fs.existsSync(manifestPath)) {
        fs.rmSync(manifestPath, { force: true });
    }

    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath,
    });

    await page.goto('https://extranet.ffbb.com/fbi/connexion.fbi?invalidate=true');
    await page.type('#materialLoginFormEmail', process.env.FBI_CLIENT);
    await page.type('#materialLoginFormPassword', process.env.FBI_PASSWORD);

    await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
    ]);

    // Tes opérations habituelles ici
    await page.goto('https://extranet.ffbb.com/fbi/rechercherRencontreSaisieResultat.fbi');
    await page.type('#dateRencontreDeb', formatDate(dateRencontreDeb));
    await page.type('#dateRencontreFin', formatDate(dateRencontreFin));
    console.log('Export de ' + formatDate(dateRencontreDeb) + ' au ' + formatDate(dateRencontreFin));
    await page.waitForSelector('#rechercher');

    await Promise.all([
        page.click('#rechercher'),
        page.waitForSelector('#rechercherRencontreSaisieResultatAjax_info', { visible: true }),
        page.waitForFunction(() => {
            const table = document.querySelector('#rechercherRencontreSaisieResultatAjax');
            const tbody = table ? table.querySelector('tbody') : null;
            const rows = tbody ? tbody.querySelectorAll('tr').length : 0;
            const processing = document.querySelector('#rechercherRencontreSaisieResultatAjax_processing');
            const style = processing ? window.getComputedStyle(processing) : null;
            const processingHidden = !processing || style.display === 'none' || style.visibility === 'hidden';
            return rows > 0 && processingHidden;
        }, { timeout: 45000 })
    ]);

    const tableReady = await page.evaluate(() => {
        const table = document.querySelector('#rechercherRencontreSaisieResultatAjax');
        const processing = document.querySelector('#rechercherRencontreSaisieResultatAjax_processing');
        const tbody = table ? table.querySelector('tbody') : null;
        const rowCount = tbody ? tbody.querySelectorAll('tr').length : 0;
        const hasRows = rowCount > 0;
        const style = processing ? window.getComputedStyle(processing) : null;
        const processingVisible = !!processing && style && style.display !== 'none' && style.visibility !== 'hidden';

        console.log('DEBUG table present:', !!table);
        console.log('DEBUG processing visible:', processingVisible);
        console.log('DEBUG tbody exists:', !!tbody);
        console.log('DEBUG rows in tbody:', rowCount);

        return {
            tablePresent: !!table,
            processingVisible,
            tbodyPresent: !!tbody,
            hasRows,
            rowCount,
        };
    });

    console.log('DEBUG tableReady:', tableReady);

    if (!tableReady.tablePresent) {
        throw new Error('❌ Le tableau #rechercherRencontreSaisieResultatAjax est absent de la page.');
    }

    if (tableReady.processingVisible) {
        throw new Error('❌ Le traitement AJAX est encore actif : #rechercherRencontreSaisieResultatAjax_processing est visible.');
    }

    if (!tableReady.tbodyPresent || !tableReady.hasRows) {
        throw new Error('❌ Le tbody du tableau ne contient pas de lignes.');
    }

    const links = await page.$$('#rechercherRencontreSaisieResultatAjax a.emarquepictureafter');
    console.log('Liens trouvés avec la classe emarquepictureafter :', links.length);

    if (links.length) {
        const resolvedOutputPath = resolveOutputPath(outputSpec || 'data/resultats');
        const targetDir = path.extname(outputSpec || '') ? path.dirname(resolvedOutputPath) : resolvedOutputPath;
        fs.mkdirSync(targetDir, { recursive: true });

        if (fs.existsSync(targetDir)) {
            for (const file of fs.readdirSync(targetDir)) {
                const lower = file.toLowerCase();
                if (lower.endsWith('.zip') || lower.endsWith('.pdf')) {
                    fs.rmSync(path.join(targetDir, file), { force: true });
                }
            }
        }

        for (const [index, link] of links.entries()) {
            const onclickCode = await link.evaluate((element) => element.getAttribute('onclick'));
            console.log(`Lien ${index + 1}/${links.length} onclick =`, onclickCode);

            if (!onclickCode) {
                console.log('Aucune action onclick sur ce lien, on ignore le lien.');
                continue;
            }

            const existingFiles = new Set(fs.readdirSync(downloadPath));
            console.log(`Téléchargement ${index + 1}/${links.length}...`);
            await page.evaluate((code) => {
                if (!code) return;
                const execute = new Function(code);
                execute();
            }, onclickCode);

            const downloadedFile = await waitForDownload(downloadPath, existingFiles);
            const zipName = path.basename(downloadedFile);
            const producedFiles = await extractAndProtectPdfs(downloadedFile, targetDir, ZIP_PASSWORD);
            fs.rmSync(downloadedFile, { force: true }); // l'archive en clair n'est jamais publiée

            if (producedFiles.length !== PDF_PREFIXES.length) {
                console.log(`⚠️ ${producedFiles.length} PDF extrait(s) de ${zipName} (${PDF_PREFIXES.length} attendus).`);
            }
            if (!producedFiles.length) {
                continue; // rien à publier, pas d'entrée dans le manifest
            }

            // Manifest : 1 entrée par archive d'origine, avec ses PDF en sous-entrées
            const manifestPath = path.join(targetDir, 'manifest.json');
            const manifestEntries = fs.existsSync(manifestPath)
                ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).filter((e) => e && typeof e === 'object')
                : [];

            const entry = { source: zipName, fichiers: producedFiles.sort() };
            const existingIndex = manifestEntries.findIndex((e) => e.source === zipName);
            if (existingIndex >= 0) {
                manifestEntries[existingIndex] = entry;
            } else {
                manifestEntries.push(entry);
            }

            manifestEntries.sort((a, b) => a.source.localeCompare(b.source));
            fs.writeFileSync(manifestPath, JSON.stringify(manifestEntries, null, 2));
            console.log('✅ Manifest mis à jour :', manifestPath);
        }
    }
    else {
        console.log('Aucun lien de téléchargement trouvé pour la période spécifiée.');
    }

    await browser.close();
})();

async function waitForDownload(downloadPath, existingFiles = new Set(), timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const files = fs.readdirSync(downloadPath);
        const finished = files.find((file) => {
            if (existingFiles.has(file)) return false;
            return !file.endsWith('.crdownload') && !file.endsWith('.tmp');
        });
        if (finished) return path.join(downloadPath, finished);
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('❌ Téléchargement du fichier : timeout dépassé');
}