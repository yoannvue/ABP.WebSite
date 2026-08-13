import { FFBBClient } from 'ffbb-api-client';


const CLUB_ID = '200000002677400'; // process.env.FFBB_CLUB_ID;   // ex: '11402'
const CLUB_CODE = 'HDF0059043'; //process.env.FFBB_CLUB_CODE; // ex: 'NOR0014042'

function getMondays() {
  const today = new Date();
  const day = today.getDay(); // 0 = dimanche, 1 = lundi, ...

  // Trouver le lundi de cette semaine
  const mondayThisWeek = new Date(today);
  const diffToMonday = (day === 0 ? -6 : 1 - day); 
  mondayThisWeek.setDate(today.getDate() + diffToMonday);

  // Lundi prochain = lundi cette semaine + 7 jours
  const mondayNextWeek = new Date(mondayThisWeek);
  mondayNextWeek.setDate(mondayThisWeek.getDate() + 28);

  return { mondayThisWeek, mondayNextWeek };
}

const { mondayThisWeek, mondayNextWeek } = getMondays();

const client = new FFBBClient();
await client.authenticate(); // récupère les tokens automatiquement

// Récupère le club et ses engagements (équipes) actifs
const club = await client.getOrganisme(CLUB_ID, {
    fields: [
        'id', 'nom',
        'engagements.id', 'engagements.idCompetition'
    ],
    deep: {
        engagements: {
            _filter: { idCompetition: { saison: { actif: { _eq: true } } } },
        },
    },
});

// const organisme = await client.getOrganisme(CLUB_ID);
// console.log("CLUB : "+JSON.stringify(organisme)+"\n\n");

const allUpcoming = [];
for (const engagement of club.engagements) {
   
    //console.log('Engagement : ' + JSON.stringify(engagement));

    const competition = await client.getCompetition(engagement.idCompetition, {
        fields: [
            'nom','code','poules'
        ],
    });
    //console.log("\tCompetition "+JSON.stringify(competition));

    const poule = await client.getPoule(competition.poules[0], {
        fields: [
            'rencontres.id', 'rencontres.date_rencontre', 'rencontres.joue',
            'rencontres.nomEquipe1', 'rencontres.nomEquipe2',
            'rencontres.idOrganismeEquipe1.code',
            'rencontres.idOrganismeEquipe2.code',
            'rencontres.salle.libelle',
        ],
        deep: { 
            rencontres: { 
                _limit: 1000, 
                _sort: ['date_rencontre'],               
            } 
        },
    });

    const matchsClub = poule.rencontres.filter(r =>
        (r.idOrganismeEquipe1?.code === CLUB_CODE || r.idOrganismeEquipe2?.code === CLUB_CODE ) 
        && !r.joue 
        && mondayThisWeek < new Date(r.date_rencontre) && mondayNextWeek > new Date(r.date_rencontre)
    );

    for (const match of matchsClub) {
        //const rencontre = await client.getRencontre(match.id);
    
        let matchAVenir = {
            Type : competition.code,
            Equipe1 : match.nomEquipe1,
            Equipe2 : match.nomEquipe2,
            Date : match.date_rencontre,
            JourRencontre : match.date_rencontre,
            DateFormatted: match.date_rencontre,
            Salle: "Michel DUJARDIN",
            EstExempt: false,
            ADomicile: false
        }
        allUpcoming.push(matchAVenir);
    }
}

 for (const match of allUpcoming) {
    console.log("Rencontre "+match.Type+" -> "+ match.Equipe1+" vs "+match.Equipe2+" le "+match.JourRencontre);
 }

