import { safeExternalUrl } from "../home/home-data";

/** Local uploaded logos use the public /source-media proxy. */
export function safeSourceLogo(value: string | null): string | null {
  if (value && /^\/source-media\/[0-9a-f-]{36}\.(?:png|jpg|jpeg|webp)$/i.test(value)) {
    return value;
  }
  return safeExternalUrl(value);
}
