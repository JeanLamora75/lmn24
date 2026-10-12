/** Extract an official YouTube video ID, never arbitrary iframe markup or hosts. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeEmbedUrl(videoUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(videoUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  let videoId: string | null = null;
  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else {
      videoId = url.pathname.match(/^\/(?:shorts|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1] ?? null;
    }
  } else if (host === "youtu.be") {
    videoId = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1] ?? null;
  }

  return videoId && VIDEO_ID.test(videoId)
    ? "https://www.youtube-nocookie.com/embed/" + videoId + "?autoplay=1&rel=0"
    : null;
}
