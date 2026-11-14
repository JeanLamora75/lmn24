# LMN24 — Google Analytics 4 / OVH

## Identifiants publics

- Measurement ID : `G-Z54C7T331W` (collecte Web, à intégrer séparément avec consentement).
- Property ID : `391719478` (Google Analytics Data API).

**La connexion Data API ne crée pas de collecte de visites.** Elle lit uniquement les statistiques de la propriété existante. Ne jamais publier de clé privée dans Git, un ticket Jira ou un message de chat.

## Prérequis Google

1. Google Cloud : Google Analytics Data API activée dans le projet du compte de service.
2. GA4 : adresse e-mail du compte de service ajoutée comme **Lecteur** à la propriété `391719478`.
3. Google Cloud : télécharger la clé JSON de ce compte de service. Le fichier est confidentiel.

## Déployer le code

Dans GitHub Actions, lancer `Deploy LMN24 to OVH (manual)` depuis `main` une fois la CI verte.

## Installer la configuration secrète sans utiliser de terminal

1. Ouvrir GitHub → dépôt LMN24 → Settings → Environments → **production** → Environment secrets.
2. Créer le secret **GA4_SERVICE_ACCOUNT_JSON** avec le contenu **complet** du fichier JSON téléchargé depuis Google Cloud (y compris accolades, guillemets et retours à la ligne). Ne pas partager ce contenu dans ChatGPT.
3. Ouvrir Actions → **Configure GA4 on OVH (manual)** → Run workflow sur `main`.
4. Le workflow utilise les clés SSH de déploiement existantes, transmet le secret dans un canal SSH, configure `/home/ubuntu/lmn24/.env` et redémarre uniquement le frontend. Il n'effectue aucune migration SQL.
5. Dans LMN24 → Administration → Statistiques du site → **Google Analytics**, vérifier les valeurs pour 7 et 30 jours.

Le déploiement normal ne réécrit pas cette configuration : elle reste dans le fichier privé `.env` du VPS.

## Variables d'environnement du frontend

- `GA4_PROPERTY_ID=391719478`
- `GA4_SERVICE_ACCOUNT_JSON_B64=<base64 du JSON de compte de service>`

Le script d'installation produit ces variables automatiquement. Ne pas exposer la seconde variable sous `NEXT_PUBLIC_*`. Le frontend charge `.env` au démarrage via son lanceur Node.

## Sécurité / limites

- La route `/api/admin/statistics/google-analytics` exige une session administrateur valide et n'accepte que les périodes 7 ou 30 jours.
- Le serveur échange un JWT signé contre un jeton Google de courte durée. Aucun secret n'est retourné au navigateur ni enregistré dans PostgreSQL.
- Les données GA4 peuvent être vides au début si le marquage Web/consentement n'est pas encore installé.
- La collecte GA4 sur les pages publiques et le mécanisme de consentement font l'objet d'une intégration distincte.
- En cas de `GA4_AUTH_FAILED`, vérifier la validité de la clé. En cas de `GA4_REPORT_FAILED`, vérifier l'API activée et le rôle Lecteur sur la bonne propriété.
