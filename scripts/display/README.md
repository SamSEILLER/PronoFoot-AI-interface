# Modules d'affichage

Modules JavaScript du site public. Ils consomment les données préparées par le moteur V2 et ne réalisent aucun calcul de pronostic ni appel fournisseur.

## Modules
- `matches.js` : liste et regroupement des matchs par date.
- `standings.js` : affichage des classements.
- `sidebar.js` : navigation et panneaux latéraux.
- `team-form.js` : série récente V/N/D d'une équipe.
- `team-history.js` : anciens résultats et scores.
- `match-details.js` : présentation détaillée d'une rencontre.
- `display-utils.js` : helpers DOM et formatage partagés.

Les contrats de données seront définis à partir des JSON réellement produits par le moteur avant toute implémentation fonctionnelle.

## Mode test — lecture seule

Le paramètre `?mode=test` active un parcours de démonstration strictement consultatif.

- Les matchs proviennent de `data/matches_test.json`.
- Les statistiques de buts saisonnières sont lues depuis `data/season-goals.json`, comme en production, afin de tester leur affichage dans l'onglet Analyse.
- Les classements et historiques utilisent leurs fichiers de démonstration dédiés.
- Les cotes restent désactivées.
- Le mode test ne doit effectuer aucune écriture, modification ou suppression dans les données historiques, les résultats passés ou les fichiers du moteur.
- Les décalages de date appliqués aux matchs de démonstration sont uniquement calculés en mémoire pour leur affichage ; ils ne sont jamais enregistrés dans les fichiers sources.

Toute évolution du mode test doit préserver cette règle de lecture seule.

## Analyse — en-têtes des statistiques de buts

- Les en-têtes des cartes des deux équipes reprennent le fond bleu foncé, la typographie blanche et le contraste des en-têtes de l'onglet « Vue d'ensemble ».
- Le compteur d'équipe est libellé « matchs joués » afin de le distinguer du nombre total de matchs de la compétition.
- Les dénominateurs des marchés restent affichés sous la forme « nombre de matchs concernés / matchs joués ».
- Aucun JSON historique ni résultat n'est modifié par cette présentation.

## Moyennes de buts par équipe

- Dans chaque carte équipe de l'onglet « Analyse & IA », deux indicateurs affichent les buts marqués par match et les buts encaissés par match.
- Les moyennes sont calculées à la volée à partir de `goals_for`, `goals_against` et `played` du fichier `data/season-goals.json`.
- Le périmètre reste strictement celui de la compétition et de la saison du match sélectionné.
- Si un total de buts est absent ou non numérique, la moyenne correspondante est affichée comme indisponible ; aucune valeur n'est remplacée par zéro.
- Cette évolution est uniquement de présentation et ne modifie aucun résultat historique ni fichier de données.

## Répartition des buts totaux par match — graphiques en anneau

- L'onglet « Analyse & IA » affiche un graphique Chart.js en anneau pour chacune des deux équipes.
- Les catégories sont calculées à partir des fréquences historiques cumulées : 0 but = joués − Over 0.5 ; 1 but = Over 0.5 − Over 1.5 ; 2 buts = Over 1.5 − Over 2.5 ; 3 buts et plus = Over 2.5.
- Les compteurs doivent être entiers, cohérents, monotones et partager le même dénominateur que les matchs joués. Sinon, le graphique est déclaré indisponible.
- Les nombres affichés dans la légende sont des comptes de matchs, pas des probabilités prédictives.
- Les données restent strictement limitées à la compétition et à la saison du match sélectionné.
- Le mode test reste en lecture seule ; aucun fichier historique ou résultat n'est modifié.
