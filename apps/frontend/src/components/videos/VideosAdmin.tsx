"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Options = { sources: { id: string; name: string }[]; categories: { id: string; slug: string }[]; languages: { isoCode2: string }[] };
type Video = { id: string; title: string; description: string | null; videoUrl: string; thumbnailUrl: string | null;
  platformVideoId: string; publishedAt: string; sourceId: string; categoryId: string; languageIsoCode2: string;
  isPublished: boolean; source: { name: string; country: { isoCode2: string } }; category: { slug: string } };
type Listing = { items: Video[]; pagination: { total: number; page: number; pageSize: number; totalPages: number } };
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r=await fetch(url,{cache:"no-store",...init});
  if(!r.ok) throw new Error("Opération impossible (HTTP "+r.status+").");
  return await r.json() as T;
}
const base="/api/admin/videos";
function languageName(code:string) {
  try{return new Intl.DisplayNames(["fr"],{type:"language"}).of(code.trim())??code;}
  catch{return code;}
}
export function VideosAdmin() {
  const [options,setOptions]=useState<Options|null>(null);
  const [list,setList]=useState<Listing|null>(null);
  const [search,setSearch]=useState("");
  const [sourceId,setSource]=useState("");
  const [categoryId,setCategory]=useState("");
  const [language,setLanguage]=useState("");
  const [status,setStatus]=useState("all");
  const [page,setPage]=useState(1);
  const [refreshKey,setRefreshKey]=useState(0);
  const [busy,setBusy]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [editing,setEditing]=useState<Video|null>(null);
  const [editCategory,setEditCategory]=useState("");
  const [editLanguage,setEditLanguage]=useState("");
  const [editPublished,setEditPublished]=useState(true);
  const refresh=useCallback(()=>setRefreshKey(v=>v+1),[]);
  useEffect(()=>{const c=new AbortController();api<Options>(base+"/form-options",{signal:c.signal})
    .then(v=>{if(!c.signal.aborted)setOptions(v);})
    .catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Erreur");});return()=>c.abort();},[]);
  useEffect(()=>{
    const c=new AbortController();
    const q=new URLSearchParams({status,page:String(page),pageSize:"10"});
    if(search.trim())q.set("search",search.trim());
    if(sourceId)q.set("sourceId",sourceId);
    if(categoryId)q.set("categoryId",categoryId);
    if(language)q.set("language",language);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api<Listing>(base+"?"+q.toString(),{signal:c.signal}).then(v=>{if(!c.signal.aborted){setList(v);setError("");}})
      .catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Chargement impossible");})
      .finally(()=>{if(!c.signal.aborted)setLoading(false);});
    return()=>c.abort();
  },[search,sourceId,categoryId,language,status,page,refreshKey]);
  async function publish(video:Video) {
    setBusy(video.id);
    try{await api(base+"/"+video.id+"/publication",{method:"PATCH",headers:{"content-type":"application/json"},
      body:JSON.stringify({isPublished:!video.isPublished})});refresh();}
    catch(e){setError(e instanceof Error?e.message:"Erreur de publication");}
    finally{setBusy(null);}
  }
  function edit(video:Video) {setEditing(video);setEditCategory(video.categoryId);setEditLanguage(video.languageIsoCode2.trim());setEditPublished(video.isPublished);}
  async function save() {
    if(!editing)return;
    setBusy(editing.id);
    try{await api(base+"/"+editing.id,{method:"PUT",headers:{"content-type":"application/json"},
      body:JSON.stringify({categoryId:editCategory,languageIsoCode2:editLanguage,isPublished:editPublished})});
      setEditing(null);refresh();}
    catch(e){setError(e instanceof Error?e.message:"Erreur d'enregistrement");}
    finally{setBusy(null);}
  }
  return <main className="container-fluid px-3 px-lg-4 py-4">
    <header className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div><Link href="/admin" className="btn btn-outline-secondary btn-sm mb-3">← Administration</Link>
        <h1 className="h2">Vidéos YouTube</h1><p className="text-body-secondary mb-0">Consulter, classer et modérer les vidéos importées.</p></div>
      <div className="d-flex gap-2"><Link className="btn btn-outline-primary" href="/admin/video-feeds">Flux vidéo</Link>
        <button className="btn btn-primary" type="button" onClick={refresh} disabled={loading}>Actualiser</button></div>
    </header>
    <section className="card mb-3"><div className="card-body row g-2">
      <div className="col-12 col-lg-4"><label className="form-label" htmlFor="videos-search">Recherche</label>
        <input id="videos-search" className="form-control" placeholder="Titre, média ou identifiant vidéo" value={search}
          onChange={e=>{setSearch(e.target.value);setPage(1);}}/></div>
      <div className="col-6 col-lg-2"><label className="form-label" htmlFor="videos-source">Source</label>
        <select id="videos-source" className="form-select" value={sourceId} onChange={e=>{setSource(e.target.value);setPage(1);}}>
          <option value="">Toutes</option>{options?.sources.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div className="col-6 col-lg-2"><label className="form-label" htmlFor="videos-category">Catégorie</label>
        <select id="videos-category" className="form-select" value={categoryId} onChange={e=>{setCategory(e.target.value);setPage(1);}}>
          <option value="">Toutes</option>{options?.categories.map(x=><option key={x.id} value={x.id}>{x.slug}</option>)}</select></div>
      <div className="col-6 col-lg-2"><label className="form-label" htmlFor="videos-language">Langue</label>
        <select id="videos-language" className="form-select" value={language} onChange={e=>{setLanguage(e.target.value);setPage(1);}}>
          <option value="">Toutes</option>{options?.languages.map(x=><option key={x.isoCode2} value={x.isoCode2.trim()}>{languageName(x.isoCode2)}</option>)}</select></div>
      <div className="col-6 col-lg-2"><label className="form-label" htmlFor="videos-status">Publication</label>
        <select id="videos-status" className="form-select" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>
          <option value="all">Toutes</option><option value="published">Publiées</option><option value="hidden">Masquées</option></select></div>
    </div></section>
    {error&&<div role="alert" className="alert alert-danger">{error} <button type="button" className="btn btn-outline-danger btn-sm ms-2" onClick={refresh}>Réessayer</button></div>}
    {loading&&<p role="status">Chargement des vidéos…</p>}
    {list&&<section className="card shadow-sm">
      <div className="table-responsive"><table className="table table-hover align-middle mb-0">
        <thead><tr><th>Vidéo</th><th>Média</th><th>Catégorie / langue</th><th>Publication YouTube</th><th>Visibilité</th><th>Actions</th></tr></thead>
        <tbody>{list.items.map(video=><tr key={video.id}>
          <td style={{minWidth:260,maxWidth:420}}><div className="d-flex gap-3 align-items-start">
            {video.thumbnailUrl?<img src={video.thumbnailUrl} alt="" width={128} height={72} style={{objectFit:"cover",borderRadius:6}}/>:
              <div className="bg-body-secondary d-flex align-items-center justify-content-center rounded flex-shrink-0" style={{width:128,height:72}}>Vidéo</div>}
            <div className="text-break"><a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="fw-semibold">{video.title}</a>
              <div className="small text-body-secondary">{video.platformVideoId}</div></div></div></td>
          <td>{video.source.name}</td><td>{video.category.slug}<div className="small text-body-secondary">{languageName(video.languageIsoCode2)}</div></td>
          <td>{new Date(video.publishedAt).toLocaleString("fr-FR")}</td>
          <td><span className={"badge "+(video.isPublished?"text-bg-success":"text-bg-secondary")}>{video.isPublished?"Publiée":"Masquée"}</span></td>
          <td><div className="d-flex flex-wrap gap-2"><button className="btn btn-outline-primary btn-sm" onClick={()=>edit(video)}>Modifier</button>
            <button className="btn btn-outline-secondary btn-sm" disabled={busy===video.id}
              onClick={()=>void publish(video)}>{video.isPublished?"Masquer":"Publier"}</button></div></td>
        </tr>)}{list.items.length===0&&<tr><td colSpan={6} className="text-center text-body-secondary py-4">Aucune vidéo trouvée.</td></tr>}</tbody>
      </table></div>
      <div className="card-footer d-flex align-items-center justify-content-between gap-2">
        <span className="small">{list.pagination.total} vidéos</span><div className="d-flex align-items-center gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page===1||loading} onClick={()=>setPage(v=>v-1)}>Précédent</button>
          <span className="small">Page {list.pagination.page} / {Math.max(1,list.pagination.totalPages)}</span>
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page>=list.pagination.totalPages||loading} onClick={()=>setPage(v=>v+1)}>Suivant</button>
        </div></div>
    </section>}
    {editing&&<div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-label="Modifier une vidéo"
      style={{background:"rgba(0,0,0,.55)"}}><div className="modal-dialog modal-dialog-centered"><div className="modal-content">
        <div className="modal-header"><h2 className="modal-title fs-5">Modifier la vidéo</h2>
          <button className="btn-close" aria-label="Fermer" type="button" onClick={()=>setEditing(null)}/></div>
        <div className="modal-body"><p className="fw-semibold">{editing.title}</p>
          <label className="form-label" htmlFor="edit-video-category">Catégorie</label>
          <select id="edit-video-category" className="form-select mb-3" value={editCategory} onChange={e=>setEditCategory(e.target.value)}>
            {options?.categories.map(x=><option key={x.id} value={x.id}>{x.slug}</option>)}</select>
          <label className="form-label" htmlFor="edit-video-language">Langue</label>
          <select id="edit-video-language" className="form-select mb-3" value={editLanguage} onChange={e=>setEditLanguage(e.target.value)}>
            {options?.languages.map(x=><option key={x.isoCode2} value={x.isoCode2.trim()}>{languageName(x.isoCode2)}</option>)}</select>
          <div className="form-check"><input className="form-check-input" id="edit-video-published" type="checkbox"
            checked={editPublished} onChange={e=>setEditPublished(e.target.checked)}/>
            <label className="form-check-label" htmlFor="edit-video-published">Vidéo publiée sur LMN24</label></div>
        </div><div className="modal-footer"><button type="button" className="btn btn-outline-secondary" onClick={()=>setEditing(null)}>Annuler</button>
          <button type="button" className="btn btn-primary" disabled={busy===editing.id} onClick={()=>void save()}>Enregistrer</button></div>
      </div></div></div>}
  </main>;
}
