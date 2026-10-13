import { normalizeHashtagTerm } from "./hashtag-normalization";

/** Deterministic lexical matching shared by parser, backend and public pages. */
export type HashtagDefinition = Readonly<{
  id: string;
  name: string;
  aliases: readonly Readonly<{ name: string }>[];
}>;
export type CompiledHashtag = Readonly<{
  id: string;
  expressions: readonly RegExp[];
}>;

/** Treat dashes as word separators. Explicit translations / transliterations
 * remain necessary. No semantic NLP, stemming or substring search.
 */
export function canonicalizeHashtagText(value: string): string {
  return normalizeHashtagTerm(value)
    .replace(/[\u2010-\u2015\u2212-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compileHashtags(definitions: readonly HashtagDefinition[]): CompiledHashtag[] {
  return definitions.map(({ id, name, aliases }) => {
    const terms = new Set([name, ...aliases.map((alias) => alias.name)]
      .map(canonicalizeHashtagText).filter(Boolean));
    const expressions = [...terms].map((term) =>
      new RegExp("(?<![\\p{L}\\p{N}\\p{M}_])" + escaped(term)
        .replace(/ /g, "\\s+") + "(?![\\p{L}\\p{N}\\p{M}_])", "u"));
    return { id, expressions };
  });
}

export function matchArticleHashtags(
  article: Readonly<{ title: string; summary: string | null | undefined }>,
  compiled: readonly CompiledHashtag[],
): string[] {
  const title = canonicalizeHashtagText(article.title);
  const summary = canonicalizeHashtagText(article.summary ?? "");
  return compiled.filter(({ expressions }) => expressions.some(
    (expression) => expression.test(title) || expression.test(summary),
  )).map(({ id }) => id);
}
