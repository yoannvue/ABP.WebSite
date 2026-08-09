const { OAuth2Client } = require("google-auth-library");
const http = require("http");
const url = require("url");
const path = require("path");

if (!process.env.CI) {
    require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
    console.log("DEBUG client_id:", process.env.GOOGLE_OAUTH_CLIENT_ID ? "✅ présent" : "❌ absent");
    console.log("DEBUG refresh_token:", process.env.GOOGLE_OAUTH_REFRESH_TOKEN ? "✅ présent" : "❌ absent");
}

const REDIRECT_URI = "http://localhost:3000/oauth2callback";

async function main() {
    const oAuth2Client = new OAuth2Client(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        REDIRECT_URI
    );

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline", // indispensable pour obtenir un refresh_token
        prompt: "consent",      // force le refresh_token même si déjà autorisé avant
        scope: [
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/spreadsheets"
        ]
    });

    console.log("👉 Ouvre cette URL dans ton navigateur, connecte-toi avec le compte");
    console.log("   qui possède le dossier Drive cible, puis autorise l'accès :\n");
    console.log(authUrl, "\n");

    const server = http.createServer(async (req, res) => {
        const qs = new url.URL(req.url, REDIRECT_URI).searchParams;
        const code = qs.get("code");

        if (!code) {
            res.end("❌ Pas de code reçu.");
            return;
        }

        res.end("✅ Autorisation reçue, tu peux fermer cet onglet et revenir au terminal.");
        server.close();

        const { tokens } = await oAuth2Client.getToken(code);
        console.log("\n🔑 Refresh token obtenu :\n");
        console.log(tokens.refresh_token);
        console.log("\n👉 Copie cette valeur dans le secret GitHub GOOGLE_OAUTH_REFRESH_TOKEN");
        console.log("   (et dans .env.local en GOOGLE_OAUTH_REFRESH_TOKEN pour tes tests locaux)\n");
    });

    server.listen(3000, () => {
        console.log("⏳ En attente de l'autorisation dans le navigateur...\n");
    });
}

main().catch(console.error);