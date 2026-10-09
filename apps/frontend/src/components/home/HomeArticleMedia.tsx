"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { safeExternalUrl } from "./home-data";
import styles from "./home.module.css";

type Props = {
  title: string;
  imageUrl: string | null;
  logoUrl: string | null;
};

export function HomeArticleMedia({ title, imageUrl, logoUrl }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const image = safeExternalUrl(imageUrl);
  const logo = safeExternalUrl(logoUrl);
  const current = image && failedUrl !== image
    ? image
    : logo && failedUrl !== logo
      ? logo
      : null;

  useEffect(() => {
    setFailedUrl(null);
  }, [imageUrl, logoUrl]);

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
          onError={() => setFailedUrl(current)}
        />
      ) : (
        <span className={styles.mediaFallback}>
          <span className={styles.mediaBrand}>LMN24</span>
        </span>
      )}
    </span>
  );
}
