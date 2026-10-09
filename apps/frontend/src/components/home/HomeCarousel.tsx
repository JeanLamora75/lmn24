"use client";

import { useRef, type ReactNode } from "react";

import styles from "./home.module.css";

type Props = {
  title: string;
  previousLabel: string;
  nextLabel: string;
  children: ReactNode;
};

export function HomeCarousel({
  title,
  previousLabel,
  nextLabel,
  children,
}: Props) {
  const track = useRef<HTMLDivElement>(null);

  function scroll(direction: -1 | 1) {
    const container = track.current;
    if (!container) return;
    const firstCard = container.querySelector<HTMLElement>("article");
    const step = (firstCard?.getBoundingClientRect().width ?? 300) + 16;
    container.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <div>
      <div className={styles.carouselControls}>
        <button
          className="btn btn-sm btn-outline-secondary"
          type="button"
          aria-label={previousLabel}
          onClick={() => scroll(-1)}
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          className="btn btn-sm btn-outline-secondary"
          type="button"
          aria-label={nextLabel}
          onClick={() => scroll(1)}
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
      <div
        ref={track}
        tabIndex={0}
        className={styles.carouselTrack}
        role="region"
        aria-roledescription="carousel"
        aria-label={title}
      >
        {children}
      </div>
    </div>
  );
}
