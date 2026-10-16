"use client";

import Image from "next/image";
import { useState } from "react";

import { countryFlagSrc, countryName } from "./country-flag";
import styles from "./home.module.css";

type Props = {
  countryIsoCode2: string | null | undefined;
  locale: string;
  /** Larger rendering for weather card headers; keeps compact flags everywhere else. */
  size?: "compact" | "large";
};

/** Hides only the flag if the country code or image cannot be displayed. */
export function CountryFlag({ countryIsoCode2, locale, size = "compact" }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = countryFlagSrc(countryIsoCode2);
  if (!src || failedSrc === src) return null;

  const label = countryName(countryIsoCode2!, locale);
  return (
    <Image
      unoptimized
      src={src}
      width={size === "large" ? 88 : 24}
      height={size === "large" ? 48 : 18}
      className={size === "large" ? styles.largeFlag : styles.sourceFlag}
      alt={label}
      title={label}
      onError={() => setFailedSrc(src)}
    />
  );
}
