# LMN24 — Guide TV mondial
## BMAD · Mary (Business Analyst) · Dossier de cadrage fonctionnel consolidé
**Date :** 2026-11-20  
**Statut :** cadrage fonctionnel validé avec réserves techniques/juridiques ; **aucun lancement public autorisé**  
**Destinataires :** Winston (architecture), Sally (UX), John (découpage Epic/US), Amelia (développement), Murat (QA).  
**Source :** arbitrages explicites du propriétaire LMN24 lors des ateliers Mary (novembre 2026).

> **EXIGENCE DE LIVRAISON BLOQUANTE — PAS DE PUBLICATION ANTICIPÉE.** Le bouton/lien « Programme TV » ne doit **pas** être visible dans la navigation, sur l'accueil, dans le pied de page, dans les préférences, ni via un autre point d'entrée public avant le **GO explicite du propriétaire LMN24**. La fin du développement, une CI verte, la complétion des US ou un déploiement ne constituent **jamais** un GO. Prévoir un garde-fou *désactivé par défaut* et des tests de non-exposition. Les futures routes publiques TV ne doivent pas être accessibles/indexables avant autorisation, y compris par URL directe ; les outils d'administration nécessaires aux tests peuvent rester protégés. Seul le propriétaire peut lever l'interdiction.

## 1. Vision et objectifs
Créer sur LMN24 un guide TV mondial, multilingue, mobile-first, consacré exclusivement aux **chaînes nationales gratuites accessibles par diffusion hertzienne terrestre** (équivalent TNT). Sont exclues les chaînes uniquement payantes, exclusivement satellitaires, exclusivement web et les stations purement locales/régionales. Une chaîne nationale peut toutefois avoir plusieurs variantes horaires de diffusion sans devenir plusieurs cartes nationales.
Le produit doit être extensible par pays, tenir compte des disponibilités réelles des sources EPG et ne jamais inventer de programmes. Les sources de données et leurs droits doivent être qualifiés avant republication.

## 2. Référentiels et navigation
### 2.1 Pays et langue
- Deux sélecteurs sur l'accueil du Guide TV : **Pays disponibles** et **Langues disponibles**.
- Pays initial : pays renseigné dans les préférences du visiteur, s'il existe et est disponible ; sinon correspondance de la langue d'interface : FR→France, DE→Allemagne, IT→Italie, NL→Pays-Bas, RU→Russie, EN→Royaume-Uni (Angleterre demandée, code pays GB), PT→Portugal, ES→Espagne.
- Pays non disponible : repli vers le pays associé à la langue puis pays disponible à définir de façon déterministe ; ne jamais afficher de pays désactivé.
- Le filtre langue porte sur les langues de diffusion des chaînes, indépendamment de la langue du site ; option « Toutes les langues » ; n'enregistrer aucune modification de préférences tant que le visiteur ne le demande pas explicitement.
- Références recommandées : codes pays ISO 3166-1, langues BCP 47, fuseaux IANA.
### 2.2 Quatre onglets, ordre immuable
1. **Chaînes** : toutes les chaînes actives du pays et de la langue sélectionnés, en cartes.
2. **En ce moment** : programme réellement en cours à l'instant de la visite (début ≤ maintenant < fin) ; disponible uniquement pour la date « Aujourd'hui », désactivé sur dates futures.
3. **Ce soir** : programmes dont le **début** est dans [20:30, 21:30] dans l'heure locale de la chaîne/variante.
4. **2ème partie** : programmes dont le **début** est dans [22:30, 23:30] selon la même règle.
**Onglet par défaut : « Ce soir ».** Les quatre onglets sont triés par **numéro de chaîne croissant** (pas par heure). En cas de collision : nom alphabétique.
- Navigation dates avec **date centrée**, flèches gauche/droite, places réservées aux flèches désactivées ; aujourd'hui à J+6, soit 7 jours. Si l'on quitte aujourd'hui alors qu'« En ce moment » est sélectionné, revenir à « Ce soir » est une proposition UX à confirmer, pas un arbitrage définitif.
- La date de référence à l'accueil dépend du **fuseau IANA de référence du pays**, administrable, même si des chaînes ont d'autres fuseaux.
### 2.3 Cartes et destinations
- Carte **chaîne** : clic ouvre la **grille complète de la journée locale sélectionnée**, de 00:00 à 23:59, avec navigation par date ± dans les 7 jours. L'ouverture depuis l'onglet Chaînes est initialement sur aujourd'hui. Chaque émission de la grille est cliquable.
- Carte **émission** : clic ouvre une **fiche détaillée** (titre, chaîne, date, horaires, durée, catégorie, description et image, informations saison/épisode si disponibles).
- Carte émission : **carré gauche** = logo de la chaîne, **numéro sous le logo** ; **centre sur trois lignes** = (1) heure de début + jauge de progression lorsqu'en cours, (2) titre, (3) catégorie + durée ; **droite** = image de l'émission.
- Image programme manquante : illustration locale générique **par catégorie** ; catégorie inconnue : illustration générique « Télévision ». Ne jamais la présenter comme une vraie photographie du programme.
- Le cas d'un logo absent doit être géré avec un substitut visuel sans empêcher la publication.
- Tous les onglets affichent **toutes les chaînes actives**, même en absence de programme, avec messages différenciés :
  * « Programme non disponible » : données EPG insuffisantes pour connaître l'émission ;
  * « Aucun programme débutant sur cette plage » : grille connue mais aucune émission ne commence dans la fenêtre « Ce soir » ou « 2ème partie » ;
  * grille d'une chaîne : blocs explicitant les **lacunes horaires**, sans inventer de programme ; une carte de substitution n'ouvre jamais de fiche d'émission fictive.
