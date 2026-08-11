# Carte Nord / Pas-de-Calais avec épingles ou logos de clubs

## Contenu du dossier

- `generate_carte.py` — le script Python
- `departement-59-nord.geojson` / `communes-59-nord.geojson` — contour et 648 communes du Nord
- `departement-62-pas-de-calais.geojson` / `communes-62-pas-de-calais.geojson` — contour et 891 communes du Pas-de-Calais
- `departements-france.geojson` — contours simplifiés de tous les départements (pour le mini-plan de situation en haut à droite)
- `logos_cache/` — créé automatiquement : cache local des logos déjà téléchargés (évite de re-télécharger à chaque exécution)

Par défaut, la carte couvre **les deux départements** (Nord + Pas-de-Calais),
ce qui permet de placer des repères sur des communes des deux côtés (ex.
Brebières, qui est dans le Pas-de-Calais). La vue est **recadrée
automatiquement (zoom)** sur l'emprise minimale contenant tous les repères
demandés, avec une marge.

Les contours géographiques proviennent du projet open-data
[france-geojson](https://github.com/gregoiredavid/france-geojson)
(IGN / INSEE, licence Etalab 2.0) et sont inclus dans ce dossier : cette
partie fonctionne **hors ligne**. Seul le mode "clubs" (voir ci-dessous) a
besoin d'un accès internet, pour télécharger les logos.

## Installation

```bash
pip install matplotlib Pillow
pip install contextily
```

## Utilisation

### Mode "communes" (épingles rouges)

```bash
# Liste de communes séparées par des virgules
python generate_carte.py "Pecquencourt, Brebières, Aulnoy-lez-Valenciennes" -o carte.png

# Ou une commune par argument
python generate_carte.py "Douai" "Lille" "Dunkerque" -o carte.png

# Ou depuis un fichier texte (une commune par ligne)
python generate_carte.py --file mes_communes.txt -o carte.png
```

### Mode "clubs" (logo du club, à partir d'un fichier type `teams-reduit.json`)

Donnez le nom du club tel qu'il apparaît dans le dictionnaire `adversaires`
du fichier (la clé, ou son `nomcourt`). Le script va lire la `commune` du
club pour le positionner, puis télécharger et afficher son `logo` :

```bash
python generate_carte.py "AMICALE BASKET PECQUENCOURT" "BREBIERES BC" "AULNOY VALENCIENNES S" \
    --teams teams-reduit.json -o carte_clubs.png

# Fonctionne aussi avec le nomcourt
python generate_carte.py "SOMAIN" --teams teams-reduit.json -o carte.png

# Ou tous les clubs du fichier, un par ligne dans un fichier texte
python generate_carte.py --file mes_clubs.txt --teams teams-reduit.json -o carte.png
```

Si un club n'a pas de `commune` renseignée, pas de `logo`, ou que le
téléchargement du logo échoue (pas de réseau, image introuvable, format non
supporté type SVG...), le script affiche à la place un badge avec les
initiales du club — la carte est toujours générée, avec un avertissement
dans la console listant les cas concernés.

### Options utiles

| Option | Description |
|---|---|
| `--teams`, `-t` | Fichier `teams-reduit.json` : active le mode "clubs" (logos) |
| `--logo-size` | Diamètre des badges-logo, en points (défaut : 54) |
| `-o`, `--output` | Chemin du fichier image de sortie (défaut : `carte.png`) |
| `--title` | Titre affiché en haut à gauche (défaut : auto, ex. "Nord (59) & Pas De Calais (62)") |
| `--no-inset` | Désactive le mini-plan de situation de la France |
| `--dpi` | Résolution de l'image (défaut : 200) |
| `--no-autozoom` | Désactive le zoom auto : affiche l'intégralité des départements chargés |
| `--zoom-margin` | Marge autour des repères en zoom auto, en fraction de leur étendue (défaut : 0.25) |
| `--departements` | Départements à charger, format `code:slug` séparés par des virgules (défaut : `59:nord,62:pas-de-calais`) |

## Remarques

- La recherche de commune (et de club) tolère les accents,
  majuscules/minuscules, et les variantes "les"/"lez" (ex.
  `Aulnoy les Valenciennes` trouvera bien *Aulnoy-lez-Valenciennes*).
- Seules les communes appartenant aux départements chargés (Nord + Pas-de-Calais
  par défaut) seront trouvées. Le script indique en avertissement les noms
  non trouvés plutôt que d'échouer silencieusement.
- Les logos téléchargés sont mis en cache dans `logos_cache/` : les
  exécutions suivantes (ex. génération hebdomadaire) ne re-téléchargent pas
  les logos déjà récupérés. Supprimez ce dossier pour forcer un nouveau
  téléchargement (utile si un club a changé de logo).
- Pour couvrir d'autres départements (ou un seul), utilisez `--departements`,
  par exemple :
  ```bash
  python generate_carte.py "Amiens" --departements "80:somme" -o carte_somme.png
  ```
  Il faut alors avoir téléchargé au préalable les fichiers
  `departement-<code>-<slug>.geojson` et `communes-<code>-<slug>.geojson`
  correspondants depuis le dépôt
  [france-geojson](https://github.com/gregoiredavid/france-geojson)
  (dossier `departements/<code>-<slug>/`) et les placer dans ce dossier.

