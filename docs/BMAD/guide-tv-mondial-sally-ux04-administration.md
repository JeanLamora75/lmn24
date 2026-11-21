# LMN24 — Guide TV mondial — Sally — UX-04 : administration

**Date :** 2026-11-20  
**Version :** UX-04 v1.0 — conception fonctionnelle détaillée, wireframes et critères de recette.  
**Statut :** livrable de spécification pour revue BMAD ; **pas de prototype interactif développé, ni de maquettes pixel-perfect approuvées**.  
**Sources :** [Mary — cadrage](./guide-tv-mondial-mary-cadrage-fonctionnel.md) · [Sally — étude initiale](./guide-tv-mondial-sally-etude-ux-ui-initiale.md) · [Sally UX-01](./guide-tv-mondial-sally-ux01-accueil-responsive.md) · [Sally UX-02](./guide-tv-mondial-sally-ux02-fiches-chaines-programmes-grilles.md) · [Sally UX-03](./guide-tv-mondial-sally-ux03-recherche-mondiale-etats.md) · [Winston — contrats API](./guide-tv-mondial-winston-contrats-api-fusion-epg.md).  
**Règle bloquante :** aucun accès public au Guide TV avant le **GO explicite du propriétaire LMN24**. L'administration reste protégée par session + rôle ADMIN côté Next.js **et** NestJS. La présence d'une page interne ou une CI verte ne lève pas l'embargo public.

## 1. Intention et cohérence avec l'administration LMN24

La navigation admin de LMN24 utilise déjà un **menu latéral persistant** (`AdminShell`), des pages de travail partagées (`AdminPageHeading`, `AdminFilterPanel`, `AdminDataPanel`), des filtres mémorisés en session (`useAdminSessionFilter`) et des composants de pagination (`AdminPagination`). `ParserMonitoringScreen` fournit un exemple de supervision et `SourcesTable` un exemple de recherche, filtre et tableau. **UX-04 réutilise cet écosystème**, sans nouvelle charte ni tableau de bord isolé.

Conventions :
- **En-tête** avec titre, courte aide contextuelle et action principale à droite (« Ajouter une chaîne », « Ajouter une source », « Lancer un import ») ; actions secondaires sous menu si nécessaire.
- **Bloc de filtres séparé** du bloc de données et espacement perceptible, comme les écrans harmonisés existants.
- Tableaux plein espace disponible, colonnes prioritaires stables, actions en fin de ligne représentées par icônes avec infobulles et noms accessibles ; pas de boutons texte répétitifs « Edit/Delete ».
- Formulaires de création/édition en **modales spacieuses** conformes à l'admin actuelle ; si fiche trop longue, préférer vue détaillée avec sections et modales d'édition ciblée. Pied de modale « Enregistrer / Annuler », avec état dirty et confirmation de fermeture.
- États de chargement, erreur, vide filtré, vide absolu et absence de permission distincts ; erreurs au champ et message général non technique.
- Les filtres/tableaux reviennent à leur état précédent après sauvegarde, sans réinitialiser la pagination de manière inattendue.
- Sur mobile admin : conteneurs non tronqués, barre de filtres empilée, tableau avec colonnes essentielles ou cartes de lignes ; éviter les modales dépassant la hauteur disponible.

## 2. Structure de navigation proposée

```
Administration LMN24
  └── Guide TV (ADMIN seulement, sans exposition publique)
        ├── Vue d'ensemble
        ├── Pays
        ├── Chaînes
        ├── Sources EPG
        ├── Imports
        ├── Traductions
        └── Statistiques
```

Une seule entrée « Guide TV » dans le menu latéral, puis sous-navigation visible de la section ; ne pas encombrer le menu de sept entrées globales. Le lien et les routes restent **inaccessibles hors ADMIN** ; ne jamais ajouter simultanément une entrée « Programme TV » au menu public avant GO.

### Exemple desktop — Vue d'ensemble (wireframe textuel)