### 2.4 Fuseaux et variantes
- L'utilisateur choisit **Heure locale de la chaîne** ou **Mon heure locale** ; dernier choix mémorisé, et par défaut heure de la chaîne si absent.
- Ce mode change **seulement les heures affichées**, jamais l'appartenance aux onglets « Ce soir » / « 2ème partie », évalués en heure locale de la chaîne/variante.
- Stocker les instants UTC et les identifiants de fuseau IANA ; appliquer correctement les changements d'heure.
- Une seule carte publique par chaîne nationale. Plusieurs **variantes horaires nationales** (ex. Est/Ouest) possibles ; le visiteur choisit sa variante sur la fiche chaîne, pas via plusieurs cartes distinctes. Masquer le sélecteur si une seule variante.
- Un fuseau de référence par pays configurable dans l'administration pilote la **date** à l'accueil ; les grilles utilisent le fuseau de chaque variante. L'articulation des dates qui franchissent minuit doit être testée.
### 2.5 Recherche mondiale
- Barre de recherche globale, **indépendante** des filtres Pays et Langue.
- Deux sections : **Chaînes** et **Programmes**, ordonnées par **pays**, puis **numéro de chaîne croissant**.
- Saisie exclusivement numérique : correspondance **exacte** au numéro de chaîne dans tous les pays publiés ; texte : correspondances partielles insensibles aux majuscules et accents sur noms de chaînes, titres originaux, titres alternatifs connus et variantes d'écriture disponibles.
- **Pas** de traduction automatique des requêtes. Les variantes horaires d'une chaîne nationale sont regroupées en un résultat.
- Résultats limités aux pays et chaînes publiés ; les résultats d'émissions indiquent pays, chaîne, date et horaires selon le mode choisi. Clic vers grille de chaîne ou fiche d'émission correspondante.

## 3. Administration des pays et chaînes
### 3.1 Pays
- Activer/désactiver **un pays entier**, sans perdre ses chaînes ni changer leurs états individuels. Réactivation = retour des chaînes précédemment actives.
- Pays désactivé : pas de synchronisation **automatique**, mais imports **manuels** autorisés ; découvertes toujours enregistrées.
- Fuseau IANA de référence paramétrable par pays.
### 3.2 Chaînes
- Activer/désactiver chaque chaîne. La visibilité publique exige **pays actif ET chaîne active**.
- Une chaîne inconnue identifiée à l'import est **créée automatiquement en base, désactivée par défaut**, y compris si son pays est inactif ; statut « nouvelle / à vérifier » accessible dans l'admin.
- **Publication souple** : nom, pays et identifiant exploitable requis. Numéro attribué automatiquement si absent ; logo, description, liens et EPG restent optionnels, lacunes signalées.
- Numéros officiels prioritaires quand disponibles, sinon **numéro libre automatique par pays**, sans collision si possible. L'admin peut modifier le numéro ; ses corrections priment toujours sur les imports, avec possibilité de revenir à la valeur fournisseur. Tri numéro croissant.
- Une fiche chaîne possède : nom, logo, numéro, pays, langues, fuseau(x)/variantes, description(s), **site officiel**, **X/Twitter**, **YouTube**, **Facebook**, **Instagram**, **URL de la page de streaming officiel**.
- Bouton admin **Recherche automatique** depuis l'URL du site de la chaîne, analogue aux fiches « Sources » LMN24 : tentative d'extraction de description, réseaux et streaming, prévisualisation, correction et validation ; ne pas écraser les champs manuels et ne pas inventer les URL.
### 3.3 Pages publiques des chaînes
- Fiche complète : logo, nom, numéro, pays, langue, description si disponible, grille quotidienne, liens sociaux et site officiel si connus.
- Bouton **« Regarder en direct » uniquement sur la page de programmation de la chaîne**, si une URL officielle de streaming est renseignée ; ouvre la page officielle dans un nouvel onglet, pas de lecteur intégré, pas de promesse de disponibilité hors zone géographique. **Pas** de bouton sur carte/fiches émissions.

