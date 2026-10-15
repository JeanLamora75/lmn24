import { proxyAdminBackend } from "@/lib/admin-backend";
import { weatherMutationAllowed, rejectedWeatherMutation } from "@/lib/weather-admin-security";
type Props={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Props):Promise<Response> {
 const {id}=await params;
 return proxyAdminBackend(request,"/admin/weather-cities/"+encodeURIComponent(id));
}
export async function PUT(request:Request,{params}:Props):Promise<Response> {
 if(!weatherMutationAllowed(request))return rejectedWeatherMutation();
 const {id}=await params;
 return proxyAdminBackend(request,"/admin/weather-cities/"+encodeURIComponent(id),
   {method:"PUT",headers:{"content-type":"application/json"},body:await request.text()});
}
export async function DELETE(request:Request,{params}:Props):Promise<Response> {
 if(!weatherMutationAllowed(request))return rejectedWeatherMutation();
 const {id}=await params;
 return proxyAdminBackend(request,"/admin/weather-cities/"+encodeURIComponent(id),
   {method:"DELETE",headers:{"content-type":"application/json"},body:await request.text()});
}
