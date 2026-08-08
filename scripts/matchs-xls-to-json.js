const fs = require("fs");
const path = require("path");
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

// --- Fonction pour convertir les données Excel en JSON ---
async function extractFromExcel(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
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
    } catch (error) {
        console.error("❌ Erreur lors du traitement du fichier :", error.message);
        process.exit(1);
    }
}

// Exécution
main();