## 4. Sources EPG et imports
- Plusieurs sources EPG par pays, **activables** et classées par priorité ; formats XMLTV/XML compressé/JSON selon fournisseur.
- Fusion intelligente : privilégier la source prioritaire, combler les plages manquantes depuis les sources secondaires, dédoublonner, arbitrer les conflits de titres/horaires, conserver l'origine de chaque donnée et vérifier les chevauchements.
- Import automatique **quotidien des seuls pays actifs**, y compris chaînes désactivées du pays. Pas d'automatisme pour les pays inactifs.
- Import manuel : **global** ou **par pays**, sur un nombre de jours X (plafond cible 7 jours à confirmer pour l'interface) ; fonctionne aussi sur les pays désactivés.
- Mise à jour intelligente : programmes ajoutés, modifiés, supprimés, décalés ; conserver les autres lignes valides et les corrections administratives ; journaliser les changements.
- **Import partiel avec reprise ciblée** : les pays/sources réussis restent validés ; les pays en échec conservent leur dernière grille valide ; relance ciblée sans recommencer le monde entier.
- Contrôles d'intégrité : titre, chaîne, horaires, identifiants, doublons, overlaps ; les données optionnelles (image, description, catégorie) n'empêchent pas de publier un programme autrement valide.
- Pour une grille incomplète, publier les programmes connus et matérialiser les espaces sans données par « Programme non disponible » **sans fabriquer une émission dans la base**.
- Aucun import défaillant ne doit vider temporairement une grille valide ; privilégier préparation/validation puis publication atomique par périmètre, à spécifier par Winston.
- Historique des **programmes passés : 7 jours**, purge automatique ; programmation future : aujourd'hui à J+6 (jusqu'à 7 jours). **Journaux d'import : 30 jours**, purge indépendante.
- Dans l'admin Guide TV seulement : historique, compteurs, erreurs, relance. **Pas** de notification e-mail ni de badge sur le tableau de bord général.
- Statistiques **globales et par pays** : pays et chaînes actifs, programmes disponibles, jours réellement couverts, qualité des grilles, import le plus récent et taux de réussite ; pas de reporting avancé historique requis à ce stade.

