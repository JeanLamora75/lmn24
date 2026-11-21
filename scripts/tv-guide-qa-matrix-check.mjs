#!/usr/bin/env node
/**
 * SCRUM-124 Murat: fail CI if any UX scenario disappears from the 94-case
 * QA traceability matrix. This is an inventory check, NOT an acceptance claim.
 */
import {readFileSync} from "node:fs";
const source=[
 "docs/BMAD/guide-tv-mondial-sally-ux01-accueil-responsive.md",
 "docs/BMAD/guide-tv-mondial-sally-ux02-fiches-chaines-programmes-grilles.md",
 "docs/BMAD/guide-tv-mondial-sally-ux03-recherche-mondiale-etats.md",
 "docs/BMAD/guide-tv-mondial-sally-ux04-administration.md",
];
const matrix="docs/BMAD/guide-tv-mondial-murat-scrum124-matrice-94-scenarios.md";
const extract=file=>[...readFileSync(file,"utf8").matchAll(/^\|\s*(UX0[1-4]-\d+)\s*\|/gm)].map(x=>x[1]);
const original=source.flatMap(extract);
const mapped=extract(matrix);
function assert(condition,reason){if(!condition)throw new Error("SCRUM-124 QA matrix invalid: "+reason);}
assert(original.length===94,"expected 94 upstream cases, got "+original.length);
assert(new Set(original).size===94,"duplicate case in UX sources");
assert(mapped.length===94,"expected 94 mapped cases, got "+mapped.length);
assert(new Set(mapped).size===94,"duplicate case in QA matrix");
for(const id of original)assert(mapped.includes(id),"missing "+id);
for(const id of mapped)assert(original.includes(id),"unknown "+id);
console.log("SCRUM-124 QA MATRIX PASS: 94/94 IDs tracked; coverage statuses are not acceptance.");
