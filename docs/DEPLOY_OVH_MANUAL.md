# LMN24 — Déploiement manuel sur OVHcloud

## Principe

- Le développement se fait sur une branche dédiée ; tester localement sur Windows 11.
- Après validation, fusionner la pull request dans `main`.
- La fusion ne déploie **jamais** automatiquement : seul le workflow GitHub Actions **Deploy LMN24 to OVH (manual)** (`workflow_dispatch`) peut déclencher un déploiement.
- Choisir impérativement la branche `main` dans l'interface Actions.
- Le workflow exécute typecheck, lint, tests et build AVANT SSH.
- Le script côté VPS déploie **le SHA exact** demandé, après une sauvegarde de précaution.
- Aucun `prisma migrate deploy`, `prisma migrate dev`, import SQL ou seed n'est exécuté automatiquement en production.
- La sauvegarde quotidienne locale existe indépendamment de GitHub ; la copie hors VPS reste à configurer.

## Prérequis sur le VPS

La version actuelle fonctionne déjà depuis `/home/ubuntu/lmn24` avec :

- les services `lmn24-backend.service`, `lmn24-parser.service` et `lmn24-frontend.service` ;
- `/home/ubuntu/lmn24/.env` présent, non versionné ;
- `pnpm`, `node`, `git` et `curl` disponibles dans la session SSH non interactive ;
- le service `lmn24-backup.service` fonctionnel ; l'utilisateur `ubuntu` peut exécuter ses démarrages et les redémarrages des trois services via `sudo -n` ;
- l'accès SSH du VPS sur le port 22.

**Vérifier avant d'activer :**

```bash
cd /home/ubuntu/lmn24
sudo -n /usr/bin/systemctl is-active --quiet lmn24-backend.service
sudo -n /usr/bin/systemctl is-active --quiet lmn24-parser.service
sudo -n /usr/bin/systemctl is-active --quiet lmn24-frontend.service
sudo -n /usr/bin/systemctl start lmn24-backup.service
command -v pnpm
command -v node
git status --porcelain --untracked-files=no
```

La dernière commande doit normalement être vide. Le seul écart accepté par le script est une modification **non indexée** de `apps/frontend/next-env.d.ts`, fichier généré par Next.js ; le script restaure alors uniquement ce fichier avant le changement de version. Examiner tout autre écart avant déploiement. Si `sudo -n` échoue, ajuster les droits de façon minimale **avant** le premier déploiement. Vérifier les autorisations sans cache avec `sudo -k` suivi de `sudo -n /usr/bin/systemctl is-active lmn24-backend.service`. Ne pas désactiver l'authentification SSH.

## Prérequis complémentaires : captures, RSS et médias

Ces prérequis ont été validés sur le VPS Ubuntu 24.04 en octobre 2026. Ils relèvent de la **préparation ou reconstruction d'un VPS**, et non du déploiement GitHub Actions habituel. Les opérations qui utilisent `sudo` supposent les droits système correspondants.

### Capture de sites : Chromium et Playwright

Le bouton **Administration > Sources > Capturer image** et la découverte automatique de certains liens sociaux lancent Chromium depuis le **backend** avec Playwright. Sur un Ubuntu minimal, il faut installer à la fois le navigateur et ses dépendances système :

```bash
systemctl show lmn24-backend.service -p User
cd /home/ubuntu/lmn24
pnpm --filter @lmn24/backend exec playwright install chromium
pnpm --filter @lmn24/backend exec playwright install-deps chromium
```

- `playwright install chromium` télécharge le navigateur dans le cache du **compte exécutant la commande** (sur le VPS documenté : `/home/ubuntu/.cache/ms-playwright/`). Vérifier que le service backend utilise ce même compte ou qu'il accède au navigateur installé.
- `playwright install-deps chromium` installe les bibliothèques Linux via le gestionnaire de paquets (`apt`), avec les privilèges requis. À faire lors du provisionnement ou d'une maintenance autorisée.
- Les mises à jour du code ne nécessitent **normalement pas** de réinstaller ces bibliothèques, mais une mise à jour majeure de Playwright peut exiger un nouveau navigateur.

Tester le lancement local, sans modifier PostgreSQL :

```bash
cd /home/ubuntu/lmn24
pnpm --filter @lmn24/backend exec node -e '
const { chromium } = require("playwright");
chromium.launch({ headless: true })
  .then(async browser => {
    console.log("Chromium fonctionne correctement !");
    await browser.close();
  })
  .catch(error => { console.error(error.message); process.exitCode = 1; });
'
```

