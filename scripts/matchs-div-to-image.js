const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    // Charger le JSON AVANT le goto
    const data = JSON.parse(fs.readFileSync("docs/rencontres.json", "utf8"));

    // Injecter les variables AVANT le goto
    await page.evaluateOnNewDocument((data) => {
        window.__IS_PUPPETEER__ = true;
        window.dataRencontres = data;
    }, data);


    // Charger la page
    await page.goto("https://abpecquencourt.fr/pages/matchs.html", {
        waitUntil: "networkidle0"
    });

    // Debug console
    page.on("console", msg => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", err => console.log("PAGE ERROR:", err));

    // Attendre que ton script ait fini
    await page.waitForFunction(() => {
        return document.body.getAttribute("data-rencontres-ready") === "1";
    }, { timeout: 15000 });

    // Screenshot
    const element = await page.$("#sectionRencontres");
    await element.screenshot({
        path: path.join(__dirname, "../data/rencontres/rencontres.png")
    });

    await browser.close();
})();
