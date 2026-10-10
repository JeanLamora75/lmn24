"use client";

import Image from "next/image";
import { useState } from "react";

import { countryFlagSrc, countryName } from "./country-flag";
import styles from "./home.module.css";

type Props = {
  countryIsoCode2: string | null | undefined;
  locale: string;
};

/** Hides only the flag if the country code or image cannot be displayed. */
export function CountryFlag({ countryIsoCode2, locale }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = countryFlagSrc(countryIsoCode2);
  if (!src || failedSrc === src) return null;

  const label = countryName(countryIsoCode2!, locale);
  return (
    <Image
      unoptimized
      src={src}
      width={24}
      height={18}
      className={styles.sourceFlag}
      alt={label}
      title={label}
      onError={() => setFailedSrc(src)}
    />
  );
}
