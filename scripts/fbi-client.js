const puppeteer = require('puppeteer');
const path = require("path");
const fs = require("fs");

const outputxls = process.argv[2];

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
const nextWeek = new Date();
nextWeek.setDate(today.getDate() + 28);

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
    await page.type('#dateRencontreDeb',formatDate(today));
    await page.type('#dateRencontreFin',formatDate(nextWeek));
    console.log("Export de "+formatDate(today)+" au "+formatDate(nextWeek));
    await page.waitForSelector('#rechercher');

    await Promise.all([        
        page.click('#rechercher'),
        page.waitForSelector('.boutonExcelNew', { visible: true })
    ]);

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

async function waitForDownload(downloadPath, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const files = fs.readdirSync(downloadPath);
        const finished = files.find(f => !f.endsWith('.crdownload') && !f.endsWith('.tmp'));
        if (finished) return path.join(downloadPath, finished);
        await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('❌ Téléchargement du fichier Excel : timeout dépassé');
}

