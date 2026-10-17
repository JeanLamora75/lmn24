# LMN24 — Mode opératoire de déploiement GitHub → OVHcloud

**Version simplifiée — 17 octobre 2026**

Ce guide sert à publier **manuellement** une version de LMN24 déjà développée et testée sur le PC Windows. Aucun logiciel supplémentaire n'est nécessaire : **GitHub Desktop pour les tests**, puis **le site GitHub pour le déploiement**.

> **Règle à retenir :** une modification ou une fusion sur `main` ne met **pas** OVHcloud à jour. Le site n'est mis à jour que lorsque tu cliques volontairement sur **Run workflow** dans GitHub Actions.

## Étape 1 — Tester les nouveautés sur le PC (GitHub Desktop)

1. Ouvrir **GitHub Desktop** et choisir le dépôt **lmn24** dans **Current repository**.
2. Cliquer sur **Fetch origin**.
3. Ouvrir **Current branch**, puis choisir la branche de développement indiquée pour la nouvelle fonctionnalité.
4. Lancer LMN24 en local comme d'habitude (`pnpm dev`) et effectuer les tests sur le PC.
5. En cas de problème, demander la correction sur cette branche : **ne pas déployer**.

**Condition pour continuer :** les fonctionnalités souhaitées fonctionnent sur le PC.

## Étape 2 — Mettre le code validé dans main

Après validation, demander à ChatGPT de fusionner la Pull Request dans `main`, ou procéder manuellement sur le site GitHub :

1. Ouvrir [les Pull Requests LMN24](https://github.com/JeanLamora75/lmn24/pulls).
2. Cliquer sur la Pull Request correspondant à la fonctionnalité.
3. Vérifier que les tests GitHub sont verts ; si la PR est encore en brouillon, cliquer sur **Ready for review** si proposé.
4. Cliquer sur **Merge pull request**, puis **Confirm merge**.

**Attention :** cette fusion ne déploie rien sur OVHcloud.

## Étape 3 — Vérifier la version finale de main sur le PC

1. Revenir dans **GitHub Desktop**.
2. Cliquer sur **Current branch → main**.
3. Cliquer sur **Fetch origin**, puis sur **Pull origin** s'il est proposé.
4. Tester la dernière version de `main` sur le PC. Ne pas poursuivre si elle ne fonctionne pas.
5. Si l'évolution nécessite de nouvelles tables ou colonnes PostgreSQL, prévoir **séparément** la migration SQL en production, avec sauvegarde et validation, **avant** de déployer le code qui en dépend.

**Condition pour continuer :** la dernière version de `main` est celle que l'on souhaite publier.

## Étape 4 — Ouvrir la page de déploiement GitHub

1. Aller sur **[GitHub — Deploy LMN24 to OVH (manual)](https://github.com/JeanLamora75/lmn24/actions/workflows/deploy-production.yml)**.
2. Sinon, passer par [le dépôt LMN24](https://github.com/JeanLamora75/lmn24) → onglet **Actions** (barre du haut) → dans le menu à gauche **Deploy LMN24 to OVH (manual)**.
3. Cliquer à droite sur le bouton **Run workflow** pour ouvrir le petit menu.
4. Vérifier que **Branch: main** est sélectionnée. Ne pas sélectionner une branche de développement.
5. Cliquer sur le bouton vert **Run workflow** à l'intérieur du menu pour confirmer.

**C'est uniquement à ce moment que tu demandes réellement une publication en production.** La version déployée correspond au commit de `main` au moment du déclenchement, pas à une branche locale.

## Étape 5 — Suivre la publication

1. Patienter quelques instants sur la page du workflow, puis actualiser si nécessaire.
2. Cliquer sur **l'exécution la plus récente**, en haut de la liste.
3. Sur la page de l'exécution, regarder les deux jobs :
   - **Validate approved main version** : vérification du code (typecheck, lint, tests, compilation).
   - **Deploy exact verified commit** : connexion SSH au VPS, **sauvegarde locale préalable**, installation/compilation, redémarrage des trois services et vérification de santé.
4. Attendre que les deux jobs soient **verts** avec une coche.

**Un job rouge = déploiement à diagnostiquer.** Cliquer sur le job rouge et lire l'étape en erreur ; ne pas relancer automatiquement plusieurs fois sans comprendre la cause. En cas d'échec pendant la publication, le script tente de revenir au code précédent, mais cela n'est pas une garantie absolue.

## Étape 6 — Contrôler le site OVH après une exécution verte

Ouvrir :

- **Site public** : https://www.lmn24.com/fr
- **API** : https://api.lmn24.com/health — la réponse doit indiquer `"status":"ok"` et `"database":"up"`.
- **Administration** : ouvrir l'administration de LMN24 et vérifier la connexion ainsi que la page concernée par le changement.

Si l'un de ces contrôles échoue, noter le message observé et demander un diagnostic avant un nouveau déploiement.

## En cas d'erreur

- **Les tests échouent avant le déploiement** : rien n'a normalement été envoyé à OVH. Corriger le code, tester à nouveau, puis relancer manuellement le workflow.
- **La connexion SSH échoue** : ouvrir le job `Deploy exact verified commit` et son journal ; vérifier les secrets SSH GitHub sans jamais les copier dans un chat.
- **La compilation ou le redémarrage échoue sur OVH** : consulter les journaux du job. Le retour arrière du code peut avoir été tenté : vérifier le site et les services avant une nouvelle action.
- **GitHub n'affiche pas le bouton Run workflow** : vérifier que tu es connecté au bon compte GitHub, dans le bon dépôt et sur le workflow `Deploy LMN24 to OVH (manual)`.

**Sauvegardes :** le VPS exécute des sauvegardes quotidiennes et le workflow lance une sauvegarde locale avant une mise en production. Les copies de sauvegarde **hors VPS** ne sont pas encore configurées.

## Aide-mémoire express : les clics à retenir

1. **GitHub Desktop :** `Fetch origin` → tester la branche → valider.
2. **GitHub :** fusionner la Pull Request dans `main` (ou demander à ChatGPT de le faire).
3. **GitHub Desktop :** `Current branch → main` → `Fetch origin` → `Pull origin` → retester.
4. **GitHub Actions :** `Actions` → `Deploy LMN24 to OVH (manual)` → `Run workflow` → `Branch: main` → bouton vert `Run workflow`.
5. **Vérification :** deux jobs verts → site public → API → administration.

**Important :** aucune commande SSH, aucune installation GitHub CLI et aucun script Windows ne sont nécessaires pour déclencher le déploiement.
