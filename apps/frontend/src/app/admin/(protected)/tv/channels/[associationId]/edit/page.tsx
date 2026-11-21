import {TvChannelEditPage} from "@/components/admin/tv/TvAdminWorkspace";

export const dynamic="force-dynamic";
type Props=Readonly<{params:Promise<{associationId:string}>}>;
export default async function EditTvChannelPage({params}:Props){
 const {associationId}=await params;
 return <TvChannelEditPage associationId={associationId}/>;
}
