import {proxyAdminBackend} from "@/lib/admin-backend";
import {weatherMutationAllowed,rejectedWeatherMutation} from "@/lib/weather-admin-security";
type Props={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Props):Promise<Response> {
 if(!weatherMutationAllowed(request))return rejectedWeatherMutation();
 const {id}=await params;
 return proxyAdminBackend(request,"/admin/weather-cities/"+encodeURIComponent(id)+"/status",{
   method:"PATCH",headers:{"content-type":"application/json"},body:await request.text()
 });
}
