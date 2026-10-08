import { SourceForm } from "../../SourceForm";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function EditSourcePage({ params }: Props) {
  const { id } = await params;

  return <SourceForm mode="edit" sourceId={id} />;
}
