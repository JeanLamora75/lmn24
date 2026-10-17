# LMN24 — Activation progressive du planificateur en production

## Livraison sans démarrage involontaire

Le merge et le deploiement ne lancent **aucun nouveau parser automatique** tant que les quatre lignes `scheduler_config.is_enabled` valent FALSE et que `SCHEDULER_ENABLED` n'est pas `true` dans l'environnement du **service parser**. Ce drapeau production est volontairement distinct de `SCHEDULER_EXPERIMENTAL_RUN`, qui est reserve aux tests hors production.

## Pré-requis OVH

1. Sauvegarder PostgreSQL et verifier la restauration du catalogue.
2. Appliquer les migrations existantes (foundations, job ownership, write fence) puis `20261017_scheduler_application_grants.sql` si les droits ne sont pas deja accordes. Ne pas relancer les anciennes migrations destructivement.
3. Verifier les trois services systemd, les migrations, les acces PostgreSQL du role `lmn24_app`, et la lecture/ecriture des parametres dans l'administration.
4. Dans la configuration systemd du **parser**, prevoir `SCHEDULER_ENABLED=true` puis redemarrer le service parser. **Ceci ne declenche rien tant que les lignes de configuration sont desactivees.** Ne jamais definir `PARSER_INFOS_CRON` ou `PARSER_VIDEOS_CRON` lorsque ce drapeau est actif: le demarrage echouera volontairement pour empecher deux mecanismes de planification.
5. Avant d'activer `HOROSCOPE_IMPORT`, definir le **meme** `SCHEDULER_INTERNAL_SECRET` d'au moins 32 caracteres sur backend et parser, et verifier que `SCHEDULER_BACKEND_URL` designe un backend en loopback. Ne pas publier le secret dans GitHub ni les logs.
6. Verification dans PostgreSQL: `SELECT parser_type,is_enabled,interval_minutes,local_time,next_due_at FROM scheduler_config ORDER BY parser_type;`

## Déploiement et validation

```bash
cd ~/lmn24
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
sudo systemctl restart lmn24-backend lmn24-frontend lmn24-parser
sudo systemctl is-active lmn24-backend lmn24-frontend lmn24-parser
curl -fsS http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:3002/health
```

Dans l'administration, verifier d'abord que les quatre boutons sont sur Off. Pour un pilote, activer **un seul parser** (meteo en premier si API stable), enregistrer, verifier la prochaine echeance et les logs du parser. Controle des jobs: `SELECT parser_type,status,scheduled_for,attempt,last_error FROM scheduler_job ORDER BY created_at DESC LIMIT 20;`. Les lanceurs manuels partagent le verrou global. Observer le premier cycle et les reprises avant d'activer les suivants.

## Arrêt d'urgence

Désactiver chaque interrupteur admin: la selection de nouveaux jobs est bloquee immediatement (un job deja lance continue normalement). Pour couper totalement les futurs ticks, retirer `SCHEDULER_ENABLED=true` du service parser et le redemarrer; cette operation peut interrompre un run courant, qui sera recupere par la logique d'ownership.

## Note sécurité

Les anciennes variables PARSER_*_CRON utilisent un systeme de planification distinct. Ne pas activer simultanement les deux systemes. Les statistiques horaires des hashtags sont un traitement separe et restent actives.


## Constat d'exploitation OVH du 17 octobre 2026

Le mode de mise en route décrit ci-dessus a été effectivement suivi sur le VPS : configuration `NODE_ENV=production`, `SCHEDULER_ENABLED=true`, `SCHEDULER_INTERNAL_SECRET` configuré sur le fichier `/home/ubuntu/lmn24/.env` lu par les services, et aucun ancien CRON Infos/Vidéos déclaré dans ce fichier. Le journal du parser confirme `Central scheduler enabled` en mode production. Quatre `scheduler_config.is_enabled=true` et échéances planifiées. **Ne pas interpréter cela comme la preuve d'exécutions métier déjà réussies.**

### Vérification après les premières échéances

```bash
sudo -u postgres psql -d lmn24 -c "
SELECT parser_type,status,attempt,
  scheduled_for AT TIME ZONE 'Europe/Paris' AS prevue_paris,
  started_at AT TIME ZONE 'Europe/Paris' AS debut_paris,
  finished_at AT TIME ZONE 'Europe/Paris' AS fin_paris,
  LEFT(last_error,160) AS erreur
FROM scheduler_job ORDER BY created_at DESC LIMIT 20;"

sudo -u postgres psql -d lmn24 -c "
SELECT parser_type,is_enabled,
 next_due_at AT TIME ZONE 'Europe/Paris' AS prochaine_paris,
 last_scheduled_at AT TIME ZONE 'Europe/Paris' AS derniere_paris
FROM scheduler_config ORDER BY parser_type;"

sudo journalctl -u lmn24-parser --since '2026-10-17 19:45:00' --no-pager -l \
  | grep -Ei 'scheduler|error|retry|lease|failed|lock'
```

Pour chaque parser, corréler un statut `SUCCESS` avec les logs et les tables métier (articles, vidéos, météo, horoscopes) ; contrôler aussi `PENDING`/`RUNNING` prolongés, `ERROR`/`INTERRUPTED`, les reprises et les éventuels blocages du verrou global. Priorité prévue : Horoscope > Infos > Vidéos > Météo. Les premières échéances simultanées Infos/Vidéos à 20h00 constituent le premier test d'arbitrage en production.
