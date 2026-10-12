import { VideoFeedForm } from "@/components/video-feeds/VideoFeedsAdmin";

type Props = { searchParams: Promise<{ sourceId?: string }> };

export default async function NewVideoFeedPage({ searchParams }: Props) {
  const { sourceId } = await searchParams;
  const validSourceId = sourceId && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(sourceId)
    ? sourceId
    : "";
  return <VideoFeedForm initialSourceId={validSourceId} />;
}
