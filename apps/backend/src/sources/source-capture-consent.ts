import type { Frame, Locator, Page } from "playwright";

/**
 * Cookie treatment is intentionally best-effort and restricted to a temporary
 * Playwright context. Refuse optional cookies before trying to dismiss a
 * banner; never auto-click an "accept all" or an unrelated page control.
 */
export const COOKIE_REJECT_BUTTON = /^(?:tout refuser|refuser(?: tout| tous(?: les cookies)?)?|continuer sans accepter|continuer sans consentir|uniquement les cookies nécessaires|cookies nécessaires uniquement|reject(?: all| optional cookies)?|decline(?: all| optional cookies)?|refuse all|continue without accepting|continue without consent|only necessary(?: cookies)?|essential(?: cookies)? only|necessary(?: cookies)? only|alle ablehnen|alles ablehnen|nur notwendige(?: cookies)?|nur erforderliche(?: cookies)?|rechazar(?: todo| todas| todos)?|rechazar todas las cookies|solo necesarias|rifiuta(?: tutto| tutti)?|solo necessari|recusar(?: todos| tudo)?|rejeitar(?: todos| tudo)?|apenas necessários|отклонить все|отказать всем|только необходимые)$/i;

const COOKIE_CLOSE_BUTTON = /^(?:close|dismiss|fermer|schließen|schliessen|cerrar|chiudi|fechar|закрыть|×|✕)$/i;

/** Known reject controls are more reliable than translated button text. */
export const COOKIE_REJECT_SELECTORS = [
  "#onetrust-reject-all-handler",
  "#didomi-notice-disagree-button",
  "#CybotCookiebotDialogBodyButtonDecline",
  "button[data-testid='uc-deny-all-button']",
  ".cky-btn-reject",
  "#wt-cli-reject-btn",
  ".qc-cmp2-summary-buttons button[mode='secondary']",
] as const;

/** Only search for generic button names inside clearly identified CMP areas. */
export const COOKIE_CONSENT_CONTAINERS = [
  "#onetrust-consent-sdk",
  "#didomi-host",
  "#CybotCookiebotDialog",
  "#qc-cmp2-container",
  ".qc-cmp2-container",
  ".fc-consent-root",
  "[id^='sp_message_container_']",
  "#usercentrics-root",
  ".cky-consent-container",
  "#iubenda-cs-banner",
  "#cookie-law-info-bar",
  ".cc-window",
  "[id*='cookie-banner' i]",
  "[class*='cookie-banner' i]",
  "[id*='cookie-consent' i]",
  "[class*='cookie-consent' i]",
  "[role='dialog'][aria-label*='cookie' i]",
  "[role='dialog'][aria-label*='consent' i]",
] as const;

const COOKIE_CLOSE_SELECTORS = [
  "#onetrust-close-btn-container button",
  "#didomi-notice-close-button",
  ".cky-btn-close",
  ".cc-close",
] as const;

/**
 * Overlay masking is a VISUAL fallback after the opt-out/close attempt.
 * Only cookie CMP elements are targeted, never generic modals or paywalls.
 */
export const COOKIE_CAPTURE_STYLE = `
#onetrust-consent-sdk,
#onetrust-pc-sdk,
.onetrust-pc-dark-filter,
#didomi-host,
.didomi-popup-backdrop,
#CybotCookiebotDialog,
#CybotCookiebotDialogBodyUnderlay,
#qc-cmp2-container,
.qc-cmp2-container,
.fc-consent-root,
[id^="sp_message_container_"],
#usercentrics-root,
.cky-consent-container,
.cky-overlay,
#iubenda-cs-banner,
#iubenda-cs-overlay,
#cookie-law-info-bar,
.cc-window,
.cc-revoke,
[id*="cookie-banner" i],
[class*="cookie-banner" i],
[id*="cookie-consent" i],
[class*="cookie-consent" i],
[role="dialog"][aria-label*="cookie" i],
[role="dialog"][aria-label*="consent" i],
iframe[title*="cookie" i],
iframe[title*="consent" i],
iframe[title*="privacy choices" i],
iframe[id^="sp_message_iframe_"] {
  display: none !important;
  visibility: hidden !important;
}
`;

