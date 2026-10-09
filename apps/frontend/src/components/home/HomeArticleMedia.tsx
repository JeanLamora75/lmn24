"use client";

import Image from "next/image";
import { useState } from "react";

import { safeExternalUrl } from "./home-data";
import styles from "./home.module.css";

type Props = {
  imageUrl: string | null;
  logoUrl: string | null;
};

export function HomeArticleMedia({ imageUrl, logoUrl }: Props) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const image = safeExternalUrl(imageUrl);
  const logo = safeExternalUrl(logoUrl);
  const current = image && !failedUrls.includes(image)
    ? image
    : logo && !failedUrls.includes(logo)
      ? logo
      : null;

  return (
    <span className={styles.media} aria-hidden="true">
      {current ? (
        <Image
          unoptimized
          src={current}
          width={640}
          height={360}
          className={styles.mediaImage}
          alt=""
          onError={() => setFailedUrls((old) => old.includes(current) ? old : [...old, current])}
        />
      ) : (
        <span className={styles.mediaFallback}>
          <span className={styles.mediaBrand}>LMN24</span>
        </span>
      )}
    </span>
  );
}
