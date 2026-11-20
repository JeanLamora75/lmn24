# LMN24 — SCRUM-127 — Sally — Maquettes haute fidélité v1 et grille de validation

**Date :** 2026-11-20. **Statut :** première itération graphique — **NON VALIDÉE** par le propriétaire LMN24, pas de livraison applicative.  
**Sources :** [UX-01](./guide-tv-mondial-sally-ux01-accueil-responsive.md), [UX-02](./guide-tv-mondial-sally-ux02-fiches-chaines-programmes-grilles.md), [UX-03](./guide-tv-mondial-sally-ux03-recherche-mondiale-etats.md), [UX-04](./guide-tv-mondial-sally-ux04-administration.md), [UX-05](./guide-tv-mondial-sally-ux05-revue-croisee-bmad.md), [arbitrages Mary-Winston](./guide-tv-mondial-mary-winston-arbitrages-d01-d15.md).  
**Jira :** [SCRUM-127](https://lmn24.atlassian.net/browse/SCRUM-127).  
**Embargo :** aucune activation, route, navigation, API, sitemap ou migration TV avant accord explicite. La présence de liens « Guide TV » sur **certaines illustrations** ne constitue qu'une préfiguration de l'interface post-GO.

## 1. Travail graphique réalisé

Plusieurs explorations haute fidélité **statiques** ont été générées pour éprouver la direction graphique :
- Concept A : **accueil Guide TV + tableau de bord administratif**, juxtaposition desktop/mobile, palettes LMN24 blanc, bleu vif, bleu nuit, cartes claires, filtres et accès aux programmes.
- Concept B : variante de hiérarchie du même ensemble, accent sur navigation par onglets et tableaux administratifs.
- Concept C : **gestion des chaînes admin** avec menu latéral, filtres distincts, tableau, états Active/À vérifier/Inactive et action d'en-tête.
- Concept D : expérimentation de cartes-programmes plus visuelles, **non conforme** telle quelle aux quatre onglets et aux fenêtres précises Mary ; **non retenue pour implémentation**.

Ces images sont des *concepts de présentation*, pas des captures de l'application ni des données EPG réelles. Les contenus, noms de chaînes, taux, drapeaux et dates représentés sont fictifs. Les images elles-mêmes sont disponibles dans la conversation de réalisation ; pour les archiver durablement dans GitHub, elles devront être versées comme pièces binaires au dépôt ou dans un outil de design via un processus adapté. **Ne pas supposer qu'elles ont été ajoutées au dépôt par ce document.**

## 2. Direction graphique à conserver

- Réutiliser l'identité du site : `PublicHeader.module.css` reprend déjà le bleu `var(--bs-primary)`, les nuances `#0866e7` / `#3599ff`, le header blanc-bleuté et des pills arrondies ; thème sombre = tokens Bootstrap `data-bs-theme`.
- Guide public : format **cartes horizontales**, logo de chaîne carré avec **numéro en dessous**, texte central en trois lignes, image à droite, jamais affichage exclusivement « image en tête de carte ».
- Contrôles au-dessus des cartes dans l'ordre : recherche mondiale, Pays, Langue de diffusion, mode Heure de la chaîne/Mon heure locale, date centrée J0…J+6, puis **exactement quatre onglets** : Chaînes, En ce moment, Ce soir (défaut), 2ème partie.
- Admin : conserver le véritable `AdminShell` et les `AdminPageHeading` / `AdminFilterPanel` / `AdminDataPanel` existants, sans inventer une nouvelle navigation. Filtres dans un panneau séparé, actions en en-tête, tableaux denses mais lisibles, modales avec confirmation.
- Les **visuels fictifs** doivent être remplacés en conception produit par données de fixtures clairement identifiées, non par des taux EPG inventés.

## 3. Corrections nécessaires identifiées à la revue Sally/Murat

| Sujet | Point à corriger avant approuver |
|---|---|
| Certaines illustrations montrent un onglet ou des sections « En ce moment / Ce soir » simultanés | Mary impose **une seule vue à quatre onglets**, Ce soir par défaut |
| Fenêtres horaires illustrées | Ce soir = démarrages entre **20:30 et 21:30 inclus** ; 2e partie = **22:30 et 23:30 inclus** ; aucune émission commencée plus tôt n'est injectée |
| Illustration du menu public « Guide TV » | Interdite sur site réel **avant GO** ; garder uniquement dans prototype hors ligne |
| Cartes avec logos/images artificiels | Les valeurs sont démonstratives et **non** des données autorisées/licenciées |
| Cartes EPG indisponible / aucun départ | Conserver les deux messages exacts, uniquement sur couverture prouvée pour « aucun départ » |
| KPI « couverture 96 % » ou nombres de programmes | Chiffres fictifs ; ne pas utiliser pour la QA ou l'estimation de couverture réelle |
| Admin mobile | Les panneaux filtres/données et modal d'édition doivent encore être déclinés et testés à 320/390 px |
| Fiches détaillées / recherche | La direction artistique est établie, mais **maquettes détaillées UX-02 et UX-03 encore à produire** |
| Huit langues | Textes longs, RU, thèmes clair/sombre, focus et lecteur d'écran à tester sur rendu effectif |

## 4. Liste des écrans attendus pour clore SCRUM-127

- [x] Concept visuel Guide TV accueil desktop.
- [x] Concept visuel Guide TV accueil mobile.
- [x] Concept visuel admin tableau de bord desktop.
- [x] Concept visuel admin mobile.
- [x] Concept visuel admin liste chaînes et panneau filtres.
- [ ] Fiche chaîne complète et grille chronologique (desktop + mobile, variantes).
- [ ] Fiche émission complète (desktop + mobile).
- [ ] Résultats recherche mondiale et états partiels (desktop + mobile).
- [ ] Administration : pays, sources EPG, modale import, détail de run PARTIAL, traductions avec erreurs, statistiques sans donnée fictive, modales responsive.
- [ ] Thèmes sombre/clair, huit locales dont russe, 320/390/768/1440 px avec contrôles accessibilité.
- [ ] Correction de tous les écarts fonctionnels relevés dans les concepts préliminaires.
- [ ] **Approbation explicite du propriétaire** des maquettes — nécessaire avant clôture de SCRUM-127.

## 5. Prochaine itération

Prioriser une **planche conforme UX-01**, puis UX-02 et UX-03. Faire valider au propriétaire la densité des cartes, la mise en page mobile et la séparation des filtres avant d'étendre au reste des sept vues administratives.

**Conclusion Sally :** direction visuelle suffisamment tangible pour avis initial, **SCRUM-127 EN COURS sur le fond et non terminée**. Aucun écran public ni fonctionnalité TV modifié ou ouvert.


## 6. Deuxième itération — direction visuelle validée, prototype autonome

**Retour explicite du propriétaire : « Oui je valide, continue »** après présentation de la direction graphique bleu/blanc, cartes horizontales et séparation des filtres. **Cette validation porte sur l'identité graphique générale**, et non sur toutes les maquettes finales ni sur l'ouverture du Guide TV.

### Prototype hors ligne produit

Un fichier autonome `LMN24_GuideTV_Sally_SCRUM-127_prototype.html` a été créé comme pièce téléchargeable de la conversation, **non ajouté à ce dépôt**. Ses caractéristiques :
- Navigation interne entre accueil, fiche chaîne, fiche émission, recherche mondiale et administration ;
- Accueil : filtres pays/langue/heure, J0…J+6, quatre onglets corrects dans l'ordre de Mary, Ce soir par défaut, cartes horizontales avec n° sous logo ;
- Fiche chaîne : descriptif, variante, timeline avec lacune, lien vers fiche émission ;
- Recherche : démonstration de numéros exacts et deux familles de résultats ;
- Administration : navigation vers sept rubriques (Vue d'ensemble, Pays, Chaînes, Sources EPG, Imports, Traductions, Statistiques), états partiels et données de démonstration ;
- Thème clair/sombre, réagencement CSS desktop/mobile, option de simulation de libellés EN/RU limitée à un texte de recherche ;
- Aucune dépendance réseau ni intégration runtime du Guide TV, aucun accès BDD. Le contenu et les KPI sont explicitement fictifs.

**Vérifications effectuées :** présence des cinq écrans et des sept rubriques, contrôle syntaxique JavaScript avec `node --check`. **Non effectués :** recette Playwright visuelle, lectorat d'écran, validation complète des huit locales et les maquettes individuelles de chaque modal.

### Revue Sally et Murat — réserves explicites

- Les images exploratoires générées présentent encore certaines compositions divergentes, elles ne sont **pas** une base d'implémentation littérale.
- Le prototype autonome permet de valider la hiérarchie de navigation et la densité des écrans mais reste **une simulation** (pas d'API réelle, données inventées, boutons de démonstration).
- La direction graphique est **validée** par le propriétaire, mais l'acceptation **écran par écran** de SCRUM-127 reste à obtenir.
- Les captures et fichiers binaires ne sont pas archivés dans GitHub à ce stade ; les preuves visuelles sont dans la conversation.
- La publication du Guide TV reste **strictement interdite** sans un GO distinct.

**Prochain point :** faire valider la structure du prototype et produire les variantes détaillées des pages administration (modales et erreurs), puis tests vrais 320/390/768/1440 px et huit locales. SCRUM-127 reste ouverte.


## 7. Validation du propriétaire et vérification navigateur — 20 novembre 2026

**Décision utilisateur :** « Ok je valide le prototype, continuons ». Cela vaut **validation explicite de la structure globale du prototype HTML autonome**, en complément de l'approbation précédente de sa direction graphique (bleu/blanc, cartes horizontales et blocs filtres distincts). Cela **ne vaut ni approbation finale de chacun des sept formulaires administratifs, ni GO public, ni autorisation de migrer la base**.

**Contrôles réellement exécutés sur le prototype hors ligne** avec Chromium headless + Playwright Python, HTML chargé depuis le fichier autonome via `page.set_content` (l'ouverture directe `file://` est bloquée par la politique du navigateur de test) :

| Viewport | document.scrollWidth | fenêtre.innerWidth | Erreurs JS non interceptées | Résultat |
|---|---:|---:|---|---|
| 320 px | 320 | 320 | 0 | PASS structurel |
| 390 px | 390 | 390 | 0 | PASS structurel |
| 768 px | 768 | 768 | 0 | PASS structurel |
| 1440 px | 1440 | 1440 | 0 | PASS structurel |

Contrôles additionnels : présence des quatre onglets dans l'ordre `Chaînes / En ce moment / Ce soir / 2ème partie` ; présence des sept rubriques administration ; ouverture de la vue admin sans exception JS.

**Limitations :** ce sont des contrôles du **prototype fictif autonome** et **non des tests E2E du frontend LMN24**. Aucun contrôle de contraste WCAG complet, parcours clavier/lecteur d'écran, régression sur les huit locales ni test de toutes les modales n'a été effectué. La recette de sécurité des vraies routes Next/Nest ne peut pas être déduite de ce résultat.

**État SCRUM-127 :** validation de principe acquise, mais la story n'est pas complètement homologuée tant que les déclinaisons de formulaires, l'i18n complète et l'accessibilité n'ont pas été éprouvées. Un développement de la protection publique `SCRUM-113` peut être lancé **en parallèle**, sans considérer cette validation comme une permission de rendre le Guide TV public.
