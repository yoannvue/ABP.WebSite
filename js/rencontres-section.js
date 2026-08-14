import { getEnvironment } from './utils.js';

async function chargerRencontres() {
    try {
        
        const isPuppeteer = getEnvironment() == "puppeteer";
        // Determiner si on on est dans un cas de génération automtique de l'image des rencontres dans github actions

        let data;
        if (!isPuppeteer) {

            // fichierRencontres selon environnement
            let fichierRencontres = "/docs/rencontres.json"
            
            const response = await fetch(fichierRencontres);
            data = await response.json();
        }
        else {
            // dans le cas de puppeteers, on va injecter les données dans la variables windows puisque Fetch est impossible
            data = window.dataRencontres;
        }

        const section = document.getElementById("sectionRencontres");
        section.innerHTML = "";

        if (data.rencontres.length == 0) {
            section.innerText = "Aucune rencontre prévue cette semaine";
            section.className = "AucuneRencontre";
            return;
        }

        const divRencontres = document.createElement("div");
        section.appendChild(divRencontres);
        divRencontres.className= "listRencontres"


        // Tri chronologique
        data.rencontres.sort((a, b) => {
            const da = convertirDate(a.Date);
            const db = convertirDate(b.Date);
            return da - db;
        });

        // titre de la semaine
        let title = document.createElement("span");
        title.innerText = data.semaine;
        title.className = "titreSemaine"
        divRencontres.appendChild(title);

        const domicile = data.rencontres.filter(r => r.ADomicile && !r.EstExempt);
        const exterieur = data.rencontres.filter(r => !r.ADomicile && !r.EstExempt);

        creerGroupe(divRencontres, true, domicile);
        creerGroupe(divRencontres, false, exterieur);

        const exempts = data.rencontres.filter(r => r.EstExempt);
        listerExempts(divRencontres, exempts);

        document.body.setAttribute("data-rencontres-ready", "1");

    } catch (e) {
        console.error(e);
    }
}

function creerGroupe(parent, ADomicile, rencontres) {

    if (rencontres.length == 0) return;

    const h2 = document.createElement("h2");
    h2.className = "titreGroupe";
    let titre = ADomicile ? "SALLE JEAN DEGROS PECQUENCOURT" : "A L'EXTERIEUR"

    h2.textContent = titre;
    parent.appendChild(h2);

    rencontres.forEach(match => {

        const equipeGauche = match.Equipe1;
        const equipeDroite = match.Equipe2;

        const styleequipegauche = match.ADomicile ? "equipeABP" : "";
        const styleequipedroite = match.ADomicile ? "" : "equipeABP";

        const DateFormatted = match.DateFormatted.replace('\\n',"<BR/>");

        const carte = document.createElement("div");
        carte.className = "rencontre";

        carte.innerHTML = `
            <div class="equipe gauche ${styleequipegauche}">${equipeGauche}</div>

            <div class="centre">
                ${DateFormatted}
            </div>

            <div class="equipe droite ${styleequipedroite}">${equipeDroite}</div>
        `;

        parent.appendChild(carte);
    });
}

function listerExempts(parent, exempts) {

    if (exempts.length == 0) return;

    const elExempts = document.createElement("div");
    elExempts.className = "exempt_list";    
    elExempts.textContent = "EXEMPT ";
    
    elExempts.textContent += exempts.map(match => match.ADomicile ? match.Equipe1 : match.Equipe2).join(",")

    parent.appendChild(elExempts);
}

function convertirDate(dateFr) {
    const [date, heure] = dateFr.split(" ");
    const [j, m, a] = date.split("/");
    return new Date(`${a}-${m}-${j}T${heure}`);
}

document.addEventListener("DOMContentLoaded", chargerRencontres);