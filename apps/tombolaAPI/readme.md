# CLAUDE.md — API Tombola

## Contexte

Backend exposé sous forme d'API pour gérer une tombola, utilisé **une seule fois, en local**, par une application web HTML/JS.

- Une base de données pré-alimentée (import CSV initial, par ligne de commande) contient des **tickets**.
- Chaque ticket est soit **perdant**, soit **gagnant**. Un ticket gagnant est associé à un **lot**.
- Un même lot existe en **plusieurs exemplaires** : il est associé à autant de tickets gagnants que d'exemplaires.
- L'API permet de **tirer un ticket au hasard** et renvoie son état (gagnant / perdant) et son lot éventuel.
- Le tirage **clôture** le ticket : il ne peut plus jamais être tiré de nouveau.
- L'API expose le **nombre de tickets restants** et, pour chaque lot, le **nombre de tickets gagnants restants**.
- Pour le débogage, on peut **réinitialiser** tous les tickets.
- Quand tous les tickets sont tirés, l'API répond `409` ; c'est l'application cliente qui affiche la fin de la tombola.

## Conventions

- **Tout le domaine est modélisé en français** : entités, propriétés, colonnes SQL, routes d'API, champs JSON, messages d'erreur, en-têtes du CSV.
- Le code technique (classes utilitaires, noms de couches comme `Endpoints`, `Services`) peut rester en anglais si c'est l'usage .NET, mais les termes métier restent en français (`Ticket`, `Lot`, `Tirage`, `DateTirage`…).
- Sans accents dans les identifiants (code, routes, JSON), avec accents autorisés dans les messages destinés à l'utilisateur.

## Contraintes et choix techniques

- **Hébergement** : Windows, usage local. Lancement simple (exécutable publié ou `dotnet run`), pas besoin d'IIS ni de service Windows.
- **Runtime** : .NET (technologie maîtrisée). Cible retenue : **.NET 10 (LTS)** (le SDK sera mis à jour sur la machine si besoin).
- **API** : ASP.NET Core Minimal API, écoutant sur un **port fixe** : `http://localhost:5000` (configurable dans `appsettings.json`).
- **Base de données** : SQLite, conservée dans `src/Tombola.Api/data/tombola.db` (rien à installer, volumes très faibles).
- **Accès aux données** : EF Core (provider SQLite) avec migrations, ou Dapper si on veut rester minimaliste — à trancher.
- **CORS** : ouvert (toutes origines), car le client est une page HTML/JS locale (éventuellement ouverte en `file://`).
- **Sécurité** : aucune (application locale, usage unique). Pas d'authentification.
- **Documentation d'API** : OpenAPI généré (Swagger UI en développement).
- **Tests** : xUnit + `WebApplicationFactory` avec une base SQLite temporaire.
- **Principe directeur** : le moins de dépendances et de choses à installer possible.

## Modèle de données

**Lot**
| Champ | Type | Description |
|---|---|---|
| `Id` | entier | Identifiant technique |
| `Nom` | texte, unique | Nom du lot (ex. « Ballon de basket »), seule information affichée |
| `Quantite` | entier | Nombre d'exemplaires (nombre de tickets gagnants associés) |

**Ticket**
| Champ | Type | Description |
|---|---|---|
| `Id` | entier | Identifiant technique |
| `Numero` | texte, unique | Numéro du ticket (format libre, sans importance fonctionnelle) |
| `LotId` | entier, nullable | Lot gagné ; `null` = ticket perdant |
| `DateTirage` | date/heure, nullable | `null` = ticket non tiré ; renseignée = ticket clôturé |

Un ticket est **gagnant** si et seulement si `LotId` est renseigné (pas de champ booléen redondant). `Quantite` d'un lot est déduite de l'import ; elle doit toujours être égale au nombre de tickets liés à ce lot.

## Import du CSV (ligne de commande)

L'import se fait par une **commande en ligne de commande** de l'application, pas par l'API :

```
Tombola.Api.exe importer tickets.csv
Tombola.Api.exe importer tickets.csv --remplacer   # vide la base avant import
```

(En développement : `dotnet run -- importer tickets.csv`.)

- Sans `--remplacer`, l'import est refusé si la base contient déjà des tickets.
- Le programme crée et initialise la base lors du premier import, importe, affiche un récapitulatif (nombre de tickets, de gagnants, quantité par lot) puis s'arrête. Le fichier reste au même emplacement entre les lancements.
- L'API ne crée pas de base au démarrage : si le fichier ou son schéma manque, elle s'arrête avec une erreur et demande d'effectuer l'import.
- Après un crash, redémarrer l'API réutilise le même fichier et conserve les tirages déjà enregistrés. Pour sauvegarder les données, arrêtez l'API puis copiez `src/Tombola.Api/data/tombola.db`.

### Format du CSV

Un fichier unique, **une ligne par ticket**, séparateur `;` (compatible Excel français), encodage UTF-8, ligne d'en-tête obligatoire.

