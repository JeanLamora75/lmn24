# LMN24 — Guide TV mondial — Murat / QA — Revue technique pré-migration v0.1

**Date :** 2026-11-20  
**Statut :** revue statique commencée ; **NON VALIDÉ POUR EXÉCUTION**.  
**Périmètre :** conception Winston et fichiers BMAD. Cette revue formalise une analyse QA en rôle Murat ; ce n'est pas un rapport de tests PostgreSQL ou une attestation d'un agent autonome.  
**Sources :** [SQL v0.6](./guide-tv-mondial-winston-schema-prototype.sql), [Prisma proposé](./guide-tv-mondial-winston-prisma-proposition.prisma), [architecture v0.4](./guide-tv-mondial-winston-contrats-api-fusion-epg.md).

## 1. Résultats de l'inspection statique

| ID | Gravité | Constat | Statut |
|---|---|---|---|
| QA-TV-01 | HAUTE | Relation variante/pays risquait d'associer deux chaînes différentes | **Corrigé dans prototype** par deux FK composites partageant channel_id |
| QA-TV-02 | HAUTE | Mapping EPG pouvait rattacher une variante appartenant à une autre chaîne | **Corrigé dans prototype** par FK composite et CHECK de cohérence |
| QA-TV-03 | HAUTE | Pointeur courant pouvait viser une révision non publiée | **Corrigé dans prototype** par FK composite et trigger vérifiant PUBLISHED |
| QA-TV-04 | HAUTE | Publication pouvait être modifiée après bascule ; initialement INSERT d'airing publié non bloqué | **Corrigé dans prototype** : révision PUBLISHED non modifiable, INSERT/UPDATE/DELETE d'airings publiés interdits |
| QA-TV-05 | HAUTE / BLOQUANT | Les écritures de tv_schedule_current ne sont PAS encore contraintes au niveau SQL par l'owner token / bail du parser | **Ouvert** : imposer fencedParserWrite dans le service et tester sous transaction ; étudier trigger DB utilisant propriétaire vérifié pour fermer tout contournement |
| QA-TV-06 | HAUTE / BLOQUANT | Le fragment Prisma n'a pas été testé par prisma validate : relations composites, inverses Country et utilisation d'un même champ dans plusieurs relations à confirmer | **Ouvert** : montage du schéma complet dans une copie isolée, prisma format/validate/generate hors base réelle |
| QA-TV-07 | HAUTE / BLOQUANT | Le prototype SQL n'a été exécuté ni sur PostgreSQL isolé ni en double exécution | **Ouvert** : tests de création, rejouabilité, catalogues et triggers |
| QA-TV-08 | MOYENNE | Même nom IANA est seulement non vide dans SQL, pas prouvé valide | **Ouvert** : validation stricte applicative avec base IANA, tests DST |
| QA-TV-09 | HAUTE | Protection du public non reliée aux futures routes et API ; booléen actuel faux seul insuffisant | **Ouvert** : gate côté Next.js/NestJS + sitemap + E2E |
| QA-TV-10 | HAUTE | Contrôle droits des sources EPG non imposé par SQL sur le pointeur courant | **Ouvert** : validation de provenance et rightsStatus=APPROVED avant publication, test de contournement |
| QA-TV-11 | MOYENNE | Attribution numéro et collisions sources officielles | **Partiel** : unicité effective par pays en SQL ; stratégie de conflit/verrou à implémenter |
| QA-TV-12 | MOYENNE | Plusieurs variantes par chaîne, une seule par défaut | **Partiel** : au plus une par index ; exiger au moins une par logique métier lors de l'activation |
| QA-TV-13 | MOYENNE | L'absence de chevauchement n'est pas contrainte SQL, les programmes peuvent déborder sur les jours adjacents | **Ouvert** : contrôles staging, ordre, recouvrements et bornes locales avant publication |
| QA-TV-14 | MOYENNE | Aucune purge physique exécutée ; programmes orphelins possibles après rétention | **Ouvert** : stratégie de nettoyage sûre et déterministe |
| QA-TV-15 | HAUTE | Autorisations SQL (droits de compte parser/backend) non définies dans prototype | **Ouvert** : accorder les privilèges minimaux ; empêcher écritures publiques/administratives non autorisées |
| QA-TV-16 | MOYENNE | Description Prisma = fragment de 19 modèles, ajout inverse requis sur Country ; CHECK, triggers et indexes SQL hors Prisma | **Documenté** ; ne pas appliquer directement, valider mapping SQL/ORM |
| QA-TV-17 | HAUTE | Les scripts SQL préexistants sont historiques et non tous baselinés avec Prisma | **Documenté** ; migration additive uniquement après inventaire de la vraie base et backup restaurable |
| QA-TV-18 | HAUTE | Systèmes SSRF, contrôle de taille EPG et limites de décompression non encore implémentés | **Ouvert** : tests de sécurité et revue parser |

