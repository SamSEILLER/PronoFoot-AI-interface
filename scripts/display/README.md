# Modules d'affichage

Les modules JavaScript consomment les JSON publiés par le moteur V2. Ils assurent le rendu navigateur et ne réalisent aucune collecte fournisseur.

| Fichier | Rôle | État |
|---|---|---|
| `matches.js` | Calendrier, filtres, fiche match, analyses, cotes et météo | Actif sur `index.html` |
| `sidebar.js` | Navigation et panneau d'état des sources | Actif sur les pages HTML |
| `chartjs-loader.js` | Chargement différé de Chart.js | Actif sur `index.html` |

Les anciens fichiers de maquette et les modules d'affichage vides/non référencés ont été supprimés. Toute nouvelle fonctionnalité doit être intégrée à un module réellement chargé par une page, ou faire l'objet d'un point d'entrée explicitement référencé.

## Fiche match — état actuel

La fiche principale est construite dans `matches.js`. Elle présente les panneaux repliables Vue d'ensemble, Analyse & IA, Cotes et Météo lorsque les données correspondantes sont disponibles.

## Règles de présentation

- Afficher le nombre de matchs utilisés avec chaque fréquence.
- Les marchés Over/Under portent sur le total de buts du match.
- Les moyennes et fréquences de saison sont des statistiques historiques, pas des probabilités prédictives.
- Les λ sont des estimations du modèle et doivent rester identifiés comme tels.
- Une cote n'est affichée que si elle existe réellement dans le JSON.
- Un champ manquant ou incohérent reste indisponible ; ne jamais le remplacer arbitrairement par zéro.
- L'état de la météo doit distinguer prévision disponible, absence de prévision et erreur de collecte.
