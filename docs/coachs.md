# Documentation Coachs

## Objectif

Lister l'ensemble des coachs avec leurs informations respectives.
Une fois lister dans ce document, on se servira d'un script qui maintiendra la page "coachs.html" à jour.
Ce script va s'éxécuter depuis Visual Studio Code à la demande de l'utilisateur.

## Template de génération HTML

```html

<article class="coach-card">
    <div class="coach-portrait">
        <span>{{Initiales}}</span>
        <img src="{{Image}}"></img>
    </div>
    <div class="coach-info">
        <span class="coach-role">{{Role}}</span>
        <h2>{{Nom}}</h2>
        <div class="coach-detail">
            <div class="session-meta">
                <span class="icon icon--diplome" aria-hidden="true"></span>
                <small>Diplôme {{Diplome}}</small>
                <img src="{{ImageDiplome}}"></img>
            </div>
        </div>
        <div class="coach-detail">
            <div class="session-meta">
                <span class="icon icon--specification" aria-hidden="true"></span>
                <small>Spécialité</small>
                {{Specification}}
            </div>
        </div>
    </div>
</article>

```

On y retrouve les variables suivantes :

- Nom : Reprend le prénom (en case pascale) et le nom (en majuscules)
- Initiales : Reprend en majuscules la premiere lettre du prenom et du nom
- Role : Reprend le role du coach
- Diplome : Le nom du diplome si le coach en possede un. Si ce n'est pas le cas, tout le div "coach-detail" encapsulant doit etre masqué
- ImageDiplome : l'image du diplome si le coach en possede un. Si ce n'est pas le cas, tout le div "coach-detail" encapsulant doit etre masqué
- Specification : Le nom du diplome si le coach en possede un. Si ce n'est pas le cas, tout le div "coach-detail" encapsulant doit etre masqué
- Image : Si une url d'image est spécifiée, reprendre cette url

## Emplacement dans le document HTML cible

La liste des coachs va etre rendu dans la section ayant la classe "coaches-grid"


## Execution 

Avant toute génération, on va vider completement l'emplacement dans le document HTML.
On lit les données du tableau ci dessous.
Et pour chaque ligne, on va générer de l'HTML (en suivant le template et les regles ci dessus)

Le script dooit etre écrit en javascript pour faciliter sa maintenance.
Le script sera executé manuellement par l'utilisateur.


## Données

| Nom | Prenom | Role | Diplome | ImageDiplome|  Specification | Image |
|-|-|-|-|-|-|
|Dorchy|Pascal|Coach U7| | | Président | /ressources/Coachs/Pascal Dorchy.JPG|
|Aded|Sade|Coach U7| | | | |
|Cartigny|Eric|Coach U7| | | | |
|Becq|Anaelle|Coach U9M| | | | |
|Chauffaud|Kornelia|Coach U9F| | | | |
|Vue|Camille|Coach U9F| | | | |
|Chausson|Bastien|Coach U9F| | | | |
|Vue|Yoann|Coach U11F| | | | /ressources/Coachs/Yoann.JPG|
|Marfil|Sébastien|Coach U11F| | | ||
|Labre|Cedric|Coach U11M| BF |/ressources/Coachs/BF Cedric.jpg | ||
|Sede|John|Coach U11F| | | ||
|Dorchy|Steeve|Coach U13F| CS 1 |/ressources/Coachs/Diplome Steeve.jpeg | Responsable Secteur Feminin| /ressources/Coachs/Steeve Dorchy.JPG|
|Hayez|Gaëtan|Coach U13F| | | |/ressources/Coachs/Gaetan.JPG|
|Routier|Jimmy|Coach U13M| | | ||
|Leleu|Guillaume|Coach U13M| | | |/ressources/Coachs/Guillaume.JPG|
|Oudhof|Anne Gaëlle|Coach U15F| | | |/ressources/Coachs/Anne Gaelle.JPG|
|Dalla Costa|Manon|Coach U15F & Loisirs| BF|/ressources/Coachs/Bf Manon.jpg | |/ressources/Coachs/Manon.JPEG|
|Mascart|Ludovic|Coach U15M|BF |/ressources/Coachs/BF Ludovic.jpg | ||
|Dziadek|Aurélien|Coach U15M|||||
|Chauffaud|Manu|Coach U18F||||/ressources/Coachs/Manu.JPG|
|Degardin|Elio|Coach U18F|||||
|Dechappe|Remy|Coach U18F||||/ressources/Coachs/remy dechappe.JPG|
|Blandin|Anthony|Coach Seniors|||||
|Daniel|Thomas|Coach Seniors|BF|/ressources/Coachs/BF Thomas.jpg|Responsable Secteur Masculin||
|Halluin|Estelle|Coach Seniors|||||
|Rogala|Emilien|Directeur technique|||||

## Ligne de commande d'execution

node "z:\Basket\ABP.WebSite\docs\generate-coachs.js" "z:\Basket\ABP.WebSite\docs\coachs.md" "z:\Basket\ABP.WebSite\pages\coachs.html"