# Modules d'affichage

Les modules JavaScript consomment les JSON préparés par le moteur V2. Ils assurent le rendu côté navigateur ; ils ne réalisent aucune collecte auprès des fournisseurs.

| Fichier | Rôle |
|---|---|
| `matches.js` | Liste des matchs, filtres et fiche détaillée |
| `standings.js` | Affichage des classements |
| `sidebar.js` | Navigation et panneaux latéraux |
| `team-form.js` | Forme récente |
| `team-history.js` | Historique d'une équipe |
| `match-details.js` | Module de détail séparé (à vérifier avant extension) |
| `display-utils.js` | Fonctions utilitaires partagées |

## Fiche match — état actuel

La fiche principale est construite dans `matches.js` et comporte trois accordéons :
- **Vue d'ensemble** : historique récent et confrontations.
- **Analyse & IA** : statistiques descriptives de saison et indicateurs de buts ; les λ sont affichés séparément lorsqu'ils sont disponibles.
- **Cotes** : données du dernier snapshot Unibet ; aucune cote n'est fabriquée en cas d'absence.

Les accordéons sont fermés par défaut. Leur en-tête utilise le thème bleu et le chevron est centré verticalement.

## Règles de présentation des statistiques

- Toujours afficher le nombre de matchs utilisés avec une fréquence.
- Les marchés Over/Under portent sur le total de buts du match, pas sur les buts marqués par une seule équipe.
- Les moyennes de buts marqués/encaissés et les répartitions domicile/extérieur sont des statistiques historiques.
- Un champ manquant ou incohérent est affiché comme indisponible, jamais remplacé arbitrairement par zéro.
- Une fréquence historique n'est pas une probabilité prédictive.