## 2. Critères de levée des blocages

### A. Base et sécurité transactionnelle
- [ ] SQL exécutable autorisé, transactionnel, jouable sur PostgreSQL isolé ; deuxième passage sans conflit/effet inattendu.
- [ ] Modèle Prisma validé/généré **à partir du schéma complet**, puis correspondance types/FK/index démontrée.
- [ ] Toutes les FK composites fonctionnent (variante vs chaîne/pays, alias vs variante/chaîne, révision courante vs date/fuseau).
- [ ] Tentatives INSERT/UPDATE/DELETE sur émission d'une révision publiée sont refusées.
- [ ] Pointeur vers révision STAGING/VALIDATED ou autre date/variante refusé.
- [ ] Deux workers concurrents + perte du bail : ancien token rejeté sans changer le pointeur courant.
- [ ] Import partiellement échoué conserve la grille précédente.
- [ ] Aucun candidat EPG issu d'une source sans droits APPROVED n'est visible publiquement.

### B. Non-régression et embargo
- [ ] Les tables country, language, article et source existantes restent inchangées par la migration.
- [ ] Base neuve et base historique conduisent au même schéma TV.
- [ ] Aucun job TV automatique ne démarre par défaut.
- [ ] Tant que le propriétaire n'a pas donné son GO : aucune navigation, API publique, sitemap, URL TV ou indexation.
- [ ] CI complète sur **un SHA unique de main** après stabilisation.

## 3. Campagne de test proposée

1. Créer des fixtures SQL : 2 pays, 3 chaînes, 2 variantes, 2 sources prioritaires, 2 journées dont une DST, 2 révisions concurrentes.
2. Tests de refus FK/unique/check sous sous-transactions SQL ; toutes les écritures de test doivent être annulées.
3. Vérifier l'immutabilité PUBLISHED et la cohérence du pointeur sans ouverture à l'import concurrent.
4. Simuler la perte d'une session verrouillée, contrôler le fencing du writer ancien.
5. Tester l'activation des chaînes découvertes : inactives même si les pays sont actifs.
6. Tester 2 fournisseurs, 1 seul actif, conservation des traductions manuelles après échec partiel.
7. Vérifier l'absence de régression du scheduler/flux RSS/vidéos/météo/horoscope.
8. Tester les routes pré-GO à chaque niveau serveur et les sitemap/noindex.
9. Revoir licences, images et descripteurs de sources AVANT toute mise en public.

## 4. Avis Murat (préliminaire)

**GO pour poursuivre l'étude documentaire et les tests isolés : OUI.**  
**GO pour exécuter une migration sur base LMN24 : NON.**  
**GO pour ouvrir le Guide TV au public : NON ; exige une autorisation explicite et séparée du propriétaire.**

Les corrections de contraintes ont rendu le prototype significativement plus solide, mais **aucune réussite de test PostgreSQL, aucune validation Prisma et aucune CI verte ne doivent être prétendues à ce stade**. Les problèmes QA-TV-05, QA-TV-06 et QA-TV-07 sont des portes bloquantes pour déclarer le modèle exécutable.

**Aucune recherche web externe et aucune exécution de migration n'ont été réalisées pour cette revue.**
