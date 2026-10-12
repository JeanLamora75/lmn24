"use client";

import Link from "next/link";

import { CountryFlag } from "@/components/home/CountryFlag";
import { VideoPlayerModal } from "./VideoPlayerModal";
import styles from "./public-videos.module.css";
import { useCallback, useEffect, useRef, useState } from "react";

export type PublicVideo = {
  id:string; title:string; description:string|null; thumbnailUrl:string|null;
  videoUrl:string; publishedAt:string;
  source:{id:string;name:string;country:{isoCode2:string}};
  category:{id:string;slug:string;displayOrder:number;themeColor:string};
};
export type VideosPage={items:PublicVideo[];hasMore:boolean;nextCursor:string|null};
export type VideosFilters={
  categories:{id:string;slug:string;displayOrder:number;themeColor:string}[];
  sources:{id:string;name:string;country:{isoCode2:string}}[];
  countries:string[];
};
type Props={locale:string;initialPage:VideosPage|null;initialFilters:VideosFilters|null};
const labels:Record<string,{title:string;empty:string;more:string;loading:string;end:string;error:string}>={
  fr:{title:"Vidéos du monde",empty:"Aucune vidéo disponible dans cette langue.",more:"Charger davantage",loading:"Chargement…",end:"Toutes les vidéos ont été affichées.",error:"Chargement impossible. Réessayez."},
  en:{title:"World videos",empty:"No videos available in this language.",more:"Load more",loading:"Loading…",end:"All videos displayed.",error:"Unable to load videos. Retry."},
};
function categoryLabel(slug:string,locale:string):string {
  const names:Record<string,Record<string,string>>={
    fr:{news:"Actualités",international:"International",national:"National",sports:"Sports",technology:"Technologie",economy:"Économie",politics:"Politique",culture:"Culture",health:"Santé",education:"Éducation",society:"Société",music:"Musique",television:"Télévision",radio:"Radio","faits-divers":"Faits divers",cinema:"Cinéma"},
    en:{news:"News",international:"International",national:"National",sports:"Sports",technology:"Technology",economy:"Economy",politics:"Politics",culture:"Culture",health:"Health",education:"Education",society:"Society",music:"Music",television:"Television",radio:"Radio","faits-divers":"Local news",cinema:"Cinema"},
  };
  return names[locale]?.[slug]??names.fr?.[slug]??slug.replace(/-/g," ");
}
function countryName(code:string,locale:string):string{
  try{return new Intl.DisplayNames([locale],{type:"region"}).of(code.trim().toUpperCase())??code;}
  catch{return code;}
}
function VideoCard({video,locale,onPlay}:{video:PublicVideo;locale:string;onPlay:(video:PublicVideo)=>void}){
  const [failed,setFailed]=useState(false);
  return <article className={styles.videoCard}>
    <button type="button" className={styles.thumbnailButton}
      onClick={()=>onPlay(video)}
      aria-label={video.title}>
      {video.thumbnailUrl&&!failed?
        // Thumbnails are fetched only from the source URL supplied by LMN24.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.thumbnail} src={video.thumbnailUrl} alt="" loading="lazy"
          onError={()=>setFailed(true)}/>:
        <span className={styles.imageFallback} aria-hidden="true">▶</span>}
      <span className={styles.playMark} aria-hidden="true">▶</span>
      <span className={styles.titleOverlay}><span>{video.title}</span></span>
    </button>
    <div className={styles.sourceLine}>
      <CountryFlag countryIsoCode2={video.source.country.isoCode2} locale={locale}/>
      <span>{video.source.name}</span>
    </div>
  </article>;
}
export function PublicVideos({locale,initialPage,initialFilters}:Props){
  const t=labels[locale]??labels.fr!;
  const [filters,setFilters]=useState<VideosFilters|null>(initialFilters);
  const [items,setItems]=useState<PublicVideo[]>(initialPage?.items??[]);
  const [cursor,setCursor]=useState<string|null>(initialPage?.nextCursor??null);
  const [hasMore,setHasMore]=useState(initialPage?.hasMore??false);
  const [categoryId,setCategory]=useState("");
  const [sourceId,setSource]=useState("");
  const [country,setCountry]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(!initialPage||!initialFilters);
  const [revision,setRevision]=useState(0);
  const busy=useRef(false);
  const sentinel=useRef<HTMLDivElement>(null);
  const [observerSupported,setObserverSupported]=useState(true);
  const [selectedVideo,setSelectedVideo]=useState<PublicVideo|null>(null);
  const closePlayer=useCallback(()=>setSelectedVideo(null),[]);
  const initialized=useRef(false);
  const request=useCallback(async(nextCursor:string|null,replace:boolean)=>{
    if(busy.current)return;
    busy.current=true;setLoading(true);setError(false);
    const q=new URLSearchParams({locale,limit:"24"});
    if(categoryId)q.set("categoryId",categoryId);
    if(sourceId)q.set("sourceId",sourceId);
    if(country)q.set("country",country);
    if(nextCursor)q.set("cursor",nextCursor);
    try{
      const r=await fetch("/api/public/videos?"+q.toString(),{cache:"no-store"});
      if(!r.ok)throw new Error("HTTP "+r.status);
      const data=await r.json() as VideosPage;
      if(!Array.isArray(data.items)||typeof data.hasMore!=="boolean"||
        (data.hasMore&&(!data.nextCursor||!data.items.length)))throw new Error("Invalid response");
      setItems(current=>{
        const seen=new Set(replace?[]:current.map(x=>x.id));
        const fresh=data.items.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;});
        return replace?fresh:[...current,...fresh];
      });
      setCursor(data.nextCursor);setHasMore(data.hasMore);
    }catch{setError(true);}finally{busy.current=false;setLoading(false);}
  },[locale,categoryId,sourceId,country]);
  useEffect(()=>{
    if(!initialized.current){initialized.current=true;if(initialPage&&initialFilters)return;}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void request(null,true);
  },[request,revision,initialPage,initialFilters]);
  useEffect(()=>{
    if(filters)return;
    const controller=new AbortController();
    fetch("/api/public/videos/filters?locale="+encodeURIComponent(locale),{cache:"no-store",signal:controller.signal})
      .then(r=>{if(!r.ok)throw new Error("Filters unavailable");return r.json() as Promise<VideosFilters>;})
      .then(data=>{if(!controller.signal.aborted)setFilters(data);})
      .catch(()=>{});
    return()=>controller.abort();
  },[locale,filters]);
  const loadMore=useCallback(()=>{if(cursor&&hasMore&&!loading&&!error)void request(cursor,false);},[cursor,hasMore,loading,error,request]);
  useEffect(()=>{
    if(typeof IntersectionObserver==="undefined"){
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setObserverSupported(false);return;
    }
    if(!hasMore||loading||error)return;
    const node=sentinel.current;if(!node)return;
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(x=>x.isIntersecting))loadMore();
    },{rootMargin:"300px 0px"});
    observer.observe(node);return()=>observer.disconnect();
  },[loadMore,hasMore,loading,error]);
  const groups=new Map<string,PublicVideo[]>();
  for(const item of items){
    if(!groups.has(item.category.id))groups.set(item.category.id,[]);
    groups.get(item.category.id)!.push(item);
  }
  const ordered=[...groups.entries()].sort(([a,aa],[b,bb])=>
    aa[0]!.category.displayOrder-bb[0]!.category.displayOrder ||
    a.localeCompare(b));
  return <main className="container py-4">
    <header className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-2">
      <h1 className="display-6 fw-semibold mb-0">{t.title}</h1>
      <span className="badge text-bg-light border">{new Intl.DisplayNames([locale],{type:"language"}).of(locale)}</span>
    </header>
    <div className="row g-3 mb-4">
      <div className="col-12 col-md-4"><label className="form-label" htmlFor="pv-category">Catégorie</label>
        <select id="pv-category" className="form-select" value={categoryId} onChange={e=>setCategory(e.target.value)}>
          <option value="">Toutes les catégories</option>{filters?.categories.map(x=><option key={x.id} value={x.id}>{categoryLabel(x.slug,locale)}</option>)}</select></div>
      <div className="col-6 col-md-4"><label className="form-label" htmlFor="pv-source">Source</label>
        <select id="pv-source" className="form-select" value={sourceId} onChange={e=>setSource(e.target.value)}>
          <option value="">Toutes les sources</option>{filters?.sources.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div className="col-6 col-md-4"><label className="form-label" htmlFor="pv-country">Pays</label>
        <select id="pv-country" className="form-select" value={country} onChange={e=>setCountry(e.target.value)}>
          <option value="">Tous les pays</option>{filters?.countries.map(x=><option key={x} value={x}>{countryName(x,locale)}</option>)}</select></div>
    </div>
    {ordered.map(([category,group])=><section className="mb-5" key={category}>
      <h2 className="h4 pb-2 mb-3 border-bottom" style={{borderColor:group[0]!.category.themeColor}}>
        {categoryLabel(group[0]!.category.slug,locale)}</h2>
      <div className={styles.gallery}>{group.map(video=><VideoCard key={video.id} video={video} locale={locale} onPlay={setSelectedVideo}/>)}</div>
    </section>)}
    {!items.length&&!loading&&!error&&<p role="status" className="text-body-secondary">{t.empty}</p>}
    {error&&<p role="alert" className="alert alert-danger">{t.error} <button type="button" className="btn btn-outline-danger btn-sm" onClick={()=>setRevision(x=>x+1)}>Réessayer</button></p>}
    {hasMore&&<div ref={sentinel} className="text-center py-4" aria-busy={loading}>
      {loading?<p role="status">{t.loading}</p>:<button className="btn btn-outline-primary"
        onClick={loadMore} disabled={!observerSupported&&loading}>{t.more}</button>}</div>}
    {!hasMore&&!loading&&items.length>0&&<p role="status" className="text-center text-body-secondary">{t.end}</p>}
    <p className="small text-body-secondary"><Link href={"/"+locale}>Retour aux actualités</Link></p>
    {selectedVideo&&<VideoPlayerModal video={selectedVideo} locale={locale} onClose={closePlayer}/>}
  </main>;
}
