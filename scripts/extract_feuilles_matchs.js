const puppeteer = require('puppeteer');
const path = require("path");
const fs = require("fs");

const outputSpec = process.argv[2];

if (!process.env.CI) {
    require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
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
        const resolvedOutputPath = path.resolve(__dirname, outputSpec || '.');
        const targetDir = path.extname(outputSpec || '') ? path.dirname(resolvedOutputPath) : resolvedOutputPath;
        fs.mkdirSync(targetDir, { recursive: true });

        if (fs.existsSync(targetDir)) {
            for (const file of fs.readdirSync(targetDir)) {
                if (file.toLowerCase().endsWith('.zip')) {
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
            const targetPath = path.join(targetDir, path.basename(downloadedFile));
            if (fs.existsSync(targetPath)) {
                fs.rmSync(targetPath, { force: true });
            }
            fs.copyFileSync(downloadedFile, targetPath);
            fs.rmSync(downloadedFile, { force: true });
            console.log('✅ Fichier copié vers :', targetPath);

            const manifestPath = path.join(targetDir, 'manifest.json');
            const manifestEntries = fs.existsSync(manifestPath)
                ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
                : [];

            const fileName = path.basename(targetPath);
            const alreadyPresent = manifestEntries.includes(fileName);
            if (!alreadyPresent) {
                manifestEntries.push(fileName);
                fs.writeFileSync(manifestPath, JSON.stringify(manifestEntries.sort(), null, 2));
                console.log('✅ Manifest mis à jour :', manifestPath);
            }
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

