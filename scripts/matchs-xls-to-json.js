const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

// Chargement des fichiers
const inputFile = process.argv[2];

if (!inputFile) {
    console.error("❌ Aucun fichier XLS fourni en argument.");
    process.exit(0);
}

const excelPath = path.join(__dirname, "..", inputFile);
const teamsPath = path.join(__dirname, "../docs/teams.json");
const outputPath = path.join(__dirname, "../docs/rencontres.json");

const workbook = xlsx.readFile(excelPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

const config = JSON.parse(fs.readFileSync(teamsPath, "utf8"));

// --- Fonctions utilitaires ---

function parseDate(dateStr) {
    const [d, t] = dateStr.split(" ");
    const [day, month, year] = d.split("/");
    return {
        iso: `${year}-${month}-${day}`,
        hour: t,
        dayName: getDayName(year, month, day),
        jsDate: new Date(`${year}-${month}-${day}`)
    };
}

function getDayName(year, month, day) {
    const date = new Date(`${year}-${month}-${day}`);
    const days = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
    return days[date.getDay()];
}

function formatDate(dateObj) {
    return `${dateObj.dayName}\n${dateObj.hour.replace(":", "H")}`;
}

function isHome(salle) {
    return salle.toUpperCase().includes("JEAN DEGROS");
}

function normalizeAdversaire(name) {
    return config.adversaires[name.trim()] || name.trim();
}

// --- Transformation principale ---

const rencontres = rawRows.map(row => {
    const dateObj = parseDate(row.Date);

    return {
        Type: row.Type,
        Equipe1: row.Equipe1.trim(),
        Equipe2: normalizeAdversaire(row.Equipe2),
        Date: row.Date,
        JourRencontre: dateObj.iso,
        DateFormatted: formatDate(dateObj),
        Salle: row.Salle.trim(),
        Categorie: row.Equipe1.split("-")[0],
        EstExempt: false,
        ADomicile: isHome(row.Salle)
    };
});

// --- Calcul automatique du titre de la semaine ---
const firstDate = parseDate(rawRows[0].Date).jsDate;
const weekTitle = `Semaine du ${firstDate.getDate()} ${firstDate.toLocaleString("fr-FR", { month: "long" })}`;

// --- Encapsulation dans l'objet final ---
const output = {
    semaine: weekTitle,
    rencontres
};

// --- Écriture du fichier JSON ---
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

console.log("✔ Fichier JSON généré :", outputPath);
