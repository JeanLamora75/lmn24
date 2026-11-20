# LMN24 — Guide TV mondial — UX-05 : revue croisée BMAD et passage de relais

**Date :** 2026-11-20  
**Version :** 1.0 — revue documentaire croisée conduite sous les rôles Mary (fonctionnel), Winston (architecture), Sally (UX/UI), Murat (QA).  
**Statut :** **revue terminée, validation conditionnelle**. Ce document n'est pas une validation utilisateur des maquettes ni une exécution de tests applicatifs.  
**Sources revues :** [Mary — cadrage](./guide-tv-mondial-mary-cadrage-fonctionnel.md), [Winston — contrats API/fusion](./guide-tv-mondial-winston-contrats-api-fusion-epg.md), [Winston/Murat — risques migration](./guide-tv-mondial-winston-murat-audit-privileges-migration-candidate.md), [Sally UX-01](./guide-tv-mondial-sally-ux01-accueil-responsive.md), [UX-02](./guide-tv-mondial-sally-ux02-fiches-chaines-programmes-grilles.md), [UX-03](./guide-tv-mondial-sally-ux03-recherche-mondiale-etats.md), [UX-04](./guide-tv-mondial-sally-ux04-administration.md).  
**LIVRAISON :** aucun nouvel écran public, route, migration, configuration ou ouverture du Guide TV par ce dossier. **EMBARGO INTÉGRAL jusqu'au GO personnel explicite du propriétaire LMN24**.

## 1. Verdict d'ensemble

Les spécifications UX-01…UX-04 couvrent les parcours principaux et restent majoritairement alignées avec le cadrage Mary : accueil, quatre onglets, 7 jours, cartes sans données inventées, fiches chaînes/émissions, recherche mondiale, administration des pays/chaînes/EPG/imports/traductions, huit locales et sécurité pré-GO.

**La spécification est exploitable pour préparer le backlog Jira**, en conservant des US de cadrage sur les arbitrages ci-dessous. **Elle n'est pas prête pour signer l'acceptation UX graphique** : aucun prototype haute fidélité n'a été validé par le propriétaire et les tests E2E ne peuvent pas être exécutés sur les pages TV non encore développées. Les protections SQL vérifiées en CI isolée ne prouvent pas la compatibilité de production.

### Consolidation des tests prévus (non exécutés)
- UX-01 : **16 scénarios** de recette ;
- UX-02 : **22 scénarios** ;
- UX-03 : **26 scénarios** ;
- UX-04 : **30 scénarios** ;
- Total **94 scénarios documentés**, avec recouvrements. Ils sont des cas à implémenter/automatiser, **pas 94 tests verts**.

## 2. Matrice de traçabilité fonctionnelle

| Exigence Mary | Réalisation UX | Revue | Note QA |
|---|---|---|---|
| Pays/langue de diffusion distincts de langue UI | UX-01 filtres, UX-04 pays | **Aligné** | Cas sans pays disponible encore ouvert |
| 4 onglets, Ce soir par défaut, ordre par numéro | UX-01 | **Aligné** | NOW sur J+1 à arbitrer |
| Cartes logo/nº/titre/visuel et fallback | UX-01 | **Aligné** | Vérifier 320 px/8 locales sur rendu |
| Absence EPG vs aucun démarrage dans plage | UX-01/02/03 | **Aligné, conditionnel** | Backend doit prouver la couverture de la plage |
| Date J0…J+6, fuseaux IANA et DST | UX-01/02 | **À arbitrer** | Pays de référence vs journée locale variante |
| Fiche chaîne + grille + lien streaming officiel | UX-02 | **Aligné** | Lien streaming seulement sur fiche chaîne |
| Fiche émission et SEO noindex | UX-02 | **Aligné** | Aucun contenu illégalement republié |
| Recherche monde numérique exacte/texte partiel | UX-03 | **Aligné** | Normalisation `002` et ordre pays non tranchés |
| Regroupement des variantes sur un seul résultat chaîne | UX-02/03 | **Aligné** | Dédup des émissions multi-variantes à formaliser |
| Activation pays distincte de chaîne | UX-04 | **Aligné** | Nouvelle chaîne inactive par défaut |
| Sources EPG multiples, priorité, droits et fusion | UX-04 | **Aligné, dépendant de Winston** | Mesure de qualité et preuves des droits ouvertes |
| Import quotidien + manuel global/par pays | UX-04 | **À arbitrer** | Portée « Global » et limite de jours |
| Imports partiels sans perte de grille | UX-04 | **Aligné** | 409, idempotence et concurrence backend |
| Traductions gratuites, fournisseur manuel, partial | UX-04 | **Aligné** | Reprise manquants, protéger MANUAL |
| SEO pages permanentes seulement | UX-01/02/03 | **Aligné** | Pas d'indexation de recherche ni de fiches émissions |
| Embargo public sans GO | UX-01/02/03/04 | **Bloquant transversal explicitement documenté** | Double gate Next/Nest, 404/no-store, sitemap et E2E |

