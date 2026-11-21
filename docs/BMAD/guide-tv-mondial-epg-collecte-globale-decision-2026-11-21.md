# LMN24 — Guide TV mondial — Arbitrage BMAD GTV-EPG-GLOBAL-01

**Décision validée par le propriétaire :** 21 novembre 2026.  
**Statut :** décision fonctionnelle validée ; adaptation technique en cours de qualification.  
**Acteurs BMAD :** Mary (fonctionnel), Winston (architecture), Sally (administration), Amelia (implémentation), Murat (preuves).

## 1. Décision et périmètre

Une **source EPG est mondiale par défaut**. Son activation ne demande pas de rattachement explicite à un ou plusieurs pays. Lors d'une analyse autorisée, l'application examine le flux complet de la source, sans filtre géographique préalable. Un pays n'est **pas** un attribut obligatoire de la source.

Les données téléchargées peuvent concerner des pays multiples ou inconnus. Les identifiants de chaînes externes non reconnus sont conservés sous `PENDING_REVIEW` ; aucune association irréversible n'est effectuée sur la seule ressemblance d'un nom. Une correspondance `VERIFIED` avec une chaîne/variante autorisée permet de déterminer le ou les périmètres de publication. La grille publique demeure structurée par `(pays, variante, date civile IANA)`.

Ne pas confondre :
- **Collecte** : récupération et décodage du flux entier d'une source active, dans les limites de sécurité, avec autorisation opérationnelle du téléchargement.
- **Qualification** : rapprochement d'identifiants, détermination du pays si preuve disponible, quarantaine des inconnus, vérification distincte des droits.
- **Publication** : seulement sources actives dont droits programmes = `APPROVED` et justificatif non vide, mappings `VERIFIED`, variante associée au pays, attestation indépendante de couverture complète, transaction fenced et GO public distinct.

La déclaration d'une source **n'autorise pas** par elle-même l'usage juridique des contenus, le téléchargement réseau en exploitation, la publication des émissions ou la mise en ligne du Guide TV.

## 2. Architecture de transition sans migration destructive

Le schéma candidat existant (19 tables) reste en vigueur. `tv_source` est l'entité globale. `tv_source_country` est désormais **facultative** : les lignes historiques représentent des exceptions explicites de désactivation nationale ou de priorité nationale, pas une liste blanche des pays où une source existe. Aucune ligne dans cette table doit être nécessaire pour sélectionner une source active.

`tv_import_scope` conserve provisoirement `country_id NOT NULL`, car il identifie le périmètre **de traitement/publication**, pas un droit d'accès à la source. Lors d'un import global, on parcourt les pays TV actifs et **toutes** les sources globales actives ; lors d'un import manuel ciblé, on peut choisir un pays TV inactif. Le flux d'une source est téléchargé et décodé une seule fois par worker/run puis réutilisé pour les différentes partitions nationales. Les flux inconnus donnent lieu à des mappings `PENDING_REVIEW` indépendants du pays.

Cette transition n'est **pas** encore un moteur complet de découverte autonome de nouveaux pays : les publications restent bornées aux pays TV configurés, faute de représentation de scopes de collecte sans pays dans le SQL actuel. Une future itération pourra séparer une table de scan par source de la table de publication par pays, sans perte d'historique. Ne pas supprimer `tv_source_country`, ni rendre `tv_import_scope.country_id` nullable sans migration qualifiée et tests de restauration. Ne pas promettre l'identification automatique du pays lorsque le flux ne le renseigne pas de façon fiable.

## 3. Contrats d'administration

- Créer/modifier une source via nom, URL, format, activation et statuts de droits, **sans pays obligatoire**.
- Dans la liste, une source sans exception `tv_source_country` est indiquée `Globale`; masquer le filtre géographique qui ferait disparaître ces sources.
- Les priorités nationales ne servent qu'aux **conflits entre sources** ; absence de priorité : ordre déterministe par identifiant source, après les exceptions prioritaires.
- Les comptes externes inconnus restent `PENDING_REVIEW` : ne pas activer ni numéroter automatiquement une chaîne sur son seul nom.
- L'interface d'import manuel peut encore choisir le périmètre de traitement (tous pays TV actifs ou un pays), mais ce choix **ne filtre jamais les flux sources à télécharger**.
- Une exécution globale peut générer des états partiels par scope ; chaque ancienne grille est préservée si couverture, droits ou mapping insuffisants.

## 4. Invariants sécurité / exploitation

`TV_CATALOG_ADMIN_ENABLED` et `TV_IMPORTS_ENABLED` contrôlent l'administration. L'exécution **réseau** n'est possible que par le runner autorisé, qui exige également `TV_EPG_NETWORK_ENABLED=true`, `TV_MIGRATION_QUALIFIED=true`, `TV_EPG_SOURCE_USE_APPROVED=true` et une attestation de couverture injectée. Le scheduler n'exécute pas automatiquement ce runner. **Pas d'activation de ces drapeaux dans les dépôts.**

`TV_PUBLIC_ENABLED=false` et `TV_PUBLIC_RELEASE_APPROVED=false` restent inchangés. Le téléchargement respecte SSRF/DNS, redirections, plafonds de temps/taille, décompression, et ne divulgue pas secrets/URL privées. Aucun programme non approuvé n'est publié ; aucune couverture absente n'est remplacée par une grille inventée. Les corrections administratives restent prioritaires.

## 5. Traçabilité et critères de recette

- **SCRUM-116** : activation globale source, exceptions optionnelles, reconnaissance des IDs externes en attente, droits par famille.
- **SCRUM-117** : file d'import multi-pays sans association source-pays, lecture intégrale unique de source, partitionnement des mappings vérifiés, sorties `PARTIAL`, réessais ciblés, publication fenced.
- **SCRUM-122** : formulaire de source sans pays, liste globale, explicitation du périmètre d'import et des droits, suivi des mappings à vérifier.

**Cas de test obligatoires (Murat)** : une source active sans `tv_source_country` est sélectionnée ; deux pays réutilisent une unique acquisition de flux ; une exception nationale inactive exclut cette partition seulement ; IDs inconnus restent `PENDING_REVIEW` ; droits non approuvés ne publient rien ; source échouée ne détruit pas les snapshots ; erreur d'accès réseau bloquée par les flags ; embargo public maintenu ; test PostgreSQL isolé + copie fidèle migrée et CI verte sur **un même SHA**.

## 6. Restrictions restantes

La présente modification n'active **aucun import réel** automatiquement, ne remplace pas la validation juridique des EPG, ne certifie pas un algorithme d'inférence universel des pays et ne vaut pas homologation de la migration en production. La recette des flux réels et du moteur de publication nécessite la qualification de SCRUM-114/116/117, puis les preuves de Murat. Ne pas marquer les User Stories terminées avant ces preuves.
