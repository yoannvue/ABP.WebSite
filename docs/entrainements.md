# Documentation Entrainements

## Objectif

Lister l'ensemble des créneaux d'entraînement avec leur catégorie, leurs horaires, leur salle et leurs encadrants.
Une fois listés dans ce document, un script maintiendra la page "entrainements.html" à jour.
Le script pourra être exécuté manuellement depuis Visual Studio Code.

## Template de génération HTML

```html
<article class="schedule-row accent-{{Accent}}">
    <div class="schedule-category">
        <span>{{Age}}</span>
        <h2>{{Label}}</h2>
        <span class="coach">{{Coach}}</span>
    </div>

    <div class="schedule-sessions">
        <div class="session">
            <div class="session-meta">
                <span class="icon icon--clock" aria-hidden="true"></span>
                <strong>{{Jour}}</strong>
            </div>
            <span>{{Horaire}}</span>
            <small>
                <div class="session-meta">
                    <span class="icon icon--pin" aria-hidden="true"></span>
                    {{Salle}}
                </div>
            </small>
        </div>
    </div>
</article>
```

On y retrouve les variables suivantes :

- Age : Tranche d'âge de la catégorie
- Label : Nom de la catégorie ou équipe
- Coach : Encadrants de la catégorie
- Accent : Couleur visuelle de la ligne (`cream`, `orange`, `blue`)
- Jour : Jour de la séance
- Horaire : Créneau horaire exact
- Salle : Nom de la salle

## Emplacement dans le document HTML cible

La liste des créneaux d'entraînement va être rendue dans la section ayant la classe `schedule-list`.

## Données

```json
{
  "rows": [
    {
      "age": "Né(e)s en 2020 - 2021 - Mixte",
      "label": "Baby & Mini-basket",
      "coach": "Entrainés par Pascal, Eric et Sade",
      "accent": "cream",
      "sessions": [
        { "day": "Mercredi", "time": "14h15 — 15h15", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    },
    {
      "age": "Nés en 2018 - 2019",
      "label": "U9M",
      "coach": "Entrainés par Anaëlle",
      "accent": "orange",
      "sessions": [
        { "day": "Lundi", "time": "17h00 — 18h15", "place": "Salle Jean Degros - Pecquencourt" },
        { "day": "Mercredi", "time": "15h15 — 16h30", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    },
    {
      "age": "Nées en 2018 - 2019",
      "label": "U9F",
      "coach": "Entrainées par Kornélia, Camille et Bastien",
      "accent": "blue",
      "sessions": [
        { "day": "Mercredi", "time": "18h00 — 19h30", "place": "Salle Jean Degros - Pecquencourt" },
        { "day": "Vendredi", "time": "17h00 — 18h15", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    },
    {
      "age": "Nées en 2016 - 2017",
      "label": "U11F",
      "coach": "Entrainées par Sébastien et Yoann",
      "accent": "cream",
      "sessions": [
        { "day": "Vendredi", "time": "17h30 — 19h00", "place": "Salle des sport - Montigny en Ostrevent" },
        { "day": "Mardi", "time": "17h00 — 19h15", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    },
    {
      "age": "Nés en 2016 - 2017",
      "label": "U11M",
      "coach": "Entrainés par Cédric et John",
      "accent": "orange",
      "sessions": [
        { "day": "Lundi", "time": "17h00 — 18h45", "place": "Salle des sport - Montigny en Ostrevent" },
        { "day": "Jeudi", "time": "17h00 — 19h15", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    },
    {
      "age": "Nés en 2014 - 2015",
      "label": "U13F",
      "coach": "Entrainées par Steeve et Gaëtan",
      "accent": "blue",
      "sessions": [
        { "day": "Vendredi", "time": "19h00 — 20h30", "place": "Salle des sport - Montigny en Ostrevent" },
        { "day": "Mercredi", "time": "16h30 — 18h00", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    },
    {
      "age": "Nés en 2014 - 2015",
      "label": "U13M",
      "coach": "Entrainés par Jimmy et Guillaume",
      "accent": "cream",
      "sessions": [
        { "day": "Mercredi", "time": "16h00 — 18h00", "place": "Salle d'Anchin" },
        { "day": "Vendredi", "time": "18h15 — 19h30", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    },
    {
      "age": "Nées en 2013 - 2014",
      "label": "U15F",
      "coach": "Entrainées par Anne Gaëlle et Manon",
      "accent": "orange",
      "sessions": [
        { "day": "Mercredi", "time": "16h30 — 18h00", "place": "Salle des sport - Montigny en Ostrevent" },
        { "day": "Vendredi", "time": "19h30 — 20h45", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    },
    {
      "age": "Nés en 2013 - 2014",
      "label": "U15M",
      "coach": "Entrainés par Ludovic et Aurélien",
      "accent": "blue",
      "sessions": [
        { "day": "Mercredi", "time": "18h00 — 20h00", "place": "Salle d'Anchin" },
        { "day": "Vendredi", "time": "20h30 — 22h00", "place": "Salle des sport - Montigny en Ostrevent" },
        { "day": "Lundi", "time": "18h15 — 20h30", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    },
    {
      "age": "Nées en 2009 - 2010 - 2011",
      "label": "U18F",
      "coach": "Entrainées par Manu et Elio",
      "accent": "cream",
      "sessions": [
        { "day": "Mercredi", "time": "20h00 — 21h15", "place": "Salle des sport - Montigny en Ostrevent" },
        { "day": "Vendredi", "time": "20h45 — 22h00", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    },
    {
      "age": "Nés en 2009 - 2010 - 2011",
      "label": "U18M",
      "coach": "Entrainés par Rémi",
      "accent": "orange",
      "sessions": [
        { "day": "Mardi", "time": "20h00 — 21h30", "place": "Salle d'Anchin" },
        { "day": "Mardi", "time": "20h00 — 22h30", "place": "Salle des sport - Montigny en Ostrevent" },
        { "day": "Mercredi", "time": "19h30 — 22h00", "place": "Salle Jean Degros - Pecquencourt" },
        { "day": "Jeudi", "time": "20h30 — 22h00", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    },
    {
      "age": "Nés en 2010 ou avant",
      "label": "Seniors 1 & 2",
      "coach": "Entrainés par Anthony, Thomas et Estelle",
      "accent": "blue",
      "sessions": [
        { "day": "Jeudi", "time": "20h30 — 22h30", "place": "Salle des sport - Montigny en Ostrevent" },
        { "day": "Mardi", "time": "20h30 — 22h00", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    },
    {
      "age": "Nés en 2010 ou avant",
      "label": "Loisirs Mixte",
      "coach": "Entrainés par Manon",
      "accent": "cream",
      "sessions": [
        { "day": "Mercredi", "time": "21h15 — 22h30", "place": "Salle des sport - Montigny en Ostrevent" },
        { "day": "Lundi", "time": "20h30 — 22h00", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    },
    {
      "age": "Nés en 2010 ou avant",
      "label": "Détente féminines",
      "coach": "Entrainées par Anaëlle",
      "accent": "cream",
      "sessions": [
        { "day": "Lundi", "time": "20h30 — 22h00", "place": "Salle Jean Degros - Pecquencourt" }
      ]
    }
  ]
}
```

## Ligne de commande d'execution

node "z:\Basket\ABP.WebSite\docs\generate-entrainements.js" "z:\Basket\ABP.WebSite\docs\entrainements.md" "z:\Basket\ABP.WebSite\pages\entrainements.html"