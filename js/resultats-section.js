import { getEnvironment } from './utils.js';

async function chargerRencontres() {
    try {
        
        const isPuppeteer = getEnvironment() == "puppeteer";
        // Determiner si on on est dans un cas de génération automtique de l'image des rencontres dans github actions

        let data;
        if (!isPuppeteer) {

            // fichierRencontres selon environnement
            let fichierRencontres = "/docs/resultats.json"
            
            const response = await fetch(fichierRencontres);
            data = await response.json();

            await getDataTeams();
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
            const da = getCategorieDisplayOrder(a.Categorie);
            const db = getCategorieDisplayOrder(b.Categorie);
            return da - db;
        });

        

        data.rencontres.forEach(match => {

            const equipeGauche = match.ADomicile ? match.Equipe1 : getShortName(match.Equipe1);
            const equipeDroite = !match.ADomicile ? match.Equipe2 : getShortName(match.Equipe2);

            const styleequipegauche = match.ADomicile ? "equipeABP" : "";
            const styleequipedroite = match.ADomicile ? "" : "equipeABP";

            const logoequipegauche = match.ADomicile ? getLogoUrl("AMICALE BASKET PECQUENCOURT") : getLogoUrl(match.Equipe1);
            const logoequipedroite = match.ADomicile ? getLogoUrl(match.Equipe2): getLogoUrl("AMICALE BASKET PECQUENCOURT");

            const Score = match.Score1+ (match.Forfait1?"(F)":"") + " - "+match.Score2+(match.Forfait2?"(F)":"");

            const carte = document.createElement("div");
            carte.className = "rencontre";

            carte.innerHTML = `
                <div class="equipe gauche ${styleequipegauche}">
                    <img class="logo" src="${logoequipegauche}"/>
                    <span>${equipeGauche}</span>
                </div>

                <div class="centre">
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

let dataTeams = null;
let dataTeamsPromise = null;

// Charge /docs/teams.json une seule fois, quel que soit le nombre d'appels.
// Le premier appel déclenche le fetch et met en cache la Promise ;
// les appels suivants réutilisent directement cette Promise (déjà résolue ou en cours).
function getDataTeams() {
    if (!dataTeamsPromise) {
        dataTeamsPromise = fetch("/docs/teams.json")
            .then(response => response.json())
            .then(json => {
                dataTeams = json;
                return dataTeams;
            })
            .catch(e => {
                dataTeamsPromise = null; // permet de réessayer au prochain appel en cas d'échec
                throw e;
            });
    }
    return dataTeamsPromise;
}

function getCategorieDisplayOrder(categorie) {
    return dataTeams.categories[categorie];
}

function getShortName(club) {
    var clubObj = dataTeams.adversaires[club];
    if (!clubObj || !clubObj.nomcourt) return club;
    return clubObj.nomcourt;
}

function getLogoUrl(club) {
    var clubObj = dataTeams.adversaires[club];
    if (!clubObj || !clubObj.nomcourt) return "https://competitions.ffbb.com/_next/static/media/club.3obq4sh8-mrx_.svg";
    return clubObj.logo;
}