```text
┌──────────── Menu admin LMN24 ──────────┬─────────────────────────────────────────────┐
│ Sources                               │ Guide TV                        [Aide]      │
│ Parser / Monitoring                   │ Administration des chaînes et programmes   │
│ Guide TV  ●                           │                                             │
│                                        │ [Vue] [Pays] [Chaînes] [Sources] [Imports]  │
│                                        │ [Traductions] [Statistiques]              │
│                                        │                                             │
│                                        │ ┌── Filtres ─────────────────────────────┐  │
│                                        │ │ Pays [Tous ▾] Période [7 jours ▾]    │  │
│                                        │ └────────────────────────────────────────┘  │
│                                        │                                             │
│                                        │ [Pays actifs] [Chaînes actives] [Qualité] │  │
│                                        │ [Jours couverts] [Dernier import]        │  │
│                                        │                                             │
│                                        │ ┌── Santé des imports par pays ─────────┐  │
│                                        │ │ France  ✓     Espagne  !     ...      │  │
│                                        │ └────────────────────────────────────────┘  │
└────────────────────────────────────────┴─────────────────────────────────────────────┘
```

Les valeurs ne sont volontairement pas simulées en pourcentages pour éviter de suggérer une qualité EPG inconnue.

## 3. Vue d'ensemble et statistiques

**Objectif :** identifier en moins d'une vue si la couverture est exploitable et quels pays nécessitent une action.

- KPIs : pays activés, chaînes publiables (pays **et** chaîne actifs), chaînes « Nouvelles / à vérifier », programmes réels disponibles, jours réellement couverts, dernier import, taux de succès. Le taux de couverture/qualité nécessite une formule fournie par Winston ; ne jamais afficher un 100 % fictif lorsque la couverture est inconnue.
- Filtres : Tous les pays / Pays actif, période des imports, état du dernier import.
- Bloc « À traiter » uniquement **dans l'administration Guide TV** : sources sans droits approuvés, chaînes découvertes à vérifier, pays en échec d'import, descriptions sans traduction. **Aucun badge sur le dashboard admin général, aucune notification mail**.
- Cartes récapitulatives cliquables vers l'écran filtré correspondant, sans action mutative en un clic.
- Statistiques : vue global/par pays et tendance courte des succès d'import, si historique fiable ; pas de reporting analytique historique complexe.
- États non mesurables : « Couverture non calculable » avec justification plutôt que zéro trompeur.

## 4. Pays — écran, modal et règles