## 3. Registre des décisions ouvertes — à ne pas traiter comme validées

| ID | Priorité | Question / divergence | Proposition de la revue | Décideur et dépendance |
|---|---|---|---|---|
| D01 | **P0** | Date de référence pays vs journée locale d'une variante traversant minuit, et règle du J+N pour page chaîne | L'accueil calcule J0 sur IANA pays ; la grille calcule la journée dans IANA variante ; conserver l'instant UTC des diffusions et préciser le jour cible depuis un lien émission | **Mary + Winston** ; API dates et tests DST |
| D02 | **P1** | En ce moment sélectionné et passage vers J+1 | Basculer vers « Ce soir » avec annonce accessible, sans état NOW invalide | **Mary** ; UX01-03 |
| D03 | **P1** | Pays de secours si préférence/langue indisponible | Prendre le premier pays actif dans un ordre stable, afficher son nom, ne jamais choisir un pays inactif | **Mary** ; contrat catalogue |
| D04 | **P1** | Définition d'une plage suffisamment couverte pour « Aucun programme débutant » | État `NO_START_IN_WINDOW` seulement si les données couvrent toute la plage ; sinon `EPG_UNAVAILABLE`; formaliser l'algorithme et les cas frontières | **Winston + Mary + Murat** |
| D05 | **P1** | Bornes horaires des fenêtres 20:30–21:30 et 22:30–23:30 | Établir explicitement bornes inclusives/exclusives, tester à la minute/seconde et DST | **Mary + Winston** ; contrat API |
| D06 | **P1** | Réponse partielle « Chaînes OK / Programmes KO » de la recherche | Permettre statut par section et pagination distincte, sans masquer les résultats réussis | **Winston** ; DTO recherche |
| D07 | **P2** | Recherche numérique `002`, `0` et suffixes alphanumériques | Ne jamais appliquer un contains numérique ; normalisation entière positive proposée | **Mary + Winston** |
| D08 | **P2** | Tri des pays en recherche mondiale | Tri stable par ISO pour les curseurs, libellés localisés ; ordre visuel final à choisir | **Mary + Sally + Winston** |
| D09 | **P1** | Un programme identique sur plusieurs variantes | Regrouper cartes de **chaîne** uniquement ; éviter de confondre deux diffusions distinctes tant qu'une règle de dédup explicite manque | **Mary + Winston** |
| D10 | **P1** | Variante par défaut par chaîne ou par couple chaîne/pays | Choisir un mécanisme déterministe par pays, sans IP ; vérifier modèle actuel | **Winston + Mary** |
| D11 | **P1** | Import manuel Global = pays actifs seuls ou tous configurés ; limite X jours | Afficher le périmètre explicitement avant déclenchement et préserver le manuel sur pays inactif ; proposer 1–7 jours sans l'acter | **Mary + Winston** |
| D12 | **P0** | Définition de la qualité/couverture et droits EPG par type de contenu | Ne pas calculer de taux fictif, ni rendre visible un contenu dont la republication n'est pas approuvée | **Winston + Mary + Murat** |
| D13 | **P0** | Permissions DB et migration réelle vs bootstrap fictif | Maintenir la candidate dans docs ; vérifier sur copie fidèle, audits de rôles/fonctions, séparation API/parser | **Winston + Murat** |
| D14 | **P1** | Écrans haute fidélité / identité graphique et mobile | Réaliser captures/prototypes 320, 390, 768, 1440 px, tester longueurs de texte de 8 langues et thème sombre, puis valider avec propriétaire | **Sally + Murat + propriétaire** |
| D15 | **P0** | Conditions de passage du flag public | Exiger GO explicite, gate serveur sur Next + NestJS, tests 404/no-store, zéro sitemap/SEO et audit final | **Propriétaire + Winston + Amelia + Murat** |