En cas de `libatk-1.0.so.0: cannot open shared object file` (ou autre bibliothèque `.so` manquante), installer les **dépendances Linux**, pas seulement Chromium. Si le test CLI réussit mais pas l'administration, vérifier l'utilisateur systemd et la configuration facultative `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

**Diagnostic HTTP :** un `POST /admin/sources/capture` sans cookie retourne normalement **401** : la route existe, mais cela **ne valide pas** le lancement du navigateur. Une réponse **503** avec le message `Chrome/Chromium n’est pas disponible pour la capture.` correspond à un navigateur absent ou incapable de démarrer.

Documentation : [Playwright — installation des navigateurs et dépendances](https://playwright.dev/docs/browsers).

### Administration météo : origine publique derrière le reverse proxy

Les routes d'écriture pour les villes météo et le lancement du parser Météo protègent les requêtes contre les origines externes (contrôle CSRF). Sur OVH, le navigateur utilise `https://www.lmn24.com`, tandis que Next.js peut voir son URL interne `http://127.0.0.1:3000` derrière le reverse proxy.

**Symptôme :** le bouton « Lancer le Parser Météo » renvoie HTTP **403** avec `{"message":"Origine non autorisée."}`, y compris sans session lorsque l'en-tête `Origin: https://www.lmn24.com` est envoyé.

Sur le VPS, renseigner l'origine publique exacte dans **`/home/ubuntu/lmn24/.env`** (ne jamais publier le fichier complet) :

```dotenv
WEATHER_ADMIN_PUBLIC_ORIGIN=https://www.lmn24.com
```

L'option doit contenir une **origine** complète (schéma + hôte et éventuellement port), sans chemin, identifiants, query string ou fragment. Ne pas utiliser `*` ni des domaines génériques. En développement local, cette variable peut rester vide : la route accepte alors seulement l'origine correspondant à l'URL reçue par Next.js.

Cette configuration est lue par **le frontend Next.js** au lancement. Après avoir fusionné le correctif applicatif, effectuer un déploiement manuel GitHub Actions sur `main` ; le workflow reconstruit et redémarre le frontend. Pour une modification ultérieure de cette seule variable, redémarrer le frontend après avoir vérifié l'absence d'opération critique :

```bash
sudo systemctl restart lmn24-frontend.service
```

Test non authentifié **sans démarrer le parser** :

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -X POST https://www.lmn24.com/api/admin/parser/weather-runs \
  -H "Origin: https://www.lmn24.com" \
  -H "Sec-Fetch-Site: same-origin" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Attendu après correction : **HTTP 401**, car le contrôle d'origine passe mais aucune session n'est fournie. Si le résultat reste **403**, vérifier la présence de la variable dans `.env`, le redémarrage du frontend et le SHA déployé. **Ne pas désactiver le contrôle d'origine pour corriger le problème.** Une fois le test à 401, relancer le parser Météo depuis une session administrateur authentifiée et contrôler l'historique d'exécution.

### Flux RSS : préférence IPv4 limitée au service parser

Depuis le VPS OVH, le flux `https://www.7sur7.be/sciences/rss.xml` a répondu **HTTP 200 en IPv4** et **HTTP 403 en IPv6**, à en-têtes équivalents ; le test Node.js `fetch` avec une préférence IPv4 a également répondu **200**. Cela identifie un écart lié au chemin réseau pour **ce flux**, pas une cause universelle des erreurs HTTP 403.

Pour diagnostiquer un flux en échec, comparer IPv4 et IPv6 :

```bash
URL="https://www.7sur7.be/sciences/rss.xml"
for family in -4 -6; do
  curl "$family" -sS -L --max-time 15 -o /dev/null \
    -w "HTTP %{http_code} | IP %{remote_ip}\n" \
    -H "User-Agent: LMN24 RSS/XML Parser" \
    -H "Accept: application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8" \
    "$URL"
done
```

Si IPv4 fonctionne, confirmer avec le même client HTTP que LMN24 :

```bash
cd /home/ubuntu/lmn24
node --dns-result-order=ipv4first -e '
fetch("https://www.7sur7.be/sciences/rss.xml", {
  headers: {
    "user-agent": "LMN24 RSS/XML Parser",
    "accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8"
  },
  signal: AbortSignal.timeout(15000)
})
.then(response => console.log("HTTP", response.status))
.catch(error => { console.error(error); process.exitCode = 1; });
'
```

Si le test est concluant, configurer **uniquement le service systemd du parser** avec une surcharge persistante, plutôt que désactiver IPv6 globalement :

```bash
sudo mkdir -p /etc/systemd/system/lmn24-parser.service.d
printf '[Service]\nEnvironment="NODE_OPTIONS=--dns-result-order=ipv4first"\n' \
  | sudo tee /etc/systemd/system/lmn24-parser.service.d/90-ipv4.conf
sudo systemctl daemon-reload
```

**Attendre la fin de toute extraction en cours**, puis :