/** Avoid Playwright auto-waiting for every selector that is not present. */
async function clickIfVisible(locator: Locator): Promise<boolean> {
  try {
    const first = locator.first();
    if (!(await first.isVisible()) || !(await first.isEnabled())) return false;
    await first.click({ timeout: 850 });
    return true;
  } catch {
    // An obstructed or detached CMP button must not fail the whole capture.
    return false;
  }
}

async function clickKnownControl(
  frames: readonly Frame[],
  selectors: readonly string[],
): Promise<boolean> {
  for (const frame of frames) {
    for (const selector of selectors) {
      if (await clickIfVisible(frame.locator(selector))) return true;
    }
  }
  return false;
}

async function clickNamedControl(
  frames: readonly Frame[],
  name: RegExp,
): Promise<boolean> {
  for (const frame of frames) {
    for (const selector of COOKIE_CONSENT_CONTAINERS) {
      try {
        const consent = frame.locator(selector).first();
        if (!(await consent.isVisible())) continue;
        if (await clickIfVisible(consent.getByRole("button", { name }))) {
          return true;
        }
        // Some CMPs present "Continue without accepting" as a link.
        if (
          name === COOKIE_REJECT_BUTTON &&
          (await clickIfVisible(consent.getByRole("link", { name })))
        ) return true;
      } catch {
        // A frame may navigate or disappear during the scan.
      }
    }
  }
  return false;
}

/**
 * Mask generic role=dialog popups only when their contents clearly identify
 * them as cookie notices. Never remove subscription, security or login dialogs.
 */
async function maskIdentifiedCookieDialogs(frame: Frame): Promise<void> {
  await frame.evaluate(() => {
    const consentWords = /(?:cookies?|consentement|cookiebeleid|cookiehinweis|datenschutz|privacy preferences|cookie preferences|preferencias de cookies|preferenze cookie|политик[аеи] cookie)/i;
    const actionWords = /(?:accepter|refuser|paramétrer|personnaliser|choix|consent|accept|reject|decline|preferences|einstellungen|ablehnen|aceptar|rechazar|accetta|rifiuta|aceitar|recusar|принять|отклонить)/i;
    const forbiddenWords = /(?:captcha|robot|verify you are human|vérification de sécurité|subscribe|subscription|abonnez-vous|abonnement|paywall|login|log in|se connecter)/i;
    for (const element of document.querySelectorAll<HTMLElement>(
      '[role="dialog"], [aria-modal="true"], dialog',
    )) {
      const content = (element.innerText || element.textContent || "").slice(0, 1800);
      const label = element.getAttribute("aria-label") || "";
      if (
        consentWords.test(content + " " + label) &&
        actionWords.test(content) &&
        !forbiddenWords.test(content)
      ) {
        element.style.setProperty("display", "none", "important");
      }
    }
  });
}

/**
 * Restrict best-effort consent handling to a bounded set of frames.
 * Any error is isolated: browser screenshots should still proceed.
 */
export async function prepareCookieFreeCapture(page: Page): Promise<void> {
  const frames = page.frames().slice(0, 24);

  const rejected =
    (await clickKnownControl(frames, COOKIE_REJECT_SELECTORS)) ||
    (await clickNamedControl(frames, COOKIE_REJECT_BUTTON));

  if (!rejected) {
    const closed = await clickKnownControl(frames, COOKIE_CLOSE_SELECTORS);
    if (!closed) await clickNamedControl(frames, COOKIE_CLOSE_BUTTON);
  }

  // Re-evaluate the frames: the CMP click may have navigated/reloaded the page.
  for (const frame of page.frames().slice(0, 24)) {
    await frame.addStyleTag({ content: COOKIE_CAPTURE_STYLE }).catch(() => undefined);
    await maskIdentifiedCookieDialogs(frame).catch(() => undefined);
  }
}
