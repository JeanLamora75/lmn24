import type {ReactNode} from "react";
import {getAdminSession} from "@/lib/admin-auth";
import {notFound} from "next/navigation";
import Link from "next/link";
import styles from "./tv-admin.module.css";

export const dynamic="force-dynamic";
export const TV_ADMIN_VIEWS=[
 {slug:"",label:"Vue d'ensemble"},
 {slug:"countries",label:"Pays"},
 {slug:"channels",label:"Chaînes"},
 {slug:"sources",label:"Sources EPG"},
 {slug:"imports",label:"Imports"},
 {slug:"translations",label:"Traductions"},
 {slug:"statistics",label:"Statistiques"},
] as const;

export default async function TvAdminLayout({children}:{children:ReactNode}){
 const user=await getAdminSession();
 if(!user||user.role!=="ADMIN")notFound();
 return <section className={styles.workspace}>
  <nav className={styles.navigation} aria-label="Rubriques Guide TV">
   {TV_ADMIN_VIEWS.map(v=><Link key={v.slug} href={`/admin/tv${v.slug?"/"+v.slug:""}`}>{v.label}</Link>)}
  </nav>
  <div className={styles.content}>{children}</div>
 </section>;
}