```bash
sudo systemctl restart lmn24-parser.service
systemctl is-active lmn24-parser.service
systemctl show lmn24-parser.service -p Environment \
  | grep -o -- '--dns-result-order=ipv4first'
```

Attendu : `active` puis `--dns-result-order=ipv4first`. Tester ensuite le flux dans l'administration. La préférence IPv4 **n'interdit pas IPv6** ; elle s'applique à tout le processus `lmn24-parser.service` (Infos et Vidéos). Le fichier `/etc/systemd/system/lmn24-parser.service.d/90-ipv4.conf` est conservé entre les déploiements, mais doit être **recréé sur un nouveau VPS**. Pour l'annuler, retirer uniquement cette surcharge, faire `daemon-reload` et redémarrer le service hors extraction.

Ne pas multiplier les tentatives sur des sites qui bloquent volontairement les robots. Un `403` sur les deux protocoles peut exiger une autre URL RSS officielle ou l'abandon du flux ; un `429` appelle une temporisation respectant `Retry-After`.

Documentation : [Node.js — ordre de résolution DNS](https://nodejs.org/api/cli.html#--dns-result-orderorder).

### Stockage persistant des logos et captures

Le backend lit et écrit les images de sources dans le répertoire configuré par `SOURCE_MEDIA_DIR`. Sur ce VPS :

```dotenv
SOURCE_MEDIA_DIR=/home/ubuntu/lmn24-data/uploads/sources
```

La variable se trouve dans `/home/ubuntu/lmn24/.env`, **non versionné et confidentiel**. Le dossier média est **hors du dépôt Git** ; les images ne sont donc ni sauvegardées par GitHub ni transférées par GitHub Actions. Ne pas stocker les originaux dans `node_modules`, un cache ou un dossier de build.

Contrôles :

```bash
grep '^SOURCE_MEDIA_DIR=' /home/ubuntu/lmn24/.env
find /home/ubuntu/lmn24-data/uploads/sources -maxdepth 1 -type f \
  \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) \
  | wc -l
systemctl show lmn24-backend.service -p User
```

Les colonnes `source.logo_url` peuvent référencer des chemins `/source-media/<uuid>.png` (ou JPG/WebP). Lors d'une migration, copier les fichiers en **conservant les noms exacts**, sans écraser aveuglément les médias déjà présents. En octobre 2026, 151 images ont été copiées sur OVH depuis le poste local ; ce nombre n'est qu'un repère historique, à revérifier.

**Sauvegarde :** une sauvegarde PostgreSQL ne protège **pas** ces fichiers. Vérifier explicitement que le service de sauvegarde inclut ce répertoire, tester une restauration et prévoir une copie **hors du VPS** ; ne pas supposer que le simple succès de `lmn24-backup.service` garantit les médias.

### Contrôles fonctionnels après reconstruction

- Backend : `curl -fsS http://127.0.0.1:3001/health`.
- Parser : `curl -fsS http://127.0.0.1:3002/health`.
- Frontend : `curl -fsS http://127.0.0.1:3000/fr > /dev/null`.
- Capture : tester Chromium en CLI, puis réaliser une capture réelle depuis une session d'administration.
- RSS : comparer les résultats IPv4/IPv6 d'un flux en erreur, puis lancer un petit périmètre du parser Infos.
- Médias : vérifier qu'un logo importé s'affiche sur une page publique.
- Journaux : `journalctl -u lmn24-backend -u lmn24-parser -n 150 --no-pager`.

Les *health checks* du déploiement ne testent ni le lancement réel de Chromium ni les flux externes. **Ne jamais publier les secrets du fichier `.env`, ni des cookies ou clés SSH privées.**


## 1. Créer une clé SSH dédiée aux déploiements

Sur le VPS, dans la session de `ubuntu` :

```bash
umask 077
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
ssh-keygen -t ed25519 -f "$HOME/.ssh/lmn24_github_actions" -N "" -C "lmn24-github-actions"
cat "$HOME/.ssh/lmn24_github_actions.pub" >> "$HOME/.ssh/authorized_keys"
chmod 600 "$HOME/.ssh/authorized_keys"
```

La **clé privée** `~/.ssh/lmn24_github_actions` est destinée uniquement au secret GitHub. Ne jamais l'ajouter au dépôt, au chat ou à un ticket. Après la configuration et un premier déploiement réussi, sa copie privée côté VPS peut être supprimée : la clé publique reste dans `authorized_keys`.

Afficher la clé privée uniquement dans **ton terminal**, puis la coller directement dans le formulaire GitHub (sans la communiquer à quiconque) :

```bash
cat "$HOME/.ssh/lmn24_github_actions"
```

Dans le dépôt GitHub : **Settings → Secrets and variables → Actions → New repository secret**.

Créer le secret `LMN24_DEPLOY_SSH_KEY` contenant la clé privée entière, avec ses lignes `BEGIN` et `END`.

## 2. Épingler l'empreinte du serveur SSH

La clé du serveur doit provenir directement du VPS déjà authentifié, et **non** d'un `ssh-keyscan` aveugle depuis le runner.

Sur le VPS :

```bash
printf '57.128.190.216 '
sudo awk '{print $1, $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

Copier la ligne produite, qui commence par `57.128.190.216 ssh-ed25519`, dans un second secret GitHub :

`LMN24_DEPLOY_KNOWN_HOSTS`

La valeur n'est pas une clé privée. Elle permet de vérifier que GitHub Actions contacte bien ton VPS et pas un serveur tiers.

## 3. Vérifier l'environnement GitHub

- Les deux secrets doivent être créés dans le dépôt `JeanLamora75/lmn24`.
- Facultatif : dans **Settings → Environments**, configurer `production` avec des règles d'approbation lorsque disponibles pour le dépôt et le plan. Le déclenchement du workflow reste manuel même sans cette protection.
- Le workflow n'accepte que `main`; déclencher depuis une autre branche ne déploie rien.
- Dans **Actions**, sélectionner **Deploy LMN24 to OVH (manual)** → **Run workflow** → branche `main` → **Run workflow**.
- Contrôler les logs des jobs `validate` puis `deploy`, et tester `https://www.lmn24.com/fr` et `https://api.lmn24.com/health`.

**Ne pas lancer avant la fin des vérifications SSH, la fusion de la Pull Request et une validation fonctionnelle sur le PC.**

## 4. Cycle de travail habituel

```powershell
# Sur Windows, dans le dossier LMN24 :
git fetch origin
git switch nom-de-la-branche-fonctionnelle
pnpm install --frozen-lockfile
pnpm dev
```

Tester les fonctionnalités. En cas de retour ou d'anomalie, corriger la même branche. Après validation, fusionner dans `main`.

```powershell
git switch main
git pull --ff-only origin main
```

Le site OVH conserve sa version précédente jusqu'au clic explicite sur **Run workflow**.

## 5. Comportement et limites du déploiement

Sur le VPS, le script `scripts/deploy-production.sh` :

1. Refuse de continuer si les fichiers suivis ont été modifiés directement sur le VPS (à l'exception de `apps/frontend/next-env.d.ts` généré et non indexé, restauré explicitement), si `.env` est absent ou si les services ne tournent pas.
2. Vérifie que le SHA demandé appartient à l'historique de `origin/main`.
3. Déclenche le service de sauvegarde local `lmn24-backup.service`.
4. Place le dépôt sur ce commit exact en mode `detached HEAD`, sans supprimer les fichiers ignorés.
5. Lance `pnpm install --frozen-lockfile` et `node --env-file=.env --run build` afin d'injecter aussi `NEXT_PUBLIC_BACKEND_URL` dans le build Next.js.
6. Redémarre backend, parser et frontend.
7. Vérifie en local leurs endpoints `/health` et `/fr`.
8. En cas d'échec après changement de commit, tente de recompiler et de redémarrer la version précédente. Le workflow reste en erreur et nécessite un contrôle humain.

**Limites importantes :** cette stratégie reconstruit sur le répertoire actif, ce qui peut entraîner une brève indisponibilité. Le rollback du **code** est une tentative et ne restaure pas la base ni ses données. Les modifications de schéma PostgreSQL nécessitent une opération manuelle, sauvegardée et testée, avant tout déploiement dépendant de ce schéma. La sauvegarde pré-déploiement reste locale au VPS jusqu'à mise en place d'une copie externe.

Le SHA réellement présent côté VPS est disponible via :

```bash
cd ~/lmn24
git rev-parse HEAD
sudo systemctl status lmn24-backend lmn24-parser lmn24-frontend --no-pager
```

## 6. Dépannage

- **Permission denied (publickey)** : vérifier les secrets, `authorized_keys` et les permissions du dossier SSH.
- **Host key verification failed** : revoir `LMN24_DEPLOY_KNOWN_HOSTS` depuis la console VPS authentifiée.
- **sudo: a password is required** : `sudo -n` doit fonctionner sans interaction, pour les seules opérations nécessaires au déploiement.
- **Dirty working tree** : vérifier `git status` sur le VPS ; ne pas utiliser `git reset --hard` sans examiner les fichiers modifiés.
- **Health checks failed** : `journalctl -u lmn24-backend -u lmn24-parser -u lmn24-frontend -n 150 --no-pager`.
- **Échec des sauvegardes** : `journalctl -u lmn24-backup.service -n 100 --no-pager`.

Ne jamais transmettre dans le chat le contenu du fichier `.env`, la clé SSH privée ou les mots de passe.
