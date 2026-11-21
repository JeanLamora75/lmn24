# LMN24 — SCRUM-123 / GTV-10 — Traductions TV sans perte

Date : 2026-11-21. Réalisation sur `main`, sous embargo public strict. Aucun schéma ni donnée de production migrés.

## Modèle et statut

Le modèle candidat TV existant possède `tv_channel_description` (origine `SOURCE`, `MACHINE`, `MANUAL`) et `tv_translation_attempt` (`SUCCESS`, `ERROR`, `UNSUPPORTED`). L'interface expose `TRANSLATED` pour l'origine SQL `MACHINE`, et `MISSING`/`FAILED`/`UNSUPPORTED` pour les langues absentes selon la dernière tentative.

Les langues cibles fixes sont FR/EN/DE/ES/PT/IT/RU/NL. L'absence d'une traduction n'est jamais affichée comme une chaîne vide validée.

## Flux implémenté

1. ADMIN choisit **manuellement** un fournisseur déjà sélectionné, actif et approuvé (gratuité + droits). Aucune permutation automatique, aucun quota, aucune information de paiement ni clé exposée.
2. Le backend n'appelle que `LIBRETRANSLATE_LOCAL` à l'adresse **strictement** `http://127.0.0.1:<port>/translate` configurée sur le serveur via `TV_TRANSLATION_LOCAL_ENDPOINT`, et seulement si `TV_TRANSLATION_LOCAL_ENABLED=true`. Le port est fixé par l'exploitant ; aucun URL arbitraire fourni par le navigateur. Redirections bloquées, requêtes bornées, délai d'attente de 8 s par langue et sortie bornée à 10 000 caractères. Pas de service externe automatiquement choisi ou déclaré gratuit.
3. Seules les descriptions **rédigées manuellement** sont autorisées comme entrée tant que la provenance des droits des descriptions SOURCE n'est pas traçable dans le schéma candidat.
4. Preview uniquement pour les cibles `MISSING` ou `FAILED`, hors langue source, et jamais pour celles déjà renseignées, `MANUAL` ou `UNSUPPORTED`. Les succès sont rendus au navigateur mais **non persistés**.
5. Les réponses échouées sont enregistrées dans le journal des tentatives (`ERROR`/`UNSUPPORTED`), sans détail de retour fournisseur ni secrets. La réponse peut être `PARTIAL` avec traductions réussies conservées dans la prévisualisation.
6. Les propositions de prévisualisation sont conservées **en mémoire serveur** pour 10 minutes, au maximum 100 aperçus par instance. Aucun brouillon durable n'est créé ; un redémarrage ou un changement d'instance invalide l'aperçu (échec explicite, aucune perte de description existante).
7. Après sélection des langues et consentement explicite, l'approbation effectue une transaction : elle revérifie le fournisseur, la version du texte source et exécute exclusivement des `INSERT ... ON CONFLICT DO NOTHING`. Une correction manuelle ou une traduction créée entre-temps n'est **jamais écrasée** ; l'API renvoie `saved` et `conflicts` et éventuellement `PARTIAL`.
8. Le changement de chaîne, de langue source, de fournisseur ou la modification manuelle invalide l'aperçu. Les appels frontend sont annulés via `AbortController`.

## Fournisseurs et configuration

L'administration peut enregistrer un **brouillon local inactif**, sans aucune attestation préremplie. Un seul fournisseur sélectionné à la fois, selon le mécanisme introduit dans SCRUM-122. L'activation et les attestations de gratuité **totale sans carte bancaire** et de droits restent sujettes à une **vérification humaine documentée**. L'existence d'un adaptateur open source ne prouve ni l'absence de coût d'hébergement ni la licence des contenus. Aucun fournisseur n'est configuré, vérifié ou activé automatiquement par cette story.

## Sécurité

- Toutes les routes sont ADMIN uniquement, NestJS 401/403, `TV_CATALOG_ADMIN_ENABLED` strictement activé, proxy Next.js allowlist et cache no-store.
- Aucun accès au Guide TV public n'est rendu possible par ces endpoints.
- Aucun payload ne contient une clé, un jeton de fournisseur ou une URL EPG avec credentials. Les erreurs de traduction sont volontairement génériques.
- Les corrections MANUAL et les traductions antérieures ne sont jamais supprimées lors d'une réponse partielle ou d'une relance.

## Recette restante / limites de livraison

- Prouver formellement l'éligibilité gratuite sans carte bancaire et les droits d'un adaptateur réel, déployer un service local de traduction réellement conforme, puis effectuer une **recette d'intégration isolée** avant activation (aucun appel de production ici).
- La traçabilité des droits pour les textes SOURCE n'existe pas encore au niveau par-description ; leur traduction est donc volontairement refusée, plutôt qu'envoyée sans autorisation.
- Déterminer en revue Winston/Mary/Murat le devenir de D12, non arbitré.
- Étendre les tests E2E multilingues, accessibilité, redémarrage/multi-instance, concurrence DB réelle et recette fournisseur indisponible. Revue QA Murat et CI verte sur un même commit nécessaires avant DoD.
- La prévisualisation éphémère stockée par instance est une solution conservative sans migration. Une exploitation multi-instance exige du routage affinité ou un stockage de prévisualisations approuvé, **sans créer de migration automatiquement**.

Liens : [SCRUM-123](https://lmn24.atlassian.net/browse/SCRUM-123), [spécification UX-04](./guide-tv-mondial-sally-ux04-administration.md).
