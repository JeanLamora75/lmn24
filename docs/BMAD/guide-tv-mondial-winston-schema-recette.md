# LMN24 — Guide TV mondial — Winston — Revue du prototype SQL et recette v0.5

**Date :** 2026-11-20  
**État :** prototype non validé pour exécution. Aucune migration sur PostgreSQL.  
**Prototype :** [SQL de conception](./guide-tv-mondial-winston-schema-prototype.sql)  
**Documents de référence :** [Mary](./guide-tv-mondial-mary-cadrage-fonctionnel.md) · [Winston v0.4](./guide-tv-mondial-winston-contrats-api-fusion-epg.md)

## 1. Périmètre livré
Le fichier SQL de conception (stocké volontairement dans docs/BMAD, **pas dans database/migrations**) présente les tables propres au Guide TV, des clés étrangères, des contraintes de dates, numéros par pays, révisions de grilles et fournisseur de traduction sélectionné. Il **n'est pas une migration prête pour production** : il n'a pas été exécuté, ne possède pas de correspondance Prisma et ne fait pas partie du bootstrap d'une installation neuve.

Ce statut évite un déclenchement accidentel par les outils automatisés du dépôt. La publication du prototype sur main ne change pas la base ni l'application.

## 2. Contrôles statiques de cohérence à approfondir
- La séparation de `tv_country.is_active` et `country.is_active` préserve le catalogue d'actualités.
- L'index unique sur `COALESCE(manual_number,official_number,assigned_number)` est une garantie d'unicité par pays, mais il **ne traite pas les collisions de numéros officiels** automatiquement : résoudre avant insertion, réattribuer un numéro et journaliser la décision. Il permet plusieurs lignes sans numéro tant qu'inactives ; les associations actives ont un numéro effectif obligatoire.
- La présence d'une FK composite `tv_schedule_current(revision_id,variant_id,local_date)` prévient le lien vers une autre journée/variante. Elle ne prouve **pas** que la révision est de statut PUBLISHED ; exiger un trigger ou une procédure transactionnelle validée et testée.
- `tv_variant_country` doit garantir que la variante et l'association pays pointent vers la même chaîne : ajouter des clés composites ou un trigger. C'est un **blocage avant migration exécutable**.
- `tv_channel_external_id` ne doit pas accepter de variante appartenant à une autre chaîne ; ajouter invariant relationnel avant production.
- `tv_airing` vérifie les bornes mais pas les overlaps : vérifier dans staging sous verrou par périmètre ; éventuellement exclusion constraint après étude.
- Les langues TV sont stockées en VARCHAR(16) pour éviter de perdre des tags régionaux. Un mapping de langues d'interface FR/EN/DE/ES/PT/IT/RU/NL reste nécessaire.
- Le prototype déclare `ALTER TABLE ... ADD CONSTRAINT` sans garde d'existence : **non rejouable en l'état** ; transformer en migration additive entièrement idempotente après validation. Ne jamais l'exécuter deux fois.
- La référence `public.country(id)` doit être confirmée sur la base cible avant migration ; le modèle Prisma indique bien cette convention, mais l'état de production n'a pas été interrogé.
- L'interrupteur `TV_GUIDE_PUBLIC_ENABLED=false` est actuellement un contrat documentaire. La future application doit vérifier le gate **serveur** sur chaque route TV et exclure les sitemaps jusqu'au GO.

## 3. Proposition de smoke test SQL sur base isolée

Procédure *à produire comme artefact exécutable après revue*, encapsulée dans `BEGIN; ... ROLLBACK;`, comportant les scénarios :

| Test | Précondition | Résultat attendu |
|---|---|---|
| S01 | Chaîne non activée, pays TV activé | Aucune visibilité publique |
| S02 | Chaîne activée, pays TV désactivé | Aucune visibilité publique |
| S03 | Chaîne inconnue créée par import | `is_active=false`, `needs_review=true` |
| S04 | Deux chaînes même numéro effectif dans le même pays | Rejet `unique_violation` |
| S05 | Même numéro dans deux pays | Accepté |
| S06 | Une seule variante par défaut par chaîne | Deuxième variante défaut refusée |
| S07 | Création d'une diffusion avec fin avant début | Rejet `check_violation` |
| S08 | Pointeur de grille vers mauvaise variante/date | Rejet `foreign_key_violation` |
| S09 | Deux fournisseurs sélectionnés | Deuxième sélection refusée |
| S10 | Fournisseur non qualifié sélectionné | Rejet `check_violation` |
| S11 | Import sur 0 ou 8 jours | Rejet `check_violation` |
| S12 | Révision ancienne pendant publication d'une nouvelle | Lecture stable, aucun intermédiaire visible |
| S13 | Perte du bail parser pendant transaction | Écriture refusée, ancienne révision conservée |
| S14 | Conflit d'identité externe | Alias en revue, aucune fusion arbitraire |
| S15 | Purge J-7 / logs 30 jours | Catalogue et corrections manuelles inchangés |
| S16 | Source EPG non autorisée | Données en quarantaine, aucune publication |
| S17 | Deux versions de la même grille | Publication par pointeur atomique et sans double lecture |
| S18 | Langue de traduction échouée | Autres traductions intactes ; reprise manuelle uniquement |

Les scénarios S01, S02, S12 à S18 exigent également des tests applicatifs / d'intégration : le SQL seul ne saurait démontrer un résultat UI ou un processus distribué.

## 4. Matrice de risques / actions techniques préalables

| Risque | Impact | Action Winston |
|---|---|---|
| Deux voies de migrations historiques | Schéma divergent | Revue état réel + baseline + SQL additif + bootstrap neuf |
| Données externes non fiables | SSRF / XXE / bombes gzip | Validations des URL, IP, redirections, taille, décompression et parser XML streaming |
| Fusionalias erronée | Deux chaînes fusionnées | Mappings vérifiés + revue administrative |
| Changement d'heure | Diffusion doublée ou perdue | Tests IANA pour journées 23h / 25h |
| Verrou global déjà utilisé | Blocage RSS/météo/vidéo | Analyser contention sans affaiblir fencing PostgreSQL |
| Source non licenciée | Risque juridique | Approbation explicite de la source avant publication |
| Accès TV avant GO | Violation du lancement | Routes serveur 404, menus et sitemaps absents, tests E2E |
| Reprise sur échec | Doublons ou suppressions | Idempotence et versions immuables |

## 5. Plan de finalisation (sans accès externe nouveau)
1. Réviser le SQL pour les invariants croisés et la rejouabilité, puis le soumettre à revue technique.
2. Transcrire le modèle définitif en Prisma avec `@map`, `@@map`, FK et index.
3. Rédiger une migration officielle dans le répertoire historique **après validation**, et un bootstrap neuf correspondant.
4. Rédiger le smoke test rollback puis le tester sur cluster PostgreSQL isolé.
5. Vérifier que le parser conserve le fencing des écritures et que le scheduler TV n'est pas activé par défaut.
6. Relecture croisée de la sécurité / QA par Murat et des parcours par Sally.
7. Contrôler la CI sur un SHA de main, sans considérer son succès comme un GO public.

**Aucune recherche avancée ni web externe n'a été réalisée. Les fournisseurs EPG et leurs droits demandent une étude ultérieure distincte.**
