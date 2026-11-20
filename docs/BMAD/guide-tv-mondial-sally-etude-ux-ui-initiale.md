# LMN24 — Guide TV mondial — Sally — Étude UX/UI initiale v0.1

**Date :** 2026-11-20  
**Rôle BMAD :** Sally (UX/UI)  
**Statut :** étude de conception commencée ; parcours et spécifications d'écrans, **pas de maquettes finales approuvées ni de développement**  
**Références :** [Mary — cadrage validé](./guide-tv-mondial-mary-cadrage-fonctionnel.md), [Winston — contrats API et EPG](./guide-tv-mondial-winston-contrats-api-fusion-epg.md), [Winston/Murat — revue technique](./guide-tv-mondial-winston-murat-audit-privileges-migration-candidate.md)  
**Embargo absolu :** aucun lien, menu, route, recherche publique ou sitemap Guide TV ne peut être exposé avant **GO explicite du propriétaire de LMN24**. L'interface d'administration protégée peut être développée/testée sans GO public.

## 1. Intention de design

Le Guide TV doit permettre à un visiteur de répondre en quelques gestes aux questions : *quelles chaînes nationales gratuites sont disponibles dans ce pays ?*, *qu'est-ce qui passe maintenant ou ce soir ?*, *à quelle heure locale ?* et *où voir la grille complète ?*

### Principes
1. **Lecture immédiate** : choix du pays et de la langue de diffusion, date, onglets et cartes très lisibles ; l'émission doit être plus visible que les métadonnées.
2. **Mobile-first sans appauvrissement** : même information sur mobile, mais contrôle repliable quand nécessaire ; aucune image imposant un défilement horizontal.
3. **Identité LMN24** : reprendre typographie, largeur, espacements et composants de navigation du site plutôt que créer un second produit visuel.
4. **Vérité des données** : différencier « Programme non disponible » de « Aucun programme débutant sur cette plage » ; jamais de faux titre, durée, image ou lien.
5. **Contexte mondial explicite** : numéro lié au pays, horaires selon la variante, affichage horaire configurable sans déplacer l'émission d'un onglet.
6. **Accessibilité** : tous les contrôles au clavier, états et annonces compréhensibles au lecteur d'écran ; aucune signification réservée aux couleurs.
7. **Actions réversibles** en administration : prévisualiser avant enregistrer, ne pas écraser les modifications manuelles, reprendre les imports échoués.

## 2. Navigation publique proposée (après GO seulement)

```
LMN24 > Programme TV                         [Recherche mondiale…]
                    Pays [France v]  Langue de diffusion [Toutes v]
                    Affichage horaire [Heure de la chaîne v]

                 [<]  Vendredi 20 novembre 2026  [>]
     [Chaînes] [En ce moment] [Ce soir • actif] [2ème partie]

  [logo + nº]   20:45  •  Titre du programme          [visuel]
                 Catégorie · 105 min

  [logo + nº]   Programme non disponible             [illustration neutre]

  [logo + nº]   Aucun programme débutant sur cette plage
```

Ce wireframe textuel est illustratif ; il ne certifie aucun programme réel.

