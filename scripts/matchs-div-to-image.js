const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    // Charger ta page existante
    await page.goto("file://" + path.resolve("index.html"), {
        waitUntil: "networkidle0"
    });

    // Attendre que ton script JS ait généré le rendu
    await page.waitForSelector("#sectionRencontres");

    // Capturer uniquement la div
    const element = await page.$("#sectionRencontres");
    await element.screenshot({
        path: path.join(__dirname, "../output/rencontres.png")
    });

    await browser.close();
})();
