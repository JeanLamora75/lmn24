import { VideoFeedForm } from "@/components/video-feeds/VideoFeedsAdmin";
type Props = { params: Promise<{ id: string }> };
export default async function EditVideoFeedPage({ params }: Props) {
  const { id } = await params;
  return <VideoFeedForm id={id} />;
}
