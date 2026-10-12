import { UnprocessableEntityException } from "@nestjs/common";
import type { Page, Response as PlaywrightResponse } from "playwright";

/**
 * A navigation that lands on a security challenge is not a successful
 * screenshot or a valid source of social links. Never try to defeat it.
 */
export function isAccessChallenge(title: string, body: string): boolean {
  const heading = title.trim().toLowerCase().replace(/\s+/g, " ");
  const text = body.trim().toLowerCase().replace(/\s+/g, " ");
  const exactTitles = /^(?:403(?: forbidden)?|access denied|access to this page has been denied|forbidden|bot detected|just a moment(?:\.\.\.)?|attention required!?|security check|verify you are human|request blocked|robot check)$/i;
  if (exactTitles.test(heading)) return true;
  // These indicate a challenge even when the response has HTTP 200.
  const phrases = [
    "bot detected",
    "verify you are human",
    "checking your browser before accessing",
    "your request has been blocked",
    "you have been blocked",
    "sorry, you have been blocked",
    "access to this page has been denied",
    "our systems have detected unusual traffic",
  ];
  return phrases.some(phrase => text.includes(phrase)) && text.length < 5000;
}

export async function assertSiteAccessible(
  page: Page,
  response: PlaywrightResponse | null,
  action: "capture" | "social",
): Promise<void> {
  const target = action === "capture" ? "la capture" : "la recherche des réseaux sociaux";
  const status = response?.status();
  if (status === 401 || status === 403 || status === 429 || status === 503) {
    throw new UnprocessableEntityException(
      "Le site renvoie HTTP " + status + " et refuse " + target +
      " automatisée. Ouvrez-le dans Chrome et utilisez la saisie manuelle.",
    );
  }
  if (!response || (status !== undefined && status >= 400)) {
    throw new UnprocessableEntityException(
      "Le site ne permet pas " + target + " actuellement" +
      (status ? " (HTTP " + status + ")." : ".") +
      " Ouvrez-le dans Chrome pour vérifier.",
    );
  }
  // Some anti-bot pages return 200 and must not be saved as a legitimate capture.
  // Read only visible page signals; no CAPTCHA/challenge solving is attempted.
  const document = await page.evaluate(() => ({
    title: document.title.slice(0, 200),
    body: (document.body?.innerText ?? "").slice(0, 5000),
  }));
  if (isAccessChallenge(document.title, document.body)) {
    throw new UnprocessableEntityException(
      "Le site affiche une protection anti-bot (Access denied / Bot detected). " +
      "La collecte automatisée est bloquée. Utilisez Chrome et la saisie manuelle.",
    );
  }
}
