const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

// Chargement des fichiers
const inputurl = process.argv[2];
const inputjson = process.argv[3];
const outputImg = process.argv[4];


(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    // Charger le JSON AVANT le goto
    const data = JSON.parse(fs.readFileSync(inputjson, "utf8"));
    const teams = JSON.parse(fs.readFileSync("docs/teams.json", "utf8"));

    // Injecter les variables AVANT le goto
    await page.evaluateOnNewDocument((data, teams) => {
        window.__IS_PUPPETEER__ = true;
        window.dataRencontres = data;
        window.dataTeams = teams;
    }, data, teams);


    // Charger la page
    await page.goto(inputurl, {
        waitUntil: "networkidle0"
    });

    // Debug console
    page.on("console", msg => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", err => console.log("PAGE ERROR:", err));

    // Attendre que ton script ait fini
    await page.waitForFunction(() => {
        return document.body.getAttribute("data-rencontres-ready") === "1";
    });

    // Screenshot
    const element = await page.$("#sectionRencontres");
    await element.screenshot({
        path: path.join(__dirname, outputImg)
    });

    await browser.close();
    console.log("Fichier "+outputImg+" généré ")
})();