### Liste Pays
| Colonne | Comportement |
|---|---|
| Pays | Nom localisé + code ISO2 ; drapeau secondaire, jamais seul |
| Publication TV | Actif / Inactif (distinct de l'activité des chaînes) |
| Fuseau de référence | IANA complet ; ex. Europe/Paris |
| Chaînes | Actives / total connu |
| Couverture EPG | Valeur fiable ou « Inconnue » |
| Dernier import | Horodatage ou « Aucun import » |
| Actions | Modifier (icône) ; activer/désactiver avec confirmation contextualisée |

Filtres : recherche, actif/inactif, couverture connue/inconnue ; remise à zéro explicite. L'activation du pays **ne change pas les états individuels des chaînes**. La désactivation interrompt seulement les futurs imports automatiques de ce pays, **pas les imports manuels**, ni les données existantes.

### Modal Modifier un pays
- Titre « Paramètres TV — [Pays] ».
- Champ `referenceTimeZone` en sélecteur IANA **validé**, jamais texte arbitraire ; aide explicitant que ce fuseau détermine la date d'accueil, distincte des variantes horaires de chaîne.
- Commutateur « Pays disponible dans le Guide TV » avec avertissement : les chaînes actives deviendront invisibles au public si le pays est désactivé ; leurs réglages resteront conservés.
- Enregistrer/Annuler, collision et sauvegarde concurrente gérées (`409` -> « Ce pays a été modifié, actualiser avant d'enregistrer »).
- Aucun bouton de suppression d'un pays du référentiel commun LMN24.

## 5. Chaînes — tableau de travail et fiche détaillée

### Liste Chaînes
Filtres : texte (nom ou n°), pays, statut (actif/inactif), « Nouvelle / à vérifier », EPG complet/partiel/indisponible, langue de diffusion ; statuts combinables.

Colonnes : logo/substitut, **numéro national effectif**, nom, pays, langues, variantes, statut, qualité de la grille, dernier import, actions. Ne jamais mélanger l'activation **par pays** avec l'identité globale : si une chaîne existe dans trois pays, la liste doit indiquer précisément **dans quel pays** chaque association est active.

Actions en en-tête : « Ajouter une chaîne ». En ligne : Voir/Modifier ; Activer/Désactiver selon pays avec confirmation ; éventuellement accéder à la grille ou aux identifiants externes. Éviter la suppression physique comme action standard.

### Fiche d'édition d'une chaîne — sections
1. **Identité :** nom, slug/identifiant, logo facultatif et contrôle qualité image.
2. **Diffusion par pays :** association pays, statut, numéro officiel, numéro attribué, **correction manuelle prioritaire** ; expliquer la provenance du numéro retenu.
3. **Langues de diffusion :** choix multiple indépendant de la langue de l'admin.
4. **Variantes :** code, nom, fuseau IANA, variante par défaut, pays concernés ; une seule variante nationale par carte publique, pas de doublon.
5. **Descriptions :** source/langue, description manuelle par locale, statut des traductions, provenance.
6. **Liens officiels :** site, X, YouTube, Facebook, Instagram, streaming officiel (lien et non player).
7. **État EPG :** sources rattachées, mapping des identifiants externes, couverture, dernière réussite, conflits de rapprochement à résoudre.

### Recherche automatique des liens et descriptions
Le bouton « Rechercher automatiquement » n'apparaît que si le site officiel est renseigné et vérifié. Processus explicite : lancer une recherche sur le domaine déclaré -> afficher **aperçu des valeurs trouvées avec URL source**, champ par champ -> cocher les suggestions à accepter -> Enregistrer. Si aucune proposition autorisée, afficher « Aucune information vérifiable trouvée ». **Ne pas écraser** des corrections manuelles sans confirmation particulière.

### États et conflits
- Nouvelle chaîne importée = **inactive par défaut**, même dans un pays actif ; entrée « À vérifier » bien visible.
- Numéro non disponible = numéro libre attribué sans collision ; conflit de numéro = message local « Ce numéro est déjà attribué à [chaîne] pour [pays] », bloquer sauvegarde et proposer correction manuelle.
- Résultat d'EPG ambigu = mapping « À rapprocher » : liste des alias externes et suggestion non validée ; publication d'une chaîne ne permet pas de publier une émission issue de droits insuffisants.
- Activation d'une chaîne = modal de synthèse « [Chaîne] deviendra visible dans [pays] si le pays est actif », avec champs obligatoires et avertissement EPG facultatif.

## 6. Sources EPG — droits, formats et priorités

Écran réutilisant les conventions **Sources** existantes sans confondre « Sources d'actualités RSS » et « Sources de programmes TV ».

Colonnes : nom, format XMLTV / XMLTV_GZIP / JSON, état, statut des **droits de republication**, pays couverts, priorité par pays, dernière réussite, erreurs et actions.

Filtres : pays, actif/inactif, format, droits (Non vérifié / Approuvé / Refusé / Expiré), échec récent. Action principale : « Ajouter une source EPG ».

Modal source : nom, URL source, format, état et politique de fréquence, références de licence/droits avec justificatif et date de revue, associations aux pays et priorités. Le champ URL doit afficher les erreurs de validation ; contrôle SSRF et limites de taille sont **des responsabilités serveur**, non simplement frontend.

**Blocage éditorial :** le statut « Approuvé » doit être justifié par une revue des droits ; activer techniquement une source ne suffit jamais à autoriser la publication des descriptions/images/programmes. Le panneau de couverture différencie « Données reçues » de « Données autorisées à publier ».

Priorités : dans un pays, classement de la source primaire à la secondaire ; sauvegarde atomique des modifications de priorité, validation de conflits, prévisualisation des effets avant confirmation. La source secondaire comble les lacunes sans effacer une correction validée.

## 7. Imports EPG — déclenchement, suivi et reprise

### Vue Imports
En-tête : bouton « Lancer un import ». Zone de filtres distincte : période, pays, déclencheur manuel/automatique, statut (en cours, réussi, partiel, erreur, interrompu). Zone de données : journal paginé avec date/heure, périmètre, jours demandés, état, sources, pays réussis/échoués, volume, durée et bouton détail.

### Modal « Lancer un import »
```text
┌─────────────────────────────── Lancer un import EPG ───────────────────────────┐
│ Périmètre :  (●) Tous les pays concernés   ( ) Un pays                       │
│ Pays : [France ▾]   (si « Un pays »)                                           │
│ Durée : [7 jours ▾] (1–7, plafond à confirmer Winston si besoin)              │
│ Résumé : x pays éligibles · sources y utilisables · imports manuels autorisés  │
│          même pour pays inactif (mention visible)                              │
│ [Annuler]                                           [Lancer l'import]         │
└────────────────────────────────────────────────────────────────────────────────┘
```

La modal ne doit pas promettre un pays/source « utilisable » avant contrôle des droits/configuration. Le bouton primaire se désactive pendant l'envoi ; après réponse 202, l'écran passe au détail de suivi. **Aucun double lancement** par double clic ; un verrou/conflit doit donner un message explicite et non générer deux imports.

### Détail de traitement
- Progression par périmètre (**pays × source**), état QUEUED/RUNNING/SUCCESS/PARTIAL/ERROR/INTERRUPTED.
- Compteurs fiables : programmes trouvés, ajoutés, corrigés, retirés, en conflit ; ne pas afficher zéro pour une métrique indisponible.
- Journal d'erreurs horodaté, messages exploitables, pas de secrets ni URL avec credentials.
- En cas d'échec partiel, **les résultats réussis restent conservés**, les grilles validées auparavant restent accessibles, liste des seules unités échouées + bouton « Relancer les échecs ».
- Périmètre inactif : non inclus dans la planification quotidienne, mais import **manuel** disponible.
- Horaires de planification : intégration au scheduler global seulement après revue technique ; aucun job automatique TV activé par défaut avant validation opérationnelle.
- Historique conservé 30 jours selon la politique Mary ; ne pas proposer suppression manuelle opaque.

## 8. Traductions — fournisseur sélectionné et édition multilingue

Une seule vue de configuration pour les fournisseurs, avec une zone distincte « Descriptions de chaînes ».

### Fournisseurs
- Tableau : nom/type, état, éligibilité **100 % gratuit sans carte bancaire**, droits revus, choisi/non choisi, dernière erreur. **Un seul fournisseur actif sélectionné manuellement**, jamais de bascule automatique.
- Configurer les références d'identifiants sans jamais montrer ni renvoyer les clés API en clair.
- Le changement de fournisseur n'efface **aucune traduction**. Confirmation « Les prochaines traductions utiliseront [fournisseur] ; les textes existants sont conservés ».
- Aucune interface de quota, compteur ou prévision de facturation.
- Si aucun fournisseur conforme n'est activé : bouton de traduction désactivé, motif explicite et possibilité d'édition manuelle.

### Descriptions par langue
Affichage huit langues LMN24 (FR, EN, DE, ES, PT, IT, RU, NL) avec statut :
`SOURCE` / `TRANSLATED` / `MANUAL` / `MISSING` / `FAILED` / `UNSUPPORTED`.

Actions : modifier description manuellement ; « Traduire dans toutes les langues » (envoi uniquement langues manquantes/échouées admissibles) ; prévisualiser les traductions obtenues ; valider les nouvelles valeurs ; relancer uniquement les langues restantes après **changement manuel** de fournisseur. Les descriptions déjà corrigées manuellement ne sont jamais écrasées par une réponse tardive d'une API.

UX erreur partielle : « 5 langues enregistrées, 2 à revoir, 1 non prise en charge » **si et seulement si** le backend fournit ces nombres. Liste d'actions par langue ; résultats réussis conservés.

## 9. Responsive et accessibilité administration

| Largeur | Modèle d'interface |
|---|---|
| >= 1200 px | Sidebar LMN24 persistante, header de section, filtres sur une ligne, tableaux lisibles, détails en modal large ou page |
| 768–1199 px | Sidebar existante adaptable, filtres sur deux lignes, colonnes secondaires repliées en détail |
| 320–767 px | Navigation admin existante en tiroir, sous-navigation Guide TV scrollable, filtres empilés, lignes en cartes ou tableau défilant dans son propre conteneur |
| Modales | Largeur <= viewport, hauteur max avec scroll interne, en-tête et boutons d'action toujours accessibles ; trap focus/ESC/retour focus |

Pas de dépendance à une couleur seule : badges avec mot entier. Tous les switches ont un vrai label, confirmation avant état critique, validation au champ, textes d'erreurs reliés par aria-describedby. Statuts asynchrones via aria-live non intrusif ; progressions en pourcentage uniquement si total fiable.

## 10. Carte des états UX et des erreurs

| Situation | Message attendu et action |
|---|---|
| 401/403 | Redirection/login ou accès interdit, jamais de données admin exposées |
| 409 modification concurrente | « Cet élément a été modifié ailleurs. Actualisez et réessayez. » ; ne pas écraser silencieusement |
| Pays désactivé | Badge Inactif, chaînes préservées, planification automatique désactivée pour ce pays |
| Chaîne découverte | À vérifier + Inactive ; action explicite de validation |
| Numéro en conflit | Bloquer, afficher pays + chaîne concernée, conserver saisie en brouillon |
| Source sans droits | Non approuvée, aucune donnée publiable malgré import technique |
| Source inaccessible | Erreur circonstanciée, dernière grille publiée inchangée |
| Import partiel | Sous-ensembles réussis conservés, relance ciblée seulement |
| Import déjà en cours | Message verrou/conflit, proposer accès au traitement en cours |
| Description modifiée manuellement | Badge Manuel, protection contre écrasement automatique |
| Traduction partielle | Langues réussies préservées, erreurs et manquants visibles |
| Statistique non calculable | « Indisponible » et cause, pas 0 % inventé |
| État vide filtré | « Aucun élément ne correspond à ces filtres » + réinitialiser |
| État vide absolu | Explication + action initiale appropriée (« Ajouter une source »…) |
| Erreur réseau | Garder les données du même périmètre en signalant leur ancienneté, bouton Réessayer |
| Pré-GO public | Admin accessible aux ADMIN, aucune route/donnée Guide TV exposée au public |

## 11. Matrice de recette UX-04

| ID | Scénario vérifiable | Résultat attendu |
|---|---|---|
| UX04-01 | Un visiteur anonyme ouvre l'admin TV | Refus serveur 401/redirect login |
| UX04-02 | Un utilisateur sans rôle ADMIN appelle l'API admin TV | Refus 403, aucun contenu |
| UX04-03 | Ouvrir l'admin TV | Sidebar et styles admin LMN24 cohérents, aucun menu public TV |
| UX04-04 | Filtrer une liste puis ouvrir/fermer la fiche | Filtres, tri et pagination restaurés |
| UX04-05 | Pays actif → inactif → actif | Chaînes et états individuels préservés |
| UX04-06 | Import manuel sur un pays inactif | Autorisé avec informations précises |
| UX04-07 | Modifier timezone d'un pays | Sélecteur IANA validé, impact expliqué |
| UX04-08 | Importer une chaîne inconnue | Inactive par défaut, statut À vérifier |
| UX04-09 | Activer une chaîne | Confirmation, champs minimaux, pays explicite |
| UX04-10 | Collision sur numéro d'un pays | Erreur au champ, pas de doublon |
| UX04-11 | Correction manuelle d'un numéro puis nouvel import | Correction conservée |
| UX04-12 | Recherche automatique des liens | Prévisualisation, valeurs manuelles conservées |
| UX04-13 | Une seule variante / plusieurs variantes | Contrôles pertinents, pas de variantes en doublon |
| UX04-14 | Source EPG sans autorisation de republication | Statut visible, publication empêchée |
| UX04-15 | Modifier la priorité des sources par pays | Ordre persistant, pas d'effacement de grille |
| UX04-16 | Import global sur 1–7 jours | Périmètre/résumé confirmé, une seule exécution |
| UX04-17 | Double clic sur Lancer | Une seule requête, retour d'état ou 409 |
| UX04-18 | Echec d'une source/pays | Statut PARTIAL, données précédentes valides |
| UX04-19 | Relancer seulement les erreurs | Scopes réussis non relancés ni écrasés |
| UX04-20 | Consulter journal import | Horodatages, compteurs, erreurs sans secrets |
| UX04-21 | Changer manuellement fournisseur de traduction | Aucun basculement implicite, données conservées |
| UX04-22 | Réussites et échecs de langues simultanés | Toutes réussites conservées, échecs identifiés |
| UX04-23 | Reprendre langues manquantes | Aucune traduction MANUAL écrasée |
| UX04-24 | Aucun fournisseur conforme gratuit | Traduction auto impossible, saisie manuelle possible |
| UX04-25 | Modification concurrente de fiche | 409 clair, brouillon conservé |
| UX04-26 | Stats insuffisantes | « Couverture inconnue », jamais statistique fictive |
| UX04-27 | 320/390/768/1440 px | Aucun débordement critique, actions accessibles |
| UX04-28 | Navigation clavier / lecteur d'écran | Modal accessible, focus rétabli, statuts annoncés |
| UX04-29 | Écrans en huit langues si admin localisée | Labels, erreurs et dates correctement traduits |
| UX04-30 | Avant GO explicite du propriétaire | Admin protégé, routes publiques, API et sitemap TV absents/refusés |

## 12. Arbitrages et préparation UX-05

1. **Mary/Winston** : méthode de calcul de qualité et de couverture EPG, seuil de suffisance pour `NO_START_IN_WINDOW`, définition précise des « programmes retirés ».
2. **Winston** : contrat de concurrence `expectedUpdatedAt` ou version de ligne, statut 409 et prévention du double lancement d'import ; droits exacts de chaque action admin.
3. **Mary** : définition du périmètre « Global » manuel (tous pays activés ou tous pays configurés) ; par défaut proposer tous pays actifs, en affichant explicitement le nombre de pays inactifs non couverts.
4. **Mary/Winston** : source « Approuvée » : preuve des droits d'exploitation, distinction données techniques / droits de republication selon type (programme, synopsis, images, logos).
5. **Sally** : écrans graphiques à produire en haute fidélité (vue d'ensemble, liste chaînes, fiche chaîne, détail import, traductions), y compris mobile et états partiels.
6. **Murat** : vérifier les rôles API et la non-exposition, la stabilité des filtres, la reprise après crash, les tests multilingues et la non-régression des parsers existants.
7. **John** : après UX-05, découper les écrans en US avec dépendances backend/Prisma/EPG, tests et gate de release indépendant.

**Conclusion Sally :** la structure UX de l'administration TV et les 30 critères de recette sont spécifiés. Il reste à approuver les maquettes graphiques et à réaliser la revue croisée BMAD UX-05. **Aucune page ni API Guide TV créée, aucune migration SQL exécutée et aucune recherche web externe menée pour ce livrable.**


---

## Mise à jour validée — 21/11/2026 — GTV-EPG-GLOBAL-01

**Cet arbitrage prévaut sur toute mention antérieure imposant une source EPG par pays.** Une source EPG est mondiale par défaut : création et activation sans association géographique obligatoire, inspection de son flux entier et conservation des IDs externes inconnus en `PENDING_REVIEW`. Une ligne facultative dans `tv_source_country` ne vaut qu'exception nationale explicite (priorité ou désactivation) et ne constitue plus une liste blanche.

Les imports restent partitionnés par pays/variante/date **au stade publication**, pas au stade téléchargement. Chaque source est téléchargée et décodée une seule fois par worker/run, même lorsqu'elle alimente plusieurs pays. La source ne sera publiée que si droits programmes approuvés et justifiés, mapping vérifié, attestation de couverture et protections transactionnelles existantes. Les pays ne pouvant être établis de manière fiable restent à vérifier ; ne pas en déduire une publication automatique.

**Transition technique :** le schéma candidat des 19 tables est conservé ; `tv_import_scope.country_id` reste obligatoire pour le traitement/publication national. La découverte indépendante des pays sans aucun pays TV configuré requiert une itération/migration ultérieure ; aucun drapeau réseau ni public n'a été ouvert automatiquement.

Référence normative : [BMAD — Décision de collecte EPG globale](./guide-tv-mondial-epg-collecte-globale-decision-2026-11-21.md). Traces Jira : [SCRUM-116](https://lmn24.atlassian.net/browse/SCRUM-116), [SCRUM-117](https://lmn24.atlassian.net/browse/SCRUM-117), [SCRUM-122](https://lmn24.atlassian.net/browse/SCRUM-122).