## 5. Descriptions multilingues et traduction
- Descriptions des chaînes éditables par langue ; afficher celle de la langue de l'interface si connue, sinon la description d'origine ; les programmes restent dans leur langue EPG d'origine.
- Depuis une description source, bouton **« Traduire dans toutes les langues »** de LMN24.
- **Plusieurs fournisseurs d'API de traduction** configurables en admin ; **un seul fournisseur actif choisi manuellement**. Aucun moteur auto-hébergé imposé.
- Conditions non négociables : **100 % gratuit, aucune carte bancaire, aucune facturation ni risque de déclenchement payant**, qualification des droits d'utilisation avant activation.
- **Aucun suivi des quotas** (pas de compteur, marge, seuil, planification), **aucun basculement automatique de fournisseur**. En cas d'erreur/quota probable, l'admin change manuellement de fournisseur puis relance.
- **Échecs partiels :** garder les traductions obtenues, montrer les langues échouées/non prises en charge, autoriser la saisie manuelle, et relancer **uniquement les langues manquantes** après choix manuel d'un autre fournisseur ; ne jamais remplacer une traduction corrigée par l'admin sans son consentement.
- Prévisualisation et validation des traductions avant sauvegarde ; tracer provenance manuelle/automatique ; ne pas recopier la langue source comme si elle était traduite.
- Candidats étudiés : MyMemory et DeepL API Developer (gratuité, limites, licence à revalider au moment de l'implémentation). Aucune dépendance payante implicite ne doit être activée.

## 6. SEO / publication / accessibilité
- Référencement destiné aux **pages permanentes uniquement** : accueil Guide TV, pages pays actifs et pages chaînes actives à contenu suffisant ; **pas d'indexation des fiches d'émissions** ni des pays/chaînes inactifs.
- URLs permanentes et lisibles, métadonnées localisées, canonical/hreflang selon architecture SEO LMN24 ; données structurées seulement si justifiées et exactes.
- Recherche, cartes, onglets, sélecteurs, flèches, descriptions et boutons accessibles clavier/lecteur d'écran ; interface responsive mobile.
- Les droits de republication (grilles, synopsis, images, logos) sont **indépendants** de l'accès gratuit aux fichiers et de la licence du code des collecteurs. Aucune source non autorisée ne doit alimenter le site public.
- **Embargo absolu jusqu'au GO :** aucun bouton « Programme TV » ni autre entrée publique, aucun lien sitemap, aucune publicité/indexation de routes TV non lancées ; accès de test restreint en développement / administration. Déploiement ou fin des tests ≠ GO.

## 7. Principaux critères d'acceptation transverses
1. Aucun bouton, lien public, URL TV exposée via navigation ni sitemap avant le GO explicite. Test automatique bloquant pour cette condition.
2. Dans tous les onglets, chaînes visibles triées par numéro national croissant ; filtres Pays/Langue cohérents, onglet Ce soir par défaut.
3. Les dates J0…J+6 et les fuseaux IANA gèrent correctement passage de minuit et DST ; le mode horaire du visiteur ne change pas les programmes sélectionnés.
4. Chaque chaîne nationale n'a qu'une carte, même avec variantes horaires ; un clic ouvre sa grille complète, puis les émissions leur fiche.
5. Les lacunes EPG ne génèrent aucun faux programme ; messages distincts entre données absentes et aucun départ sur une plage connue.
6. Les nouvelles chaînes importées restent désactivées, quel que soit le statut de leur pays ; la désactivation du pays ne supprime rien.
7. Les modifications manuelles (numéro, contenu) survivent aux imports ; fusion et dédoublonnage résistants aux identifiants alternatifs.
8. Un import partiellement défaillant préserve les données valides ; relance ciblée et journaux consultables sans alerte externe.
9. Purges : programmes passés J-7 et journaux après 30 jours, sans effacer catalogues ni corrections.
10. Recherche mondiale : numérique exact, texte partiel multilingue sans traduction, regroupement chaînes/programmes.
11. Traduction : un fournisseur actif manuel ; 0 facturation ; pas de gestion de quota ; partiels conservés et relance seulement des manquants.
12. Pages SEO permanentes seulement, en respectant l'embargo et les droits de publication.
13. Tests en huit langues LMN24 existantes (FR, EN, DE, ES, PT, IT, RU, NL) ; ne pas confondre langue UI et langue d'émission.

## 8. Questions non bloquantes à spécifier par les agents
- Définir le mécanisme de rapprochement entre IDs EPG et chaînes, et les exceptions humaines en cas d'ambiguïté (Winston).
- Définir le calcul du taux de qualité EPG et ses seuils, le plafond X de l'import manuel et les priorités de choix des variantes (Winston + Mary).
- Préciser l'UX lorsque l'on passe à J+1 depuis « En ce moment » (Sally + Mary).
- Calibrer les protections de routes avant GO (middleware, flags serveur, tests, sitemap, indexation, outils de préproduction) (Winston + Amelia).
- Sélectionner les sources EPG et les API de traduction autorisées par licence/conditions, pays par pays (validation préalable).
- Établir les critères de performance de la recherche et de la grille mobile (Sally + Murat).

## 9. Séquence BMAD et politique de livraison
1. **Mary :** présent dossier constitue la base fonctionnelle validée, sans activation publique.
2. **Winston :** architecture, DB, traitement EPG, fusion, imports, qualité, gate de publication.
3. **Sally :** écrans publics et admin avec responsive/mobile, sans publication.
4. **John :** Epic et US Jira, critères de recette, dépendances, release gate.
5. **Amelia + Murat :** livraison incrémentale sur **main**, tests automatisés, audit CI/QA, **toujours masqué**.
6. **Propriétaire LMN24 :** après validation finale, donne séparément le **GO explicite** de publication. Aucune décision technique ou IA ne se substitue à ce GO.

**Références internes :** [BMAD existant](https://github.com/JeanLamora75/lmn24/tree/main/docs/BMAD) · [Application LMN24](https://www.lmn24.com/).

**Références externes de contrôle (non constitutives d'autorisations de republication) :** [XMLTV](https://github.com/XMLTV/xmltv) · [IPTV-org EPG](https://github.com/iptv-org/epg) · [IANA](https://www.iana.org/time-zones) · [Search Central](https://developers.google.com/search/docs/specialty/international/localized-versions).
