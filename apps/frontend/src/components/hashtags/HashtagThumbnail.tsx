"use client";

import Image from "next/image";
import { useState } from "react";
import { safeHashtagImage } from "./hashtag-ranking-data";
import styles from "./hashtags.module.css";

type Props = Readonly<{ imageUrl: string | null; name: string; size?: "card" | "detail" }>;

export function HashtagThumbnail({ imageUrl, name, size = "card" }: Props) {
  const [failed, setFailed] = useState(false);
  const src = safeHashtagImage(imageUrl);
  return (
    <span className={size === "detail" ? styles.detailImage : styles.cardImage} aria-hidden="true">
      {src && !failed ? (
        <Image src={src} alt="" width={800} height={450} unoptimized
          className={styles.image} onError={() => setFailed(true)} />
      ) : (
        <span className={styles.imageFallback}>
          <span className={styles.hashIcon}>#</span>
          <span className={styles.fallbackLabel}>{name}</span>
        </span>
      )}
    </span>
  );
}
