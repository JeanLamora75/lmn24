"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import type { PublicVideo } from "./PublicVideos";
import { youtubeEmbedUrl } from "./youtube-embed";
import styles from "./public-videos.module.css";

type Props = {
  video: PublicVideo;
  locale: string;
  onClose: () => void;
};

const strings: Record<string, { close: string; open: string; unavailable: string }> = {
  fr: { close: "Fermer la vidéo", open: "Voir sur YouTube", unavailable: "Cette vidéo ne peut pas être lue dans le lecteur intégré." },
  en: { close: "Close video", open: "Watch on YouTube", unavailable: "This video cannot be played in the embedded player." },
  de: { close: "Video schließen", open: "Auf YouTube ansehen", unavailable: "Das Video kann hier nicht wiedergegeben werden." },
  es: { close: "Cerrar vídeo", open: "Ver en YouTube", unavailable: "Este vídeo no se puede reproducir aquí." },
  pt: { close: "Fechar vídeo", open: "Ver no YouTube", unavailable: "Este vídeo não pode ser reproduzido aqui." },
  it: { close: "Chiudi video", open: "Guarda su YouTube", unavailable: "Questo video non può essere riprodotto qui." },
  ru: { close: "Закрыть видео", open: "Смотреть на YouTube", unavailable: "Это видео нельзя воспроизвести здесь." },
  nl: { close: "Video sluiten", open: "Bekijken op YouTube", unavailable: "Deze video kan hier niet worden afgespeeld." },
};

export function VideoPlayerModal({ video, locale, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const embedUrl = youtubeEmbedUrl(video.videoUrl);
  const t = strings[locale] ?? strings.fr!;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), iframe, a[href]",
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className={styles.modalLayer}>
      <button
        type="button"
        className={styles.backdrop}
        tabIndex={-1}
        aria-label={t.close}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className={styles.modalPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle} id={titleId}>{video.title}</h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={t.close}
            title={t.close}
          >
            <svg viewBox="0 0 24 24" width="24" height="24"
              fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M5 5 19 19M19 5 5 19" />
            </svg>
          </button>
        </div>
        {embedUrl ? (
          <iframe
            className={styles.playerFrame}
            src={embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <p className={styles.playerFallback}>{t.unavailable}</p>
        )}
        <div className={styles.modalFooter}>
          <a className={styles.externalLink} href={video.videoUrl}
            target="_blank" rel="noopener noreferrer">{t.open}</a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