**Légende** : P0 = bloquant sécurité, vérité des données, validation réelle ; P1 = règle structurante avant développement correspondant ; P2 = décision à finaliser avant recette de la fonctionnalité.

## 4. Corrections/clarifications proposées par les quatre rôles

### Mary — gardienne des décisions fonctionnelles
- Une chaîne dans un pays est **une seule carte**, même avec variantes horaires ; une chaîne partagée entre pays peut apparaître une fois **par pays** dans la recherche mondiale.
- Ne jamais remplacer une émission déjà en cours par un faux « début ce soir » : seul le **début** dans la fenêtre compte.
- « Programme non disponible » (EPG lacunaire) et « Aucun programme débutant sur cette plage » (couverture connue) ne sont pas interchangeables.
- Une chaîne découverte reste **inactive**, un pays désactivé ne supprime pas ses chaînes, les imports manuels sur pays inactifs restent possibles.
- Les corrections MANUAL et les traductions réussies doivent survivre aux imports/échecs partiels.
- Une traduction automatisée est conditionnée à un fournisseur **sans carte bancaire ni coût**, choisi manuellement ; pas de quotas ni de bascule implicite.

### Winston — cohérence API, fuseaux, sécurité
- `/public/tv/search` doit offrir indépendance des deux sections, pagination stable, et interdiction stricte des pays/chaînes non publiés.
- Les interfaces demandant un pays, numéro ou variante doivent recevoir des IDs et fuseaux IANA explicites, jamais déduits de l'IP.
- Les intervalles de grille sont en UTC, évalués sur des journées locales de **23, 24 ou 25 h** ; les fenêtres du soir se calculent dans le fuseau de la variante, jamais celui du visiteur.
- Les mutations admin demandent contrôle ADMIN serveur et protection de concurrence ; aucun secret EPG/traduction ne doit remonter dans les DTOs.
- L'activation publique doit être impossible avant GO, même par accès direct : **404 + no-store côté frontend et API**, sitemap absent, référencement bloqué.

### Sally — homogénéité UX et accessibilité
- Réutiliser la navigation/admin LMN24, les variables Bootstrap, le mode sombre, les filtres séparés des données, les modales accessibles, et ne pas créer une nouvelle interface hétérogène.
- Les cartes de programmes conservent l'agencement **logo + numéro sous logo | heure/titre/catégorie-durée | image** ; les cartes absentes d'EPG ne pointent pas vers une fiche fictive.
- Les flèches restent aux mêmes positions même désactivées et la date reste **centrée** ; les onglets scrollent sur petit écran sans faire scroller toute la page.
- « Regarder en direct » est uniquement sur fiche chaîne, vers la page officielle externe, sans lecteur embarqué.
- Les formulaires d'administration distinguent saisie manuelle, valeurs fournisseur, erreurs et impacts d'une activation/désactivation.

### Murat — stratégie de tests
- Les **94 scénarios UX** existants sont la base du plan de recette, à dédupliquer et automatiser par lot ; ils ne sont pas des succès de tests.
- Priorités transversales : P0 embargo et droits, P1 dates/variantes/DST et EPG lacunaires, P1 permissions admin et imports partiels, P2 ergonomie et langues.
- Tester les routes refusées **après déploiement**, et pas seulement l'absence de lien visible ; tester 320 px et 8 langues, notamment RU, ainsi que clavier/lecteur d'écran.
- Les tests PostgreSQL existants sont sur base isolée synthétique. La vraie compatibilité de production et la reprise transactionnelle applicative restent à valider séparément.

