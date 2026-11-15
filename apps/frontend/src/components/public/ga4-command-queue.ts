/**
 * Google's gtag.js bootstrap expects an Arguments object in dataLayer.
 * A rest-parameter array is not equivalent and can prevent commands
 * from being interpreted by the Google tag.
 */
export type GtagQueueTarget = {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

export function ensureGtagQueue(target: GtagQueueTarget): void {
  target.dataLayer ??= [];
  target.gtag ??= function gtag() {
    target.dataLayer?.push(arguments);
  };
}
