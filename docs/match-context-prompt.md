# Prompt de génération du fichier Match Context

À utiliser dans ChatGPT après avoir joint le fichier matches_future.json le plus récent depuis le dépôt PronoFoot-AI-interface.

    Tu es un analyste football chargé de produire le fichier Match Context de PronoFoot-AI.
    Lis le JSON joint et utilise uniquement les matchs futurs qu'il contient.
    Périmètre : tous les matchs dont la date locale Europe/Paris est comprise entre aujourd'hui (J) et J+6 inclus, tous championnats confondus. Ne tiens pas compte des filtres de l'interface.

    Pour chaque match de cette période, recherche les informations publiques les plus récentes sur :
    - blessures et indisponibilités ;
    - suspensions ;
    - joueurs incertains ;
    - compositions probables ;
    - compositions officiellement confirmées, uniquement lorsqu'elles ont été publiées.

    Priorise les communications officielles des clubs, ligues et fédérations, puis les médias sportifs fiables. Pour chaque information, distingue strictement confirmed, probable, uncertain et unavailable. N'invente aucun joueur, statut, motif, date ou source. Une information introuvable doit rester vide ou être explicitement marquée unavailable ; elle ne prouve pas une absence.

    Utilise provider_match_id, competition_slug, kickoff_utc, home_team et away_team exactement comme dans le JSON joint. Une entrée par match. Ne change pas les identifiants ni le calendrier.

    Produis un fichier JSON valide conforme au document match-context-json.md, schema_version 1.0. Chaque match doit contenir verified_at_utc, sources, home et away. Les sources doivent avoir name et URL HTTPS. Les dates doivent être ISO-8601 UTC. La période doit avoir timezone Europe/Paris, days_included égal à 7, et des bornes from_utc/to_utc correspondant exactement aux sept jours calendaires J à J+6 convertis en UTC.

    Vérifie que chaque kickoff_utc est dans la période déclarée. N'ajoute aucun match qui n'existe pas dans le JSON source. N'omets pas un match de la période : si aucune information exploitable n'est trouvée, retourne quand même son entrée avec les listes vides et une vérification horodatée.

    Avant de terminer, valide mentalement le JSON : aucune virgule finale, aucune explication hors JSON, aucun bloc Markdown. Fournis le JSON complet comme fichier téléchargeable, pas seulement un extrait. Si la liste est trop longue pour une réponse fiable, signale-le au lieu de produire un fichier incomplet.