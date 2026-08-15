// ============================================================
// CONFIGURATION DU JEU DE MEMORY ABP
// Modifie ces valeurs pour adapter le jeu / faire des tests.
// ============================================================

export const CONFIG = {

  // Nombre de paires par défaut (16 cartes = 8 paires).
  // Peut être surchargé ponctuellement via l'URL : memory.html?pairs=6
  // pratique pour les tests sans toucher au code.
  NUM_PAIRS: 15,

  // Nombre de colonnes de la grille selon le nombre de paires.
  // Ajuste ces paliers si besoin.
  columnsForPairs(numPairs) {
    if (numPairs <= 6) return 3;
    if (numPairs <= 10) return 4;
    if (numPairs <= 15) return 5;
    return 6;
  },

  // Liste des images utilisables pour les paires.
  // Réutilise les mêmes images que le jeu de collection Panini.
  // ⚠️ À ADAPTER : remplace ce tableau par les chemins réels de tes
  // images de cartes (le même dossier que la collection Panini).
  // Il doit y avoir au moins NUM_PAIRS images (idéalement plus, pour
  // pouvoir en tirer aléatoirement un sous-ensemble à chaque partie).
  CARD_IMAGES: [
    "/ressources/Coachs/anaelle.jpg",
    "/ressources/Coachs/AnneGaelle.jpg",
    "/ressources/Coachs/anthony.jpg",
    "/ressources/Coachs/aurelien.jpg",
    "/ressources/Coachs/camille.jpg",
    "/ressources/Coachs/christelle.jpg",
    "/ressources/Coachs/Christian.jpg",
    "/ressources/Coachs/elio.jpg",
    "/ressources/Coachs/Emilien.jpg",
    "/ressources/Coachs/Gaetan.jpg",
    "/ressources/Coachs/Guillaume.jpg",
    "/ressources/Coachs/helene.jpg",
    "/ressources/Coachs/jimmy.jpg",
    "/ressources/Coachs/ludovic.jpg",
    "/ressources/Coachs/Manon.jpg",
    "/ressources/Coachs/Manu.jpg",
    "/ressources/Coachs/olivier.jpg",
    "/ressources/Coachs/Pascal Dorchy.jpg",
    "/ressources/Coachs/remydechappe.jpg",
    "/ressources/Coachs/sabrina.jpg",
    "/ressources/Coachs/Sebastien.jpg",
    "/ressources/Coachs/Steeve Dorchy.jpg",
    "/ressources/Coachs/thomas.jpg",
    "/ressources/Coachs/Yoann.jpg"
  ],

  // ------------------------------------------------------------------
  // GOOGLE FORMS — enregistrement du score
  // ------------------------------------------------------------------
  // 1. Crée un Google Forms avec 3 questions "Réponse courte" :
  //    Pseudo / Temps (secondes) / Date
  // 2. Ouvre le formulaire, clique sur les "..." > Obtenir le lien
  //    pré-rempli, remplis des valeurs bidon dans chaque champ puis
  //    "Obtenir le lien". L'URL générée contient entry.XXXXXXXXX=valeur
  //    pour chaque champ : récupère ces identifiants ci-dessous.
  // 3. L'URL d'envoi (FORM_ACTION_URL) = l'URL du formulaire en
  //    remplaçant "/viewform" par "/formResponse".
  GOOGLE_FORM: {
    ACTION_URL: "https://docs.google.com/forms/d/e/1FAIpQLSe0npwPelPnr0vQTeODnQFtVAXkiZsjbpknKHHE6HB4vg16Hg/formResponse",
    ENTRY_IDS: {
      pseudo: "entry.918904556",
      score: "entry.1380653467"
    },
  },

  // ------------------------------------------------------------------
  // CLASSEMENT — lecture de la Google Sheet liée au formulaire
  // ------------------------------------------------------------------
  // 1. Ouvre la feuille de réponses liée au formulaire.
  // 2. Fichier > Partager > Publier sur le web > format CSV > Publier.
  // 3. Colle l'URL générée ci-dessous.
  // Colonnes attendues dans la sheet, dans cet ordre après l'horodatage
  // Google Forms : [Horodatage, Pseudo, Temps, Date]
  LEADERBOARD_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRT73FjkwIq49i5sgw9VCBOpPNIhP7TUfDwMxH7cnTgcgaFO0Rt6TXdkklNcnKy_SG0xJu2aL1xgK_q/pub?gid=1851944775&single=true&output=csv",

  // Nombre de lignes affichées dans le classement
  LEADERBOARD_MAX_ROWS: 10,
};
