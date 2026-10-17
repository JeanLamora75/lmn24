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

La dernière commande doit être vide. Si `sudo -n` échoue, ajuster les droits de façon minimale **avant** le premier déploiement. Ne pas désactiver l'authentification SSH.

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

1. Refuse de continuer si les fichiers suivis ont été modifiés directement sur le VPS, si `.env` est absent ou si les services ne tournent pas.
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
