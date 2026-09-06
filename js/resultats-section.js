import { getEnvironment } from './utils.js';

async function chargerRencontres() {
    try {
        
        const isPuppeteer = getEnvironment() == "puppeteer";
        // Determiner si on on est dans un cas de génération automtique de l'image des rencontres dans github actions

        let data, teams;
        if (!isPuppeteer) {

            // fichierRencontres selon environnement
            let fichierRencontres = "/docs/resultats.json"
            let fichierTeams = "/docs/teams.json"
            const response = await fetch(fichierRencontres);
            data = await response.json();

            const responseTeams = await fetch(fichierTeams);
            teams = await responseTeams.json();
        }
        else {
            // dans le cas de puppeteers, on va injecter les données dans la variables windows puisque Fetch est impossible
            data = window.dataRencontres;
            teams = window.dataTeams;
        }

        const section = document.getElementById("sectionRencontres");
        section.innerHTML = "";

        if (data.rencontres.length == 0) {
            section.innerText = "Aucune rencontre cette semaine";
            section.className = "AucuneRencontre";
            return;
        }

        // titre de la semaine
        let title = document.createElement("span");
        title.innerText = data.semaine;
        title.className = "titreSemaine"
        section.appendChild(title);

        const divRencontres = document.createElement("div");
        section.appendChild(divRencontres);
        divRencontres.className= "listRencontres"

        // Tri chronologique
        data.rencontres.sort((a, b) => {
            const da = getCategorieDisplayOrder(teams, a.Categorie);
            const db = getCategorieDisplayOrder(teams, b.Categorie);
            return da - db;
        });

        data.rencontres.forEach(match => {

            const equipeGauche = match.ADomicile ? match.Equipe1 : getShortName(teams, match.Equipe1);
            const equipeDroite = !match.ADomicile ? match.Equipe2 : getShortName(teams, match.Equipe2);

            const styleequipegauche = match.ADomicile ? "equipeABP" : "";
            const styleequipedroite = match.ADomicile ? "" : "equipeABP";

            const logoequipegauche = match.ADomicile ? getLogoUrl(teams, "AMICALE BASKET PECQUENCOURT") : getLogoUrl(teams, match.Equipe1);
            const logoequipedroite = match.ADomicile ? getLogoUrl(teams, match.Equipe2): getLogoUrl(teams, "AMICALE BASKET PECQUENCOURT");

            const Score = (match.Score1?match.Score1:"xx") + (match.Forfait1?"(F)":"") + " - "+(match.Score2?match.Score2:"xx") +(match.Forfait2?"(F)":"");
            const score1 = Number(match.Score1);
            const score2 = Number(match.Score2);
            const gagnant = Number.isFinite(score1) && Number.isFinite(score2) &&
                ((match.ADomicile && score1 > score2) || (!match.ADomicile && score2 > score1));

            const carte = document.createElement("div");
            carte.className = "rencontre";

            carte.innerHTML = `
                <div class="equipe gauche ${styleequipegauche}">
                    <img class="logo" src="${logoequipegauche}"/>
                    <span>${equipeGauche}</span>
                </div>

                <div class="centre${gagnant ? " gagnant" : ""}">
                    <span>${Score}</span>
                </div>

                <div class="equipe droite ${styleequipedroite}">
                    <img class="logo" src="${logoequipedroite}"/>
                    <span>${equipeDroite}</span>
                </div>
            `;

            divRencontres.appendChild(carte);
        });

        document.body.setAttribute("data-rencontres-ready", "1");

    } catch (e) {
        console.error(e);
    }
}

document.addEventListener("DOMContentLoaded", chargerRencontres);


function getCategorieDisplayOrder(teams, categorie) {
    return teams.categories[categorie];
}

function getShortName(teams, club) {
    var clubObj = teams.adversaires[club];
    if (!clubObj || !clubObj.nomcourt) return club;
    return clubObj.nomcourt;
}

function getLogoUrl(teams, club) {
    var clubObj = teams.adversaires[club];
    if (!clubObj || !clubObj.nomcourt) return "https://competitions.ffbb.com/_next/static/media/club.3obq4sh8-mrx_.svg";
    return clubObj.logo;
}