## 5. Passage de relais proposé à John — découpage Epic/US

**Ne pas créer d'issues Jira automatiquement à ce stade ; ce tableau est la proposition de backlog à valider.** Définir un Epic « Guide TV mondial LMN24 » avec les sous-domaines suivants :

| Lot de réalisation | Périmètre et dépendance | Gate de recette |
|---|---|---|
| GTV-00 — Embargo / permissions | Flag serveur désactivé, 404/no-store, absence nav/sitemap, ADMIN contrôlé | **P0 permanent** |
| GTV-01 — Données et migration | Inventaire DB réel, Prisma/SQL candidate canonique, rôles DB, rollback | **P0 pré-migration** |
| GTV-02 — Pays et chaînes | Activation pays/chaîne, IANA, variantes, n° nationaux, fiches et corrections manuelles | D01,D03,D10 |
| GTV-03 — Sources EPG | Qualification droits, parsers sécurisés, priorité et rapprochement ID | D12, licences |
| GTV-04 — Imports | Quotidien + manuel, scopes, fencing/locks, révisions, relance partielle | D04,D11 |
| GTV-05 — Catalogue et grilles | API publication, programmes, fuseaux, jours J0–J+6, couverture/états | D01,D04,D05 |
| GTV-06 — Accueil public | UX-01, quatre onglets, cartes et filtres | UX01-01…16 |
| GTV-07 — Fiches chaîne et émission | UX-02, timeline, variantes, pages noindex, streaming officiel | UX02-01…22 |
| GTV-08 — Recherche mondiale | UX-03, numérique exact, texte, résultats/pagination partielle | D06…D09, UX03 |
| GTV-09 — Administration Guide TV | UX-04, 7 écrans, historiques, corrections, statistiques | UX04-01…30 |
| GTV-10 — Traduction | Fournisseurs gratuits, manuel, partiel, corrections protégées | Conditions Mary |
| GTV-11 — QA / i18n / accessibilité | 8 langues, responsive, DST, sources/licences, rollback CI | 94 scénarios à rationaliser |
| GTV-12 — Pré-publication | Audit sécurité, droits, SEO, conformité, tests sans exposition | **Aucun GO automatique** |

Toutes les US doivent intégrer leur propre vérification d'absence d'exposition et ne jamais activer le Guide TV public. La finalisation technique du lot GTV-01 peut progresser en parallèle des prototypes UI, mais **sa migration effective exige un contrôle supplémentaire**.

## 6. Conditions de clôture de la conception UX

- [x] UX-01 à UX-04 documentés.
- [x] Comparaison aux exigences Mary et contrats Winston.
- [x] Inventaire des arbitrages et responsabilités.
- [x] Parcours et matrice de tests UX formalisés.
- [x] Proposition de découpage pour John.
- [ ] Décisions D01–D15 validées selon les propriétaires indiqués (certaines peuvent être reportées à une US de cadrage).
- [ ] Maquettes visuelles haute fidélité, desktop et mobile, revues et approuvées.
- [ ] Tests utilisateurs ou revue interactive sur prototypes à conduire.
- [ ] Compatibilité de la migration avec copie fidèle de l'instance réelle.
- [ ] Accord personnel du propriétaire pour publication publique — **NON DONNÉ**.

## 7. Avis de la revue BMAD

**Mary :** périmètre fonctionnel global cohérent, décisions ouvertes correctement isolées.  
**Winston :** architecture suffisante pour initialiser backlog, sous réserve des contrats manquants et du contrôle DB sur copie fidèle.  
**Sally :** parcours spécifiés, maquettes finales et validation visuelle encore nécessaires.  
**Murat :** prêt pour **préparation des US et des tests**, pas pour homologation finale ni mise en ligne.

**Décision UX-05 : PASSAGE DE RELAIS À JOHN POSSIBLE POUR LA RÉDACTION D'UN EPIC ET DES US PROPOSÉES, MAIS PAS UNE VALIDATION DE MISE EN PRODUCTION.** Aucune création Jira effectuée par cette revue. Aucun développement applicatif ni recherche web externe effectué.
