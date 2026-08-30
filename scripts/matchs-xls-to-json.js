const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const ExcelJS = require("exceljs");

// Chargement des fichiers
const inputFile = process.argv[2];

if (!inputFile) {
    console.error("❌ Aucun fichier XLS fourni en argument.");
    process.exit(0);
}

const excelPath = path.join(__dirname, "..", inputFile);
const teamsPath = path.join(__dirname, "../docs/teams.json");
const outputPath = path.join(__dirname, "../docs/rencontres.json");

const config = JSON.parse(fs.readFileSync(teamsPath, "utf8"));

// --- Fonctions utilitaires ---

function parseDate(dateStr, hourStr) {
    const [day, month, year] = dateStr.split("/");
    const hour = hourStr || "";
    const [h, min] = hour ? hour.split(":") : ["00", "00"];

    return {
        iso: `${year}-${month}-${day}`,
        hour: hour,
        dayName: getDayName(year, month, day),
        jsDate: new Date(year, month - 1, day, h, min)
    };
}

function getDayName(year, month, day) {
    const date = new Date(`${year}-${month}-${day}`);
    const days = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
    return days[date.getDay()];
}

function DayOfDate(dateObj) {
    const day = String(dateObj.jsDate.getDate()).padStart(2, "0");
    const month = String(dateObj.jsDate.getMonth() + 1).padStart(2, "0");
    const year = dateObj.jsDate.getFullYear();
    return `${year}/${month}/${day}`;
}

function formatDate(dateObj) {
    return `${dateObj.dayName}\n${dateObj.hour.replace(":", "H")}`;
}

function isHome(row) {
    return row["Equipe 1"].startsWith("AMICALE BASKET PECQUENCOURT");
}

function normalizeEquipe(name) {
    
    // 1. Supprimer les parenthèses et leur contenu, ex: "(10)"
    let cleaned = name.replace(/\([^)]*\)/g, "").trim();

    // 2. Extraire le numéro après le "-" s'il existe, ex: "- 2"
    let numero = null;
    const match = cleaned.match(/^(.*?)-\s*(\d+)\s*$/);
    if (match) {
        cleaned = match[1].trim();
        numero = match[2];
    }

    // 3. Normaliser via la config sur le nom de base
    let nom = cleaned;
    if (config.adversaires[cleaned] !== undefined) {
        nom = cleaned;
    }

    console.log("Normalize " + name +" => "+nom);

    return { nom, numero };
}

// --- Réparation du fichier XLSX de la fédération ---
// Les exports FFBB (rechercherRencontreAccueil / ProchainesRencontres) sont
// techniquement valides mais non standard sur deux points, ce qui fait
// planter exceljs ("Cannot set properties of undefined (setting 'sheetNo')") :
//   1. Les cibles de relations OOXML sont absolues ("/xl/worksheets/sheet1.xml")
//      au lieu de relatives.
//   2. Les éléments SpreadsheetML sont préfixés par un namespace "x:"
//      (<x:worksheet>, <x:row>, <x:c>...) qu'exceljs ne reconnaît pas.
// On corrige ces deux points en mémoire avant de charger le fichier, plutôt
// que de dépendre du paquet npm "xlsx" (SheetJS) dont la version publiée sur
// le registre npm contient des failles non corrigées (pollution de prototype,
// ReDoS - voir CVE-2023-30533 / CVE-2024-22363, correctifs jamais publiés sur npm).
async function repairFederationXlsx(buffer) {
    const zip = await JSZip.loadAsync(buffer);

    for (const filename of Object.keys(zip.files)) {
        if (!filename.endsWith(".xml") && !filename.endsWith(".rels")) continue;

        let content = await zip.files[filename].async("string");
        const original = content;

        // Chemins de relations absolus -> relatifs
        content = content.replace(/Target="\/xl\//g, 'Target="');

        // Préfixe de namespace "x:" -> namespace par défaut
        content = content.replace(/<x:([a-zA-Z0-9]+)/g, "<$1");
        content = content.replace(/<\/x:([a-zA-Z0-9]+)/g, "</$1");
        content = content.replace(/\sxmlns:x="([^"]+)"/, ' xmlns="$1"');

        if (content !== original) {
            zip.file(filename, content);
        }
    }

    return zip.generateAsync({ type: "nodebuffer" });
}

// --- Fonction pour convertir les données Excel en JSON ---
async function extractFromExcel(filePath) {
    const rawBuffer = fs.readFileSync(filePath);
    const repairedBuffer = await repairFederationXlsx(rawBuffer);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(repairedBuffer);

    const worksheet = workbook.getWorksheet(1); // Première feuille
    const rows = [];

    // Extraire l'en-tête
    const headerRow = worksheet.getRow(1);
    const headers = headerRow.values.slice(1); // Ignorer l'index 0

    // Extraire les données
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Ignorer l'en-tête

        const rowData = {};
        row.values.forEach((value, colIndex) => {
            if (colIndex > 0 && headers[colIndex - 1]) {
                rowData[headers[colIndex - 1]] = value || "";
            }
        });

        // Ne pas ajouter les lignes vides
        if (Object.values(rowData).some(val => val !== "")) {
            rows.push(rowData);
        }
    });

    return rows;
}

// --- Transformation principale ---
async function main() {
    try {
        const rawRows = await extractFromExcel(excelPath);

        const rencontres = rawRows.map(row => {

            const dateObj = parseDate(row["Date de rencontre"], row["Heure"]);

            const divisionRow = row["Division"];
            const division = config.divisions[divisionRow];

            const estExempt = row["Equipe 1"] == "Exempt" || row["Equipe 2"] == "Exempt";
            const { nom: equipe1Nom, numero: equipe1Numero } = normalizeEquipe(row["Equipe 1"]);
            const { nom: equipe2Nom, numero: equipe2Numero } = normalizeEquipe(row["Equipe 2"]);

            const Adomicile = isHome(row);

            return {
                Type: division.type,
                Equipe1: (Adomicile ? division.categorie : equipe1Nom)+ (equipe1Numero?"-"+equipe1Numero:""),
                Equipe2: (!Adomicile ? division.categorie : equipe2Nom)+ (equipe2Numero?"-"+equipe2Numero:""),
                Date: dateObj.jsDate,
                JourRencontre: DayOfDate(dateObj),
                DateFormatted: formatDate(dateObj),
                Salle: row["Salle"],
                EstExempt: estExempt,
                ADomicile: Adomicile
            };
        });

        // --- Calcul automatique du titre de la semaine ---
        const firstDate = rencontres.sort((a, b) => a.Date - b.Date)[0].Date;
        const weekTitle = `Semaine du ${firstDate.getDate()} ${firstDate.toLocaleString("fr-FR", { month: "long" })}`;

        // --- Encapsulation dans l'objet final ---
        const output = {
            semaine: weekTitle,
            rencontres
        };

        // --- Écriture du fichier JSON ---
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

        console.log("✔ Fichier JSON généré :", outputPath);
    } catch (error) {
        console.error("❌ Erreur lors du traitement du fichier :", error);
        process.exit(1);
    }
}

// Exécution
main();