### Organisation
- **Barre de contrôle principale** : Pays, langue de diffusion et mode horaire ; ces éléments sont indépendants de la langue de l'interface LMN24.
- **Date centrée**, deux flèches occupant une largeur fixe (même lorsqu'elles sont indisponibles), plage J0…J+6 basée sur le fuseau du pays choisi.
- **Onglets dans l'ordre définitif** : Chaînes, En ce moment, Ce soir, 2ème partie. **Ce soir sélectionné à l'ouverture.**
- **Cartes par numéro national croissant** ; collisions départagées par nom alphabétique.
- **Recherche mondiale séparée des filtres courants** ; lorsqu'elle est ouverte, toujours préciser que la recherche couvre tous les pays actifs.

### Interaction de la date
- J0 : flèche gauche désactivée mais espace conservé.
- J+6 : flèche droite désactivée mais espace conservé.
- Au passage J0 -> J+1 depuis « En ce moment », **proposition Sally** : basculer automatiquement sur « Ce soir » et annoncer « En ce moment est disponible uniquement aujourd'hui ». À valider avec Mary ; ne pas introduire la logique sans décision.
- Si le pays change, recalculer J0 selon son fuseau IANA et conserver le numéro de jour choisi seulement s'il reste valide ; ne pas enregistrer les préférences sans action explicite.

## 3. Composants de cartes publiques

### 3.1 Carte d'émission
- **Gauche** : carré réservé au logo (ou substitut accessible), numéro de chaîne **sous** le logo.
- **Centre, trois lignes** : (1) heure et jauge de progression seulement si émission en cours ; (2) titre prioritaire, 2 lignes maximum en mobile avec titre complet accessible ; (3) catégorie et durée lorsque connues.
- **Droite** : visuel d'émission avec ratio stable, image catégorie locale si absent, image TV générique quand catégorie inconnue. Les visuels de substitution sont clairement génériques.
- Sur mobile étroit : réduire le logo et le visuel de façon proportionnée ; garder l'heure, le titre et l'information de chaîne toujours visibles.
- Clic sur carte **avec vraie diffusion** -> fiche émission ; focus visible et cible tactile suffisante ; ne pas imbriquer d'autres liens dans la carte.

### 3.2 Carte de chaîne (onglet Chaînes)
Logo, nº, nom, langues de diffusion, état informatif éventuel. Clic -> page chaîne et grille **d'aujourd'hui** (même si le visiteur a sélectionné J+N sur la page d'accueil), conformément à Mary. Une seule carte même si plusieurs variantes ; masquer le sélecteur de variantes tant qu'une chaîne n'en a qu'une.

### 3.3 Carte de substitution
- `EPG_UNAVAILABLE` : « Programme non disponible » + phrase d'explication optionnelle courte, aucun horaire fictif, **aucun clic vers une émission fictive** ; un lien distinct peut ouvrir la page permanente de la chaîne.
- `NO_START_IN_WINDOW` : « Aucun programme débutant sur cette plage », **uniquement** si le backend sait que la plage est suffisamment couverte ; sinon `EPG_UNAVAILABLE`.
- Erreur réseau générale : message au niveau de la vue avec « Réessayer » sans vider brusquement toutes les cartes de la grille précédente.

## 4. Parcours publics — fiches

### Page chaîne et grille quotidienne
- En-tête : logo/nom/numéro/pays, langues de diffusion, description dans langue UI si disponible sinon description source ; site et réseaux officiels seulement s'ils sont connus.
- **« Regarder en direct » seulement ici**, si `officialLiveUrl` existe, ouvre le site officiel dans un nouvel onglet ; jamais de player intégré, jamais de promesse de disponibilité.
- Choix de variante horaire si >1, avec fuseau explicitement indiqué.
- Navigateur de date J0…J+6, grille sur **la journée locale 00:00–23:59 de la variante** ; programmes qui traversent minuit affichés selon leur intersection, heures réelles conservées et explicitées.
- Timeline/grille verticale chronologique, chaque programme vrai ouvre sa fiche. Lacunes visibles sans titre d'émission ni clic trompeur.
- Fiche émission : chaîne, titre, date, début/fin, durée, catégorie, description, image, saison/épisode si disponibles ; absent = champ omis, pas « non renseigné » répété.

### Recherche mondiale
- Champ indépendant du Pays/Langue courants, consigne « Rechercher une chaîne, un numéro ou un programme dans tous les pays disponibles ».
- Une requête numérique seule fait une **égalité exacte** sur nº ; texte = correspondances partielles nom/titre original/titres alternatifs, sans traduction de requête.
- Résultats organisés **Chaînes** puis **Programmes** ; tri pays puis numéro national, variantes horaires regroupées.
- Une ligne résultat affiche toujours pays et numéro, afin de rendre intelligibles les doublons internationaux.
- États : aucun résultat, chargement, résultats partiels, erreur ; pagination « Voir plus » pour les deux sections indépendantes.
- Contrôle d'accessibilité : annonce du nombre de résultats, gestion du focus lorsque l'on soumet la requête ; URL/état de recherche partageables **uniquement après GO**.

## 5. Découpage responsive proposé

| Surface | Composition |
|---|---|
| Mobile <= 640 px | Contrôles en 1 colonne ou filtres compacts sur 2 lignes ; barre date fixe et centrée ; onglets accessibles sans troncature du sens ; cartes horizontales condensées et visuel réduit |
| Tablette 641–1024 px | Filtres regroupés, cartes en colonnes si espace suffisant, grille de chaînes compacte |
| Desktop > 1024 px | Largeur alignée à LMN24, filtres sur une ligne quand possible, cartes sur 2 colonnes seulement si la lecture du titre reste excellente |
| Très petits écrans | Préférer scroll contrôlé **des onglets** à réduire leur texte jusqu'à illisibilité ; ne jamais faire déborder toute la page horizontalement |

Les seuils sont **provisoires** : les choix réels doivent suivre les breakpoints déjà définis dans les CSS LMN24. Contrôler 320, 360, 390, 768, 1024, 1440 px.

## 6. Admin — arborescence et travail quotidien

**Entrée administration : « Guide TV »** (accès ADMIN uniquement), avec onglets/pages :
1. **Vue d'ensemble** — KPI : pays actifs, chaînes actives, couverture EPG, jours couverts, dernier import, taux de réussite ; filtres Global / Pays.
2. **Pays** — tableau activé/inactif, pays, fuseau IANA de référence, nº chaînes actives, couverture, source principale ; action Modifier en modal ; désactiver pays n'efface pas les chaînes.
3. **Chaînes** — recherche, pays, statut, langues, « Nouvelles / à vérifier », colonnes nº/logo/nom/pays/variantes/EPG/état ; création/édition en modal/détail.
4. **Sources EPG** — format, URL, droits, pays couverts, priorité par pays, dernier succès, statut actif ; impossible d'activer comme source publique sans droits approuvés.
5. **Imports** — action « Importer » en en-tête, global/pays, 1–7 jours ; suivi progressif, compteurs, états PARTIAL/ERROR, relance ciblée des scopes échoués.
6. **Traductions** — fournisseurs configurables, sélection manuelle unique, éligibilité gratuite confirmée ; pas de quota ; descriptions par langue et « Traduire toutes les langues ».
7. **Statistiques** — global/par pays, qualité/couverture sur période appropriée (sans reporting analytique historique complexe).

### Conventions d'administration
- Une **zone de filtres distincte** de la zone de données, en haut de page.
- Barre d'en-tête avec titre, aide contextuelle et action primaire « Ajouter / Importer » selon écran.
- Tableaux : filtres mémorisés pendant le retour d'une fiche, tri stable, pagination, état vide explicatif.
- Création/édition : **modale large** alignée à la charte admin LMN24, labels visibles, erreurs au champ, boutons Enregistrer / Annuler, confirmation avant perte de modifications.
- Statuts neutres mais explicites : « Actif », « Inactif », « Nouveau », « À vérifier », « Réussi », « Partiel », « Échec » ; légende textuelle et aide sur les états.
- Les opérations irréversibles (suppression d'un numéro manuel, désactivation pays, remplacement description) nécessitent une confirmation contextualisée ; aucune suppression destructive d'une grille valide.

### 6.1 Fiche de chaîne admin
Sections coordonnées : **Identité**, **Diffusion et numéros par pays**, **Langues**, **Variantes/fuseaux**, **Description multilingue**, **Liens officiels** et **État EPG**.
- Distinguer visuellement « nº officiel », « nº attribué » et « correction manuelle » ; action « Revenir à la valeur source » après confirmation.
- Fonction « Recherche automatique » depuis site officiel : aperçu avant enregistrement, champ par champ, preuve/source visible ; choix manuel des modifications. Ne jamais auto-écraser les valeurs MANUAL.
- Prévenir en cas de numéro déjà attribué dans le pays ; indiquer chaîne conflictuelle et possibilités sans proposer de doublon actif.

### 6.2 Imports EPG
- Modal déclenchement : **Global / Un pays**, pays (si un), nombre de jours 1…7, résumé du périmètre, bouton « Lancer l'import ».
- Liste historique : date, déclencheur, périmètre, statut, pays réussis/échoués, émissions créées/modifiées/supprimées, durée, action Détails.
- Détail : progression des étapes, sources/pays, erreurs lisibles, provenance, liens d'aide ; bouton **« Relancer uniquement les échecs »**.
- Un nouvel import ne doit pas masquer les anciennes grilles pendant le travail ; en cas d'échec partiel, expliquer précisément ce qui reste affiché.
- Pas de badge sur le dashboard général LMN24, pas d'e-mail d'alerte (décision Mary).

### 6.3 Traductions
- Sélection d'un fournisseur unique **manuellement**, avec statut d'éligibilité « gratuit sans carte bancaire » et droits revus ; aucun compteur de quota, aucun basculement automatique.
- Panneau source/8 langues : `Source`, `Traduit`, `Manquant`, `Erreur`, `Manuel`.
- « Traduire dans toutes les langues » n'envoie que les descriptions absentes/non protégées ; résultat PARTIAL affichant celles réussies et celles échouées, saisie manuelle possible ; prévisualiser avant valider.
- Après changement manuel de fournisseur, action « Relancer les langues manquantes » ; ne jamais écraser une traduction MANUAL.

## 7. Matrice des états et accessibilité

| État | Texte/interaction attendu | Test UI |
|---|---|---|
| Pays désactivé | Jamais dans sélecteur public ; visible admin comme inactif | Pages directes refusées |
| Chaîne importée inconnue | Inactive, badge « À vérifier » uniquement admin | Aucune fuite publique |
| EPG inexistant | « Programme non disponible » | Aucun faux lien émission |
| Grille connue mais aucun départ ce soir | « Aucun programme débutant sur cette plage » | Programme en cours non substitué |
| Image indisponible | Illustration générique par catégorie | Texte alternatif pertinent |
| Logo indisponible | Bloc neutre avec nom chaîne | Aucun pictogramme cassé |
| Date future + En ce moment | Onglet désactivé et explication | Retour « Ce soir » à confirmer |
| Changement de mode horaire | Valeurs affichées converties, onglets inchangés | DST et traversée minuit |
| Import PARTIAL | Pays/sources réussis conservés, échecs détaillés | Reprise ciblée |
| Traductions PARTIAL | Réussies présentes, manquantes identifiées | Aucune suppression MANUAL |
| Recherche globale numérique | Exact numéro tous pays actifs | Pas de recherche « contient 2 » |
| Aucune donnée recherche | Message non alarmiste + modifier requête | Clavier et lecteur d'écran |

Accessibilité : structure H1/H2, labels persistants, rôles tablist/tab/tabpanel, aria-selected, annonce polie des résultats et statuts d'import, focus cohérent en modales, échappement, contraste WCAG AA, supports réduction des animations, direction/langue des textes (notamment RU).

## 8. Internationalisation

Huit langues de LMN24 : FR, EN, DE, ES, PT, IT, RU, NL. Prévoir catalogues UI par locale et textes des programmes originaux (pas de traduction automatique). La langue de diffusion est un **filtre différent** de celle de l'interface. Dates et heures formatées par locale, fuseau IANA et convention 12/24 h appropriée ; ne pas mélanger "aujourd'hui" du navigateur et du pays.

L'affichage « Mon heure locale » utilise le fuseau IANA du navigateur ; sauvegarder le **dernier mode horaire** sans écrire une préférence Pays/Langue non explicitement enregistrée.

## 9. Questions ouvertes à arbitrer (ne pas prendre une proposition pour une décision)

1. **Mary + Sally** : passage de « En ce moment » à une date future : proposer retour automatique à « Ce soir » avec annonce.
2. **Mary + Winston** : lorsqu'une variante horaire tombe sur un autre jour civil que le pays de référence, règle exacte de date par défaut en détail.
3. **Mary** : pays de secours déterministe si aucune préférence ni pays associé à la locale n'est actif ; proposition : premier pays actif trié par nom localisé, mais ne pas valider sans arbitrage.
4. **Sally + Winston** : l'API expose `NO_START_IN_WINDOW` seulement sur plage suffisamment couverte ; définir le seuil/indicateur de confiance, sinon EPG_UNAVAILABLE.
5. **Sally + Murat** : choisir si recherche instantanée après 2–3 caractères ou soumission explicite ; proposition initiale : soumission explicite pour mobile, debounce pour desktop après essais.
6. **Sally** : préciser densité et navigation des 4 onglets sur 320 px sans horizontal overflow, puis maquettes desktop/tablette/mobile.
7. **Winston** : uniformiser la gestion des URLs officielles et privilégier l'ouverture directe du site sans tracking non nécessaire.

## 10. Plan de conception pour la suite

- **Lot UX-01** : wireframes haute fidélité *accueil Guide TV* (desktop, tablette, mobile 320/390px), cartes émission/chaîne, filtres et dates.
- **Lot UX-02** : fiches chaîne et programme, grilles J0–J+6, variante et fuseaux.
- **Lot UX-03** : recherche mondiale, états de chargement/erreur/absence EPG et accessibilité.
- **Lot UX-04** : administration pays/chaînes/sources EPG/imports/traductions/statistiques, composants et modales.
- **Lot UX-05** : revue croisée Mary/Winston/Murat, tests de parcours et critères de recette UX pour John.

**Aucun développement ni route publique n'a été créé. Aucune recherche web externe n'a été engagée.**
