import { proxyAdminBackend } from "@/lib/admin-backend";
import { weatherMutationAllowed, rejectedWeatherMutation } from "@/lib/weather-admin-security";
export async function GET(request:Request):Promise<Response> {
 return proxyAdminBackend(request,"/admin/weather-cities"+new URL(request.url).search);
}
export async function POST(request:Request):Promise<Response> {
 if(!weatherMutationAllowed(request))return rejectedWeatherMutation();
 return proxyAdminBackend(request,"/admin/weather-cities",{
   method:"POST",headers:{"content-type":"application/json"},body:await request.text()
 });
}
