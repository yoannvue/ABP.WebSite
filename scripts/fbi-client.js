const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { formatDate, getDateRangeForMode } = require('./utils.dates');
const { getDownloadDirectory, resetDownloadDirectory, waitForDownload } = require('./utils.files');

const outputxls = process.argv[2];

if (!process.env.CI) {
    require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
}

const today = new Date();
const { start: dayStart, end: dayEnd } = getDateRangeForMode(outputxls || '', today);

(async () => {

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // nécessaire sur les runners GitHub
    });
    const page = await browser.newPage();

    // Dossier de téléchargement (vidé avant chaque run pour être sûr de récupérer le bon fichier)
    const downloadPath = resetDownloadDirectory(getDownloadDirectory(path.resolve(__dirname, '..')));

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
    await page.type('#dateRencontreDeb', formatDate(dayStart));
    await page.type('#dateRencontreFin', formatDate(dayEnd));
    console.log('Export de ' + formatDate(dayStart) + ' au ' + formatDate(dayEnd));
    await page.waitForSelector('#rechercher');
    await page.click('#rechercher');

    await page.waitForFunction(() => {
        const table = document.querySelector('#rechercherRencontreSaisieResultatAjax');
        const tbody = table ? table.querySelector('tbody') : null;
        const rowCount = tbody ? tbody.querySelectorAll('tr').length : 0;
        const processing = document.querySelector('#rechercherRencontreSaisieResultatAjax_processing');
        const style = processing ? window.getComputedStyle(processing) : null;
        const processingHidden = !processing || !style || style.display === 'none' || style.visibility === 'hidden';
        return !!table && processingHidden && rowCount >= 0;
    }, { timeout: 45000 });

    const tableState = await page.evaluate(() => {
        const table = document.querySelector('#rechercherRencontreSaisieResultatAjax');
        const tbody = table ? table.querySelector('tbody') : null;
        const rowCount = tbody ? tbody.querySelectorAll('tr').length : 0;
        const processing = document.querySelector('#rechercherRencontreSaisieResultatAjax_processing');
        const style = processing ? window.getComputedStyle(processing) : null;
        const processingVisible = !!processing && style && style.display !== 'none' && style.visibility !== 'hidden';

        return {
            tablePresent: !!table,
            processingVisible,
            rowCount,
        };
    });

    if (!tableState.tablePresent) {
        throw new Error('❌ Le tableau #rechercherRencontreSaisieResultatAjax est absent de la page.');
    }

    if (tableState.rowCount === 0) {
        console.log('Aucun résultat pour la période demandée, export ignoré.');
        await browser.close();
        return;
    }

    await page.waitForSelector('.boutonExcelNew', { visible: true, timeout: 30000 });

    // Clic sur le bouton d'export Excel
    await page.click('.boutonExcelNew');

    // Attente que le fichier soit bien téléchargé (Chrome écrit en .crdownload pendant le transfert)
    const filePath = await waitForDownload(downloadPath);
    console.log('✅ Fichier téléchargé :', filePath);

    // Copie vers un emplacement fixe dans le repo, pour que le workflow sache quoi commiter
    const targetPath = path.resolve(__dirname, outputxls);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.renameSync(filePath, targetPath);
    console.log('✅ Fichier déplacé vers :', targetPath);

    await browser.close();
})();


