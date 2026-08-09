const { sheets } = require("@googleapis/sheets");
const { drive } = require("@googleapis/drive");
const { OAuth2Client } = require("google-auth-library");
const fs = require("fs");

const path = require("path");

if (!process.env.CI) {
    require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
    console.log("DEBUG client_id:", process.env.GOOGLE_OAUTH_CLIENT_ID ? "✅ présent" : "❌ absent");
    console.log("DEBUG refresh_token:", process.env.GOOGLE_OAUTH_REFRESH_TOKEN ? "✅ présent" : "❌ absent");
}

async function main() {
    console.time("⏱️ auth-init");
    console.log("🔧 Initialisation Google APIs...");

    const auth = new OAuth2Client(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET
    );
    auth.setCredentials({
        refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    });

    console.log("👤 Authentification OAuth2 (compte utilisateur)");

    const sheetsClient = sheets({ version: "v4", auth });
    const driveClient = drive({ version: "v3", auth });
    console.timeEnd("⏱️ auth-init");

    // 1. Lire le fichier JSON des matchs
    const jsonPath = process.env.MATCHS_JSON_PATH || "docs/rencontres.json";
    const matchs = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    console.log(`📄 ${matchs.rencontres.length} match(s) chargé(s) depuis ${jsonPath}`);

    // 2. Créer le fichier Sheet DIRECTEMENT dans le dossier Drive cible
    //    Avec l'auth OAuth2, le fichier est créé au nom de l'utilisateur
    //    réel (celui qui a autorisé l'app), donc son propre quota Drive
    //    est utilisé -- plus de problème de quota comme avec le service account
    console.log("📄 Création de la Google Sheet dans le dossier Drive...");

    const fileMetadata = {
        name: "Rencontres "+matchs.semaine,
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
    };

    console.time("⏱️ first-api-call");
    const driveFile = await driveClient.files.create({
        resource: fileMetadata,
        fields: "id"
    });
    console.timeEnd("⏱️ first-api-call");

    const spreadsheetId = driveFile.data.id;
    console.log("✅ Sheet créée avec ID :", spreadsheetId);

    // 2bis. Rendre le fichier accessible en Éditeur à quiconque possède le lien
    console.log("🔓 Partage du fichier (Éditeur, avec le lien)...");
    await driveClient.permissions.create({
        fileId: spreadsheetId,
        resource: {
            type: "anyone",
            role: "writer"
        }
    });
    console.log("✅ Fichier partagé publiquement (lecture/écriture avec le lien)");

    // 3. Renommer l'onglet par défaut en "Matchs"
    //    (le nom de l'onglet créé automatiquement dépend de la locale
    //    du compte, ex. "Feuille 1" — on ne peut pas s'y fier)
    const spreadsheetMeta = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const firstSheetId = spreadsheetMeta.data.sheets[0].properties.sheetId;

    await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
            requests: [
                {
                    updateSheetProperties: {
                        properties: { sheetId: firstSheetId, title: "Matchs" },
                        fields: "title"
                    }
                }
            ]
        }
    });

    // 4. Construire les lignes à partir du JSON
    const header = ["Type","Équipe ABP","Adversaire","Date","Salle","Arbitres","Chrono","Emarque","Souffleur","Resp. Salle","Buvette"];
    const rows = matchs.rencontres.filter(m => m.ADomicile).map(m => [m.Type, m.Equipe1, m.Equipe2, m.Date, m.Salle, "", "","","","",""]);

    // 

    // 5. Remplir la sheet en une seule requête (values.update)
    await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: "Matchs!A1",
        valueInputOption: "RAW",
        resource: {
            values: [header, ...rows]
        }
    });

    console.log("✅ Données écrites dans la Sheet !");
    console.log(`🔗 https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
}

main().catch(err => {
    console.error("❌ Erreur :", err.errors || err.response?.data || err);
    process.exit(1);
});