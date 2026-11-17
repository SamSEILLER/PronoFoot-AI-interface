# PronoFoot AI — interface

Interface web publique du projet Football Prediction Lab. Elle présente les matchs à venir, les détails d'une rencontre et les classements.

## Pages

- `index.html` — matchs à venir et fiche détaillée.
- `classements.html` — classements.
- `composition.html` — historique des instantanés de compositions PitchAPI J-7/J-2/J-1.\n- `history.html` — historique des pronostics archivés et mesure de leur résultat.

## Données consommées

Les fichiers JSON sont publiés dans `data/` par le moteur V2 ou synchronisés depuis celui-ci :

- `matches_future.json` — calendrier futur.
- `standings.json` — classements.
- `season-goals.json` — statistiques descriptives par équipe, compétition et saison.
- `goal-predictions.json` — estimations pré-match des buts attendus (λ).
- `recent-form.json`, `head-to-head.json` — forme et confrontations historiques.
- `odds_latest.json` — dernier relevé des cotes Unibet ; peut légitimement contenir zéro événement.
- `site-status.json` — fraîcheur, couverture et état des collectes.
- `compositions.json` — instantanés PitchAPI, listes de titulaires/remplaçants lorsqu'elles sont fournies et statuts explicites des données indisponibles.

## Fiche match

La fiche est rendue par `scripts/display/matches.js`. Elle présente les buts attendus disponibles et des panneaux repliables, dont Composition d'équipe avec les instantanés PitchAPI J-7/J-2/J-1 associés au match. Les statistiques de saison sont descriptives et ne doivent pas être présentées comme des probabilités prédictives. Les cotes ne sont affichées que lorsqu'elles sont réellement présentes dans le JSON.

## État des sources

L'indicateur de statut résume l'état technique et la fraîcheur des collectes. Un statut global « OK » ne garantit ni la présence de cotes pour chaque match ni l'exhaustivité des données. Consulter le détail du statut pour distinguer collecte réussie, absence de fixtures et couverture partielle.

## Développement

- Les changements de l'interface sont publiés sur `main`.
- Les données sont générées par le dépôt moteur privé `SamSEILLER/PronoFoot-AI-V2`.
- Le workflow central du moteur publie les JSON nécessaires à l'interface (calendrier, classements, forme, confrontations, analyses, cotes, météo, compositions et statut) vers ce dépôt.
- Les tests du moteur ne remplacent pas un contrôle navigateur de l'interface.


## Disponibilités joueurs — parcours ChatGPT

- `player-availability.html` — page manuelle pour charger `pending.json`, copier le paquet de recherche, coller directement la réponse JSON de ChatGPT dans une zone de texte, la contrôler, puis copier le JSON validé dans `data/player-availability/completed.json` du dépôt public.
- `scripts/display/player-availability.js` — validation navigateur du JSON collé.
- La page ne stocke aucun jeton GitHub et ne pousse pas directement vers un dépôt. Après validation, le JSON est collé manuellement dans `data/player-availability/completed.json` du dépôt public. Après le commit, le workflow manuel `player-availability-import-public.yml` du moteur privé récupère le fichier, le valide, l'importe et historise les observations.
\n\n## Historique des pronostics\n\n- `history.html` et `scripts/display/history.js` affichent les pronostics archivés, les résultats finaux et le taux de réussite, avec filtres par compétition, période et statut.\n- `data/prediction-history.json` initialise le schéma public de l'archive. Il est volontairement vide tant que le moteur n'enregistre pas de snapshots pré-match immuables.\n- Un pronostic ne doit être évalué que si sa prévision horodatée avant le coup d'envoi et le score final sont tous deux disponibles. Les anciennes prévisions ne seront pas reconstituées à partir des données actuelles.\n