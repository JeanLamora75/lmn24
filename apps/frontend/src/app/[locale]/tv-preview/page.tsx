import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getAdminSession} from "@/lib/admin-auth";
import {tvLocale} from "@/components/tv/tv-guide-model";
import {TvGuideHome} from "@/components/tv/TvGuideHome";
export const dynamic="force-dynamic";
export const metadata:Metadata={robots:{index:false,follow:false},title:"Aperçu privé — Guide TV LMN24"};
export default async function TvAdminPreview({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;
 const user=await getAdminSession();
 if(user?.role!=="ADMIN")notFound();
 return <TvGuideHome locale={tvLocale(locale)} preview/>;
}
