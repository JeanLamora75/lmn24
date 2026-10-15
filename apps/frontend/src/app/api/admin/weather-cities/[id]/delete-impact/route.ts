import {proxyAdminBackend} from "@/lib/admin-backend";
type Props={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Props):Promise<Response> {
 const {id}=await params;
 return proxyAdminBackend(request,"/admin/weather-cities/"+encodeURIComponent(id)+"/delete-impact");
}
