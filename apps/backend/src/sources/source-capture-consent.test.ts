import type { Frame, Page } from "playwright";
import { describe, expect, it, vi } from "vitest";

import {
  COOKIE_CAPTURE_STYLE,
  COOKIE_REJECT_BUTTON,
  COOKIE_REJECT_SELECTORS,
  prepareCookieFreeCapture,
} from "./source-capture-consent";

type FakeLocator = {
  first: () => FakeLocator;
  isVisible: () => Promise<boolean>;
  isEnabled: () => Promise<boolean>;
  click: () => Promise<void>;
  getByRole: (role: string, options: { name: RegExp }) => FakeLocator;
};

function hiddenLocator(): FakeLocator {
  const hidden: FakeLocator = {
    first: () => hidden,
    isVisible: async () => false,
    isEnabled: async () => false,
    click: async () => undefined,
    getByRole: () => hidden,
  };
  return hidden;
}

function visibleLocator(onClick: () => void): FakeLocator {
  const visible: FakeLocator = {
    first: () => visible,
    isVisible: async () => true,
    isEnabled: async () => true,
    click: async () => onClick(),
    getByRole: () => hiddenLocator(),
  };
  return visible;
}

function fakeFrame(
  controls: Record<string, FakeLocator> = {},
  consentRoot?: { selector: string; rejectText: string; onReject: () => void },
) {
  const fallback = hiddenLocator();
  const addStyleTag = vi.fn().mockResolvedValue(undefined);
  const evaluate = vi.fn().mockResolvedValue(undefined);
  const locator = vi.fn((selector: string): FakeLocator => {
    if (controls[selector]) return controls[selector];
    if (selector === consentRoot?.selector) {
      const root: FakeLocator = {
        first: () => root,
        isVisible: async () => true,
        isEnabled: async () => true,
        click: async () => undefined,
        getByRole: (role, { name }) =>
          role === "button" && name.test(consentRoot.rejectText)
            ? visibleLocator(consentRoot.onReject)
            : fallback,
      };
      return root;
    }
    return fallback;
  });
  return {
    frame: { locator, addStyleTag, evaluate } as unknown as Frame,
    addStyleTag,
    evaluate,
    locator,
  };
}

function fakePage(frames: Frame[]): Page {
  return { frames: () => frames } as unknown as Page;
}

describe("SCRUM-16 — capture de source sans bannière cookies", () => {
  it("reconnaît le refus des cookies, mais pas leur acceptation automatique", () => {
    for (const label of [
      "Tout refuser",
      "Continuer sans accepter",
      "Reject all",
      "Only necessary cookies",
      "Alle ablehnen",
      "Rechazar todas",
      "Rifiuta tutti",
      "Recusar todos",
      "Отклонить все",
    ]) {
      expect(COOKIE_REJECT_BUTTON.test(label)).toBe(true);
    }
    for (const label of ["Accept all", "Tout accepter", "Alle akzeptieren", "Subscribe", "Download"]) {
      expect(COOKIE_REJECT_BUTTON.test(label)).toBe(false);
    }
  });

  it("privilégie le bouton connu de refus avant le bouton de fermeture", async () => {
    const reject = vi.fn();
    const close = vi.fn();
    const example = fakeFrame({
      "#onetrust-reject-all-handler": visibleLocator(reject),
      "#onetrust-close-btn-container button": visibleLocator(close),
    });
    await prepareCookieFreeCapture(fakePage([example.frame]));
    expect(reject).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(example.addStyleTag).toHaveBeenCalledWith({ content: COOKIE_CAPTURE_STYLE });
    expect(example.evaluate).toHaveBeenCalledOnce();
  });

  it("trouve le bouton de refus d'un dialogue dans une iframe", async () => {
    const main = fakeFrame();
    const reject = vi.fn();
    const iframe = fakeFrame({}, {
      selector: "#didomi-host",
      rejectText: "Tout refuser",
      onReject: reject,
    });
    await prepareCookieFreeCapture(fakePage([main.frame, iframe.frame]));
    expect(reject).toHaveBeenCalledOnce();
    expect(main.addStyleTag).toHaveBeenCalledOnce();
    expect(iframe.addStyleTag).toHaveBeenCalledOnce();
  });

  it("utilise la fermeture quand aucun refus n'est disponible", async () => {
    const close = vi.fn();
    const example = fakeFrame({
      "#onetrust-close-btn-container button": visibleLocator(close),
    });
    await prepareCookieFreeCapture(fakePage([example.frame]));
    expect(close).toHaveBeenCalledOnce();
  });

  it("continue normalement lorsque le site ne montre aucun dialogue", async () => {
    const example = fakeFrame();
    await expect(prepareCookieFreeCapture(fakePage([example.frame]))).resolves.toBeUndefined();
    expect(example.addStyleTag).toHaveBeenCalledOnce();
    expect(example.evaluate).toHaveBeenCalledOnce();
  });

  it("ignore les erreurs d'iframe et les contrôles obstrués", async () => {
    const example = fakeFrame();
    example.addStyleTag.mockRejectedValue(new Error("frame navigated"));
    example.evaluate.mockRejectedValue(new Error("frame detached"));
    const problem = visibleLocator(() => { throw new Error("Element is obscured"); });
    const obstructed = fakeFrame({ [COOKIE_REJECT_SELECTORS[0]]: problem });
    await expect(
      prepareCookieFreeCapture(fakePage([example.frame, obstructed.frame])),
    ).resolves.toBeUndefined();
  });

  it("ne masque visuellement que les sélecteurs CMP et non les paywalls/CAPTCHA", () => {
    expect(COOKIE_CAPTURE_STYLE).toContain("#onetrust-consent-sdk");
    expect(COOKIE_CAPTURE_STYLE).toContain("#didomi-host");
    expect(COOKIE_CAPTURE_STYLE).toContain("iframe[title*=\"cookie\" i]");
    expect(COOKIE_CAPTURE_STYLE).not.toContain(".paywall");
    expect(COOKIE_CAPTURE_STYLE).not.toContain(".captcha");
    expect(COOKIE_CAPTURE_STYLE).not.toContain('[role="dialog"] {');
  });
});
