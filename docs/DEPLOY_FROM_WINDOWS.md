# Déployer LMN24 sur OVHcloud depuis Windows, sans navigateur

Ce fonctionnement conserve la validation manuelle et le workflow existant : **GitHub Desktop** sert à récupérer, tester et publier le code ; **GitHub CLI** déclenche le déploiement une fois la version locale approuvée.

Aucun push GitHub Desktop, aucune fusion dans `main` et aucun lancement du vérificateur ne déclenchent un déploiement.

## Installer les prérequis une seule fois

Sur Windows 11 :

- GitHub Desktop et le dépôt `JeanLamora75/lmn24` cloné, déjà fonctionnels.
- `git.exe` accessible depuis PowerShell. GitHub Desktop possède son propre Git, qui n'est pas toujours accessible depuis les scripts PowerShell. Si la commande `git --version` échoue, installer **Git for Windows** ou l'ajouter au `PATH` utilisateur.
- GitHub CLI (`gh.exe`) accessible dans PowerShell. Pour l'installer via Windows Package Manager, si autorisé par l'entreprise :

  ```powershell
  winget install --id GitHub.cli --exact
  ```

  Redémarrer PowerShell puis vérifier :

  ```powershell
  gh --version
  gh auth login
  gh auth status
  ```

  Dans `gh auth login`, utiliser `GitHub.com`, `HTTPS` et l'authentification par navigateur proposée, avec le compte autorisé à lancer les Actions dans le dépôt. **Ne coller aucun jeton ni mot de passe dans les scripts LMN24.**

- GitHub Actions doit être activé pour le dépôt. Les secrets SSH `LMN24_DEPLOY_SSH_KEY` et `LMN24_DEPLOY_KNOWN_HOSTS` sont déjà configurés sur GitHub : ne pas les copier sur le PC.

Une politique de sécurité d'entreprise peut interdire l'exécution des scripts PowerShell. Le fichier `.cmd` lance PowerShell avec `-ExecutionPolicy Bypass` uniquement pour ce processus ; il ne contourne pas les restrictions imposées par une stratégie de groupe. Si l'exécution est bloquée, demander une méthode autorisée à l'administrateur.

## 1. Tester les prérequis sans rien déployer

Dans GitHub Desktop :

1. Sélectionner le dépôt **lmn24**.
2. Cliquer sur **Fetch origin**.
3. Sélectionner la branche fonctionnelle à tester.
4. Dans **Repository → Show in Explorer**, ouvrir le dossier du dépôt.
5. Double-cliquer **`Verifier-Deploiement-LMN24.cmd`**.

Cette action vérifie Git, GitHub CLI, l'authentification et l'accès à la branche distante `main`. Elle peut être lancée depuis la branche de développement, et **ne déclenche aucun workflow**.

## 2. Continuer à tester localement

Sur la branche de développement, démarrer LMN24 comme d'habitude (`pnpm dev`) et effectuer les tests fonctionnels.

Lorsque la fonctionnalité est acceptée :

1. Fusionner sa Pull Request dans `main`.
2. Dans GitHub Desktop : **Current branch → main**, puis **Fetch origin / Pull origin**.
3. Compiler et tester localement la nouvelle version de `main`, même si la Pull Request avait déjà été testée.
4. Vérifier l'onglet **Changes** de GitHub Desktop. Les modifications locales doivent être traitées avant le déploiement ; seule une modification non indexée de `apps/frontend/next-env.d.ts` produite par Next.js est tolérée par le lanceur.

## 3. Publier sur OVHcloud en double-cliquant

Dans le dossier du dépôt, double-cliquer :

**`Deployer-LMN24.cmd`**

Le script :

1. Vérifie que le dossier est le bon dépôt et que la branche locale est `main`.
2. Vérifie qu'aucun changement local non validé n'est présent, à l'exception du fichier généré Next.js mentionné ci-dessus.
3. Compare le SHA de ton commit local avec celui de `main` sur GitHub. En cas de divergence, il refuse de déployer : synchroniser et tester de nouveau.
4. Affiche le SHA exact à publier et demande de taper **`DEPLOYER`** (respecter les majuscules). Toute autre réponse annule.
5. Déclenche `deploy-production.yml` sur la branche `main` en envoyant le SHA autorisé.
6. Le workflow GitHub vérifie le SHA demandé avant les tests, la sauvegarde préalable locale, la compilation et le redémarrage sur OVHcloud.
7. Le script recherche le nouveau run GitHub Actions et, si trouvé, suit son résultat jusqu'à la fin avec `gh run watch`. La fenêtre reste ouverte.

La publication reste volontaire : un simple double-clic sans saisir `DEPLOYER` ne déploie rien. En cas d'indisponibilité de GitHub CLI ou de divergence de SHA, la publication est refusée.

Si le run ne peut pas être identifié après déclenchement, un lien vers le workflow GitHub est affiché ; **ne pas relancer sans vérifier au préalable si un déploiement est déjà en cours**, car l'action a peut-être été acceptée.

## 4. Vérifications après déploiement

Vérifier :

- `https://www.lmn24.com/fr` (site public) ;
- `https://api.lmn24.com/health` (API) ;
- la connexion à l'administration ;
- le lien GitHub Actions affiché par le script.

**Important** : la sauvegarde de précaution est actuellement stockée **sur le VPS uniquement**. Elle ne protège pas contre la perte totale du serveur. Les migrations SQL continuent à nécessiter une opération manuelle, testée et sauvegardée.

## Dépannage courant

- `gh est introuvable` → installer GitHub CLI puis rouvrir l'explorateur/PowerShell si besoin.
- `git est introuvable` → installer Git for Windows ou ajouter Git au `PATH`.
- `gh auth status` échoue → exécuter `gh auth login` dans PowerShell.
- `branche locale != main` → GitHub Desktop → **Current branch → main**.
- `SHA local != SHA GitHub` → GitHub Desktop → **Fetch origin / Pull origin**, puis **retester** la nouvelle version.
- `modifications locales` → regarder **Changes** dans GitHub Desktop, ne rien supprimer sans vérifier.
- `workflow en échec` → consulter le lien GitHub Actions indiqué ; ne pas supposer que le déploiement est terminé.
- `Exécution de scripts désactivée` → vérifier la politique de sécurité de Windows, sans contourner les règles d'entreprise.

## Pour les développeurs

- Lanceur réel : `Deployer-LMN24.cmd`
- Vérification sans publication : `Verifier-Deploiement-LMN24.cmd`
- Script PowerShell : `scripts/windows/Deploy-LMN24.ps1`
- Workflow GitHub : `.github/workflows/deploy-production.yml`
- Script côté VPS : `scripts/deploy-production.sh`

Le workflow conserve son déclenchement **strictement manuel** (`workflow_dispatch`). Le champ optionnel `expected_sha` est vérifié lorsqu'il est fourni par le lanceur Windows. Aucun webhook `push` n'est ajouté.
