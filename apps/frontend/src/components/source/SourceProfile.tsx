"use client";

import { isValidSourceProfileUrl } from "@lmn24/contracts";
import Image from "next/image";
import { useState } from "react";

import { safeExternalUrl } from "../home/home-data";
import { safeSourceLogo } from "./source-image";

import styles from "./source.module.css";

export type PublicSource = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
};

const NETWORKS = [
  { field: "facebookUrl", name: "Facebook", icon: "/social-icons/facebook.svg" },
  { field: "xUrl", name: "X / Twitter", icon: "/social-icons/x.svg" },
  { field: "instagramUrl", name: "Instagram", icon: "/social-icons/instagram.svg" },
  { field: "youtubeUrl", name: "YouTube", icon: "/social-icons/youtube.svg" },
] as const;

export function SourceProfile({ source }: { source: PublicSource }) {
  const [imageFailed, setImageFailed] = useState(false);
  const logo = safeSourceLogo(source.logoUrl);

  return (
    <header className={styles.profile}>
      <div className={styles.imagePanel}>
        {logo && !imageFailed ? (
          <Image
            src={logo}
            alt={"Image du site " + source.name}
            width={600}
            height={400}
            unoptimized
            className={styles.image}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className={styles.imageFallback} role="img" aria-label={"Image indisponible pour " + source.name}>
            <span>LMN24</span>
          </div>
        )}
      </div>
      <div className={styles.details}>
        <h1 className={styles.name}>{source.name}</h1>
        {source.description?.trim() ? (
          <p className={styles.description}>{source.description.trim()}</p>
        ) : null}
        <nav aria-label={"Réseaux sociaux de " + source.name} className={styles.networks}>
          {NETWORKS.map(({ field, name, icon }) => {
            const raw = source[field];
            const href = raw && isValidSourceProfileUrl(raw, field)
              ? safeExternalUrl(raw)
              : null;
            const image = (
              <Image src={icon} width={28} height={28} alt="" aria-hidden="true" unoptimized />
            );
            return href ? (
              <a
                key={field}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={name + " — " + source.name}
                title={name}
                className={styles.networkActive}
              >
                {image}
              </a>
            ) : (
              <span
                key={field}
                className={styles.networkDisabled}
                aria-label={name + " : indisponible"}
                title={name + " : indisponible"}
              >
                {image}
              </span>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