```csv
numero;lot
0001;
0002;Ballon de basket
0003;
0004;Maillot du club
0005;Ballon de basket
```

- `numero` : obligatoire, unique, format libre.
- `lot` : vide = ticket perdant ; sinon nom du lot. Les lots sont créés automatiquement à l'import, et leur `Quantite` est le nombre de lignes qui les citent.
- Contrôles à l'import : numéros uniques, pas de ligne sans numéro, noms de lots normalisés (espaces en trop). Rejet complet du fichier en cas d'erreur, avec la liste des lignes fautives.

## API (proposition)

### Tirage
- `POST /tirages` : choisit **au hasard** un ticket non tiré, renseigne `DateTirage` et renvoie le résultat.
  - Réponse : `{ "numero": "0004", "gagnant": true, "lot": "Maillot du club", "dateTirage": "..." }` (`lot` = `null` si perdant).
  - **Atomique** : deux appels simultanés ne doivent jamais renvoyer le même ticket (mise à jour conditionnelle `WHERE DateTirage IS NULL` ou transaction).
  - Plus aucun ticket disponible : `409 Conflict` avec un message clair (`ProblemDetails`).

### Statistiques
- `GET /statistiques` : renvoie
  ```json
  {
    "ticketsRestants": 120,
    "ticketsGagnantsRestants": 18,
    "lots": [
      { "nom": "Ballon de basket", "quantite": 10, "restants": 7 },
      { "nom": "Maillot du club", "quantite": 5, "restants": 3 }
    ]
  }
  ```

### Débogage
- `POST /administration/reinitialisation` : remet `DateTirage` à `null` sur **tous** les tickets (les lots et les tickets restent inchangés).

## Structure de projet envisagée

```
/src/Tombola.Api          # API : Program.cs, endpoints, services, accès aux données, commande d'import
/tests/Tombola.Api.Tests
/exemples/tickets.csv     # CSV d'exemple
README.md
```

## Liste des tâches

### 1. Cadrage
- [x] Précisions fonctionnelles (hébergement, tirage, lots multiples, stats, sécurité, client, CSV, historique, reset, import, port, 409)
- [x] Version de .NET : .NET 10 (LTS) retenue

### 2. Socle
- [x] Créer le projet API (`src/Tombola.Api`)
- [x] Mettre en place SQLite + Dapper et l'initialisation du schéma
- [x] Définir les tables `Lot` et `Ticket` avec contraintes d'intégrité
- [x] Configurer le port fixe et activer CORS (toutes origines)

### 3. Données
- [x] Commande en ligne de commande `importer` (validation + messages d'erreur en français)
- [x] Fichier CSV d'exemple (`exemples/tickets.csv`)
- [x] Contrôles de numéros uniques et quantités des lots à l'import

### 4. Fonctionnel
- [x] Endpoint de tirage (aléatoire, transaction SQLite, clôture du ticket)
- [x] Gestion du `409` quand il n'y a plus de ticket
- [x] Endpoint de statistiques (restants global et par lot)
- [x] Endpoint de réinitialisation

### 5. Qualité
- [x] Tests du service (dont tirages concurrents, aucun doublon)
- [x] Gestion d'erreurs homogène (`ProblemDetails` en français)
- [x] Logs console

### 6. Exploitation
- [ ] Publication de l'application et procédure de lancement sous Windows
- [ ] Sauvegarde / copie du fichier SQLite avant l'événement
- [ ] README (installation, import, lancement, exemples d'appels depuis le JS)

## Questions ouvertes

Aucune question ouverte pour le moment.

## Développement

Le projet cible .NET 10 et utilise Dapper avec SQLite. Depuis le dossier `apps/tombolaAPI` :

```powershell
dotnet run --project src/Tombola.Api
dotnet run --project src/Tombola.Api -- importer exemples/tickets.csv
dotnet run --project src/Tombola.Api -- importer exemples/tickets.csv --remplacer
dotnet test tests/Tombola.Api.Tests
```

Sous Windows, le fichier `importer-exemple.cmd` lance l'import du CSV fourni en remplaçant systématiquement les tickets déjà présents. Depuis un terminal :

```powershell
.\importer-exemple.cmd
```

Arrêtez l'API avant l'import, puis démarrez-la en débogage une fois l'import terminé. Pour éviter tout remplacement, utilisez directement la commande `dotnet run` sans l'option `--remplacer`.

Le serveur écoute sur `http://localhost:5000`. Swagger UI est disponible en environnement de développement à `/swagger`.

### Débogage de la page de test

Ouvrez la racine du dépôt dans VS Code, puis sélectionnez **Tombola : API + page de test** dans la vue Exécuter et déboguer et appuyez sur **F5**. VS Code démarre l'API avec le profil `http` et ouvre `tests/index.html` dans Edge avec le débogueur JavaScript actif.

La page utilise la base de données habituelle de l'API. Celle-ci doit avoir été initialisée par l'import des tickets avant le démarrage.