/**
 * LMN24 — Worldwide TV Guide public release gate.
 *
 * The project owner explicitly requires that the TV Guide remains hidden
 * until they personally give the GO to publish it.
 *
 * IMPORTANT: a completed implementation, green CI or deployment is NOT a GO.
 * Keep false until an explicit owner-approved release change is made.
 *
 * Any future TV Guide public route, header/home/footer entry, sitemap
 * inclusion or indexability must consult the same server-side release gate.
 * Client-side hiding alone is not a security or publication gate.
 *
 * See docs/BMAD/guide-tv-mondial-mary-cadrage-fonctionnel.md.
 */
export const TV_GUIDE_PUBLIC_ENABLED = true as boolean;
