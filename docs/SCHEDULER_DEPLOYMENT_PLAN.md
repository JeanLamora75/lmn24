# LMN24 — Plan de mise en production du scheduler (non activé)

Date de préparation : 2026-10-17. Revue cumulative : PR #106, branche `release/scrum-scheduler-review-20261017`.

## Décision de sécurité et garde-fous

**NE PAS ACTIVER** les quatre déclencheurs tant que les validations de fencing métier et les tests intégrés n'ont pas abouti. La fusion du code désactivé est distincte de l'activation. Aucun script de ce document n'est à exécuter automatiquement.

1. Vérifier la CI du commit final de #106, avec les quatre jobs GitHub Actions en succès.
2. Auditer la mutation des données de chacun des quatre parsers face à la perte du verrou global et à une partition réseau. Un watchdog améliorant la détection n'est pas un fencing atomique des écritures.
3. Réaliser un test complet Infos/Vidéos/Météo/Horoscope en environnement isolé, incluant reprise sur échec, fichier Horoscope absent, limites des tentatives et concurrence manuel/automatique.
4. Vérifier que le scheduler expérimental reste éteint en production, que les paramètres en base sont `is_enabled=FALSE` et que l'API admin rejette l'activation.
5. Sur le VPS Ubuntu, sauvegarder la base et identifier une procédure de restauration **testée** avant les migrations. Confirmer l'emplacement, la version de PostgreSQL et les variables runtime sans copier les secrets dans un rapport.
6. Appliquer les migrations `database/migrations/20261017_scheduler_foundations.sql` puis `database/migrations/20261017_scheduler_job_ownership.sql` puis `database/migrations/20261017_parser_write_fence.sql` après sauvegarde, sur une fenêtre contrôlée ; vérifier leur exécution répétée et le statut de chaque ligne.
7. Déployer le code avec scheduler désactivé ; vérifier `/health`, journaux, temps de réponse des parsers manuels, création et lecture des données, et l'absence de régression.
8. En cas de régression : arrêter les nouveaux processus, revenir au binaire/commit précédent, **ne pas supprimer les tables scheduler à l'aveugle** ; restaurer la base uniquement après analyse de l'impact des écritures intervenues entre-temps.

## Pour une activation ultérieure (hors périmètre de la PR #106)

- Les scripts `20261017_parser_write_fence.sql` doivent être appliqués AVANT tout parser (même manuel) : l'acquisition de lease tourne désormais le jeton de propriété dans `parser_write_epoch`. En leur absence, l'acquisition échoue sans lancer l'extraction.
- La rotation de jeton prend le verrou transactionnel EXCLUSIF `(241024,86)` ; les écritures métiers vérifient le jeton sous verrou PARTAGÉ `(241024,86)` jusqu'au COMMIT. Une transaction en cours termine avant la rotation et une transaction de l'ancien propriétaire commencée ensuite est rejetée. Le backend PostgreSQL qui détient le verrou global `(241024,85)` est également vérifié.
- Implémenter un véritable mode production protégé, avec configuration explicite et migration/rollback vérifiés.
- Rendre les écritures métier sûres en cas de perte d'ownership, puis prouver ce point en test d'intégration.
- Supprimer ou neutraliser les cron historiques `PARSER_INFOS_CRON` et `PARSER_VIDEOS_CRON` pour éviter deux sources de planification.
- Activer un seul type de parser à la fois, observer logs et métriques, puis activer les suivants.
- Disposer de procédures d'arrêt d'urgence et de réinitialisation du job `RUNNING` orphelin, sans supprimer le contenu déjà importé.

## État des tests connu à la rédaction

- CI #605 : les jobs de schéma PostgreSQL et de verrou réel ont réussi ; Quality a échoué au lint `prefer-const` du watchdog.
- PR #105 corrige ce lint et traite le nettoyage du watchdog. La CI du nouveau commit reste à confirmer.
- La PR #106 est une revue cumulative ; ce document ne constitue ni une validation technique ni un feu vert d'exploitation.


---

## Addendum de clôture du déploiement technique — 17 octobre 2026

Les recommandations de sécurité « ne pas activer » ci-dessus décrivent **l'état de préparation initial**, avant les PR finales et les validations. Elles ne correspondent plus à l'état du VPS en fin de journée du 17 octobre.

- PR #109 : intégration des quatre moteurs, merge commit `7feb594a`.
- PR #110 : correction du faux conflit à l'enregistrement des paramètres admin (précision microsecondes PostgreSQL), merge commit `ed04c08`.
- PR #111 : interrupteurs d'activation individuelle, backend et activation production contrôlée, merge commit `332585b`.
- CI GitHub des PR #110/#111 validée ; compilation/typecheck sur OVH et santé des trois services confirmés.
- Sauvegarde avant migrations : `/var/backups/lmn24/lmn24-before-scheduler.dump` (9,8 Mo) ; le catalogue `pg_restore --list` a été vérifié, **pas un test de restauration intégrale**.
- Schémas et permissions PostgreSQL appliqués. Une erreur 500 due à `permission denied for table scheduler_config` a été corrigée par `GRANT` au rôle `lmn24_app`. Un faux conflit de mise à jour admin a été corrigé en PR #110.
- Variables OVH : `NODE_ENV=production`, `SCHEDULER_ENABLED=true`, secret partagé Horoscope configuré (ne pas publier sa valeur), anciens CRON absents du `.env` vérifié.
- Le 17/10 à 17:51:52 (heure affichée dans les logs serveur), le parser a journalisé `Central scheduler enabled` avec `production:true`. Trois services systemd actifs et endpoints santé répondant.
- À la dernière vérification, les quatre paramètres sont activés. Échéances Europe/Paris : Infos et Vidéos 17/10 20:00, Météo 17/10 22:00, Horoscope 18/10 06:15. `scheduler_job` encore vide avant ces échéances et aucune erreur scheduler affichée dans les logs fournis.

**Statut précis : déploiement technique et calcul des échéances confirmés ; exécution effective des parsers, concurrence, récupération et contrôles des données à valider à partir de 20h00, 22h00 et le lendemain à 06h15.** Guide à jour : `docs/SCHEDULER_PRODUCTION_ENABLEMENT.md` et compte rendu `docs/SCHEDULER_PRODUCTION_REPORT_20261017.md`.
