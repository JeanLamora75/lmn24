"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import frMessages from "../../../messages/fr.json";

type Options = { sources: { id: string; name: string; youtubeUrl: string | null }[]; categories: { id: string; slug: string }[]; languages: { isoCode2: string }[] };
type Feed = { id: string; sourceId: string; categoryId: string; languageIsoCode2: string; channelId: string; feedUrl: string; isActive: boolean };
type Row = Feed & { source: { name: string }; category: { slug: string }; lastRun: { status: string; startedAt: string; errorMessage: string | null } | null; _count: { videos: number; runs: number } };
type Listing = { items: Row[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
const base = "/api/admin/video-feeds";
const channelPattern = /^UC[A-Za-z0-9_-]{22}$/;
function getChannelId(url: string) {
  try {
    const u = new URL(url);
    if (!["youtube.com","www.youtube.com"].includes(u.hostname)) return "";
    const fromFeed = u.pathname === "/feeds/videos.xml" ? u.searchParams.get("channel_id") : null;
    const fromChannel = u.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})\/?$/)?.[1];
    return fromFeed ?? fromChannel ?? "";
  } catch { return ""; }
}
async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { cache: "no-store", ...init });
  if (!r.ok) throw new Error(r.status === 409 ? "Ce flux existe déjà ou possède des vidéos / exécutions. Désactivez-le plutôt." : "Erreur serveur (" + r.status + ").");
  return r.json() as Promise<T>;
}
function readableLanguage(value: string): string {
  try {
    return new Intl.DisplayNames(["fr"], { type: "language" }).of(value.trim().toLowerCase()) ?? value;
  } catch { return value; }
}
const formatDate = (s: string | undefined) => s ? new Date(s).toLocaleString("fr-FR") : "Jamais";

export function VideoFeedsTable() {
  const [items,setItems] = useState<Listing | null>(null);
  const [options,setOptions] = useState<Options | null>(null);
  const [search,setSearch] = useState("");
  const [sourceId,setSourceId] = useState("");
  const [categoryId,setCategoryId] = useState("");
  const [language,setLanguage] = useState("");
  const [status,setStatus] = useState("all");
  const [page,setPage] = useState(1);
  const [revision,setRevision] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const refresh = useCallback(() => setRevision(x=>x+1),[]);
  useEffect(() => { const c=new AbortController(); json<Options>(base+"/form-options",{signal:c.signal}).then(x=>{if(!c.signal.aborted)setOptions(x);}).catch(()=>{});return ()=>c.abort(); },[]);
  useEffect(() => {
    const c=new AbortController();
    const q=new URLSearchParams({page:String(page),pageSize:"10",status});
    if(search.trim())q.set("search",search.trim());
    if(sourceId)q.set("sourceId",sourceId);
    if(categoryId)q.set("categoryId",categoryId);
    if(language)q.set("language",language);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    json<Listing>(base+"?"+q,{signal:c.signal}).then(x=>{if(!c.signal.aborted){setItems(x);setError("");}})
      .catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Chargement impossible");})
      .finally(()=>{if(!c.signal.aborted)setLoading(false);});
    return ()=>c.abort();
  },[page,status,search,sourceId,categoryId,language,revision]);
  async function collect(item: Row) {
    try {
      await json<{ accepted: boolean }>(base+"/collect",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({feedId:item.id})});
      window.alert("Collecte vidéo démarrée. Actualisez la liste dans quelques instants pour consulter le résultat.");
    } catch (e) { setError(e instanceof Error ? e.message : "Collecte impossible."); }
  }
  async function toggle(item:Row) {
    try {await json(base+"/"+item.id+"/status",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({isActive:!item.isActive})});refresh();}
    catch(e){setError(e instanceof Error?e.message:"Modification impossible");}
  }
  async function remove(item:Row) {
    if(!window.confirm("Supprimer ce flux vidéo ? Les flux ayant des vidéos ou un historique ne sont pas supprimables."))return;
    try{await json(base+"/"+item.id,{method:"DELETE"});refresh();}
    catch(e){setError(e instanceof Error?e.message:"Suppression impossible");}
  }
  return <main className="container py-4">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div><Link href="/admin" className="btn btn-outline-secondary btn-sm mb-3">← Administration</Link><h1 className="h2">Flux vidéo YouTube</h1><p className="text-body-secondary mb-0">Gérer les chaînes YouTube associées aux sources LMN24.</p></div>
      <Link href="/admin/video-feeds/new" className="btn btn-primary">+ Ajouter un flux vidéo</Link>
    </div>
    <div className="card mb-3"><div className="card-body row g-3">
      <div className="col-12 col-md-4"><label className="form-label" htmlFor="v-search">Recherche</label><input id="v-search" className="form-control" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Nom du média ou identifiant de chaîne"/></div>
      <div className="col-6 col-md-2"><label className="form-label" htmlFor="v-source">Source</label><select id="v-source" className="form-select" value={sourceId} onChange={e=>{setSourceId(e.target.value);setPage(1);}}><option value="">Toutes</option>{options?.sources.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div className="col-6 col-md-2"><label className="form-label" htmlFor="v-category">Catégorie</label><select id="v-category" className="form-select" value={categoryId} onChange={e=>{setCategoryId(e.target.value);setPage(1);}}><option value="">Toutes</option>{options?.categories.map(x=><option key={x.id} value={x.id}>{x.slug}</option>)}</select></div>
      <div className="col-6 col-md-2"><label className="form-label" htmlFor="v-language">Langue</label><select id="v-language" className="form-select" value={language} onChange={e=>{setLanguage(e.target.value);setPage(1);}}><option value="">Toutes</option>{options?.languages.map(x=><option key={x.isoCode2} value={x.isoCode2.trim()}>{x.isoCode2.trim()}</option>)}</select></div>
      <div className="col-6 col-md-2"><label className="form-label" htmlFor="v-status">État</label><select id="v-status" className="form-select" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="all">Tous</option><option value="active">Actifs</option><option value="inactive">Inactifs</option></select></div>
    </div></div>
    {error&&<div className="alert alert-danger" role="alert">{error} <button className="btn btn-sm btn-outline-danger" onClick={refresh}>Réessayer</button></div>}
    {loading&&<p role="status">Chargement des flux vidéo…</p>}
    {items&&<div className="card shadow-sm"><div className="table-responsive"><table className="table table-hover mb-0 align-middle"><thead><tr><th>Source</th><th>Chaîne</th><th>Catégorie / langue</th><th>Dernier traitement</th><th>Vidéos</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
      {items.items.map(item=><tr key={item.id}><td>{item.source.name}</td><td className="text-break"><a href={"https://www.youtube.com/channel/"+encodeURIComponent(item.channelId)} target="_blank" rel="noopener noreferrer">{item.channelId}</a></td><td>{item.category.slug} / {item.languageIsoCode2.trim()}</td><td>{formatDate(item.lastRun?.startedAt)}<div className="small text-body-secondary">{item.lastRun?.status??"Jamais exécuté"}</div></td><td>{item._count.videos}</td><td><span className={"badge "+(item.isActive?"text-bg-success":"text-bg-secondary")}>{item.isActive?"Actif":"Inactif"}</span></td><td><div className="d-flex gap-2 flex-wrap"><Link className="btn btn-sm btn-outline-primary" href={"/admin/video-feeds/"+item.id+"/edit"}>Modifier</Link><button type="button" className="btn btn-sm btn-outline-success" disabled={!item.isActive} onClick={()=>void collect(item)}>Collecter</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={()=>void toggle(item)}>{item.isActive?"Désactiver":"Activer"}</button><button type="button" className="btn btn-sm btn-outline-danger" onClick={()=>void remove(item)} disabled={item._count.runs>0||item._count.videos>0}>Supprimer</button></div></td></tr>)}
      {!items.items.length&&<tr><td colSpan={7} className="text-center py-4 text-body-secondary">Aucun flux vidéo trouvé.</td></tr>}
    </tbody></table></div><div className="card-footer d-flex justify-content-between align-items-center"><span className="small">{items.pagination.total} flux</span><div className="d-flex gap-2"><button type="button" className="btn btn-outline-secondary btn-sm" disabled={page===1||loading} onClick={()=>setPage(x=>x-1)}>Précédent</button><span className="small align-self-center">Page {page} / {Math.max(1,items.pagination.totalPages)}</span><button type="button" className="btn btn-outline-secondary btn-sm" disabled={page>=items.pagination.totalPages||loading} onClick={()=>setPage(x=>x+1)}>Suivant</button></div></div></div>}
  </main>;
}

export function VideoFeedForm({ id, initialSourceId = "" }: { id?: string; initialSourceId?: string }) {
  const router=useRouter();
  const categoryNames: Record<string, string> = frMessages.categories;
  const categoryName = (slug: string) => categoryNames?.[slug] ?? slug.replace(/-/g, " ");
  const [resolving, setResolving] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [options,setOptions]=useState<Options|null>(null);
  const [sourceId,setSourceId]=useState(initialSourceId);
  const [categoryId,setCategoryId]=useState("");
  const [languageIsoCode2,setLanguage]=useState("fr");
  const [channelId,setChannelId]=useState("");
  const [feedUrl,setFeedUrl]=useState("");
  const [isActive,setActive]=useState(true);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    const c=new AbortController();
    Promise.all([json<Options>(base+"/form-options",{signal:c.signal}),id?json<Feed>(base+"/"+id,{signal:c.signal}):Promise.resolve(null)])
    .then(([o,item])=>{if(c.signal.aborted)return;setOptions(o);if(item){setSourceId(item.sourceId);setCategoryId(item.categoryId);setLanguage(item.languageIsoCode2.trim());setChannelId(item.channelId);setFeedUrl(item.feedUrl);setActive(item.isActive);}else{if(initialSourceId&&!o.sources.some(source=>source.id===initialSourceId))setSourceId("");const news=o.categories.find(category=>["actualite","actualites","news","actuality"].includes(category.slug.toLowerCase()));if(news)setCategoryId(news.id);}})
    .catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Chargement impossible");})
    .finally(()=>{if(!c.signal.aborted)setLoading(false);});
    return ()=>c.abort();
  },[id,initialSourceId]);
  function updateChannel(value:string){const found=getChannelId(value);const next=found||value.trim();setChannelId(next);if(channelPattern.test(next))setFeedUrl("https://www.youtube.com/feeds/videos.xml?channel_id="+next);}
  async function resolveChannel() {
    setResolving(true);
    setLookupMessage("");
    setError("");
    try {
      const query = channelId.trim();
      const payload = await json<{channelId:string;feedUrl:string}>(base+"/resolve-channel", {
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({sourceId, ...(query ? {query} : {})}),
      });
      setChannelId(payload.channelId);
      setFeedUrl(payload.feedUrl);
      setLookupMessage("Identifiant YouTube trouvé. URL Atom renseignée automatiquement.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Recherche YouTube impossible.");
    } finally { setResolving(false); }
  }
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!channelPattern.test(channelId)){setError("L’identifiant de chaîne doit commencer par UC et contenir 24 caractères.");return;}
    setBusy(true);setError("");
    try{await json(base+(id?"/"+id:""),{method:id?"PUT":"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sourceId,categoryId,languageIsoCode2,channelId,feedUrl,isActive})});router.push("/admin/video-feeds");router.refresh();}
    catch(e){setError(e instanceof Error?e.message:"Enregistrement impossible");}finally{setBusy(false);}
  }
  return <main className="container py-4" style={{maxWidth:900}}><Link href="/admin/video-feeds" className="btn btn-outline-secondary btn-sm mb-4">← Flux vidéo</Link><h1 className="h2 mb-4">{id?"Modifier un flux vidéo":"Ajouter un flux vidéo YouTube"}</h1>
    {error&&<div className="alert alert-danger" role="alert">{error}</div>}{loading?<p>Chargement…</p>:<form onSubmit={e=>void submit(e)} className="card shadow-sm"><div className="card-body row g-3">
    <div className="col-12"><label htmlFor="vf-source" className="form-label">Source / Journal *</label><select id="vf-source" className="form-select" required value={sourceId} onChange={e=>setSourceId(e.target.value)}><option value="">Sélectionner une source</option>{options?.sources.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>{options?.sources.find(x=>x.id===sourceId)?.youtubeUrl&&<p className="form-text">Chaîne renseignée sur la source : <a href={options.sources.find(x=>x.id===sourceId)?.youtubeUrl??"#"} target="_blank" rel="noopener noreferrer">Ouvrir YouTube</a></p>}</div>
    <div className="col-md-6"><label htmlFor="vf-category" className="form-label">Catégorie *</label><select id="vf-category" className="form-select" required value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Sélectionner</option>{options?.categories.map(x=><option key={x.id} value={x.id}>{categoryName(x.slug)}</option>)}</select></div>
    <div className="col-md-6"><label htmlFor="vf-language" className="form-label">Langue *</label><select id="vf-language" className="form-select" required value={languageIsoCode2} onChange={e=>setLanguage(e.target.value)}>{options?.languages.map(x=><option key={x.isoCode2} value={x.isoCode2.trim()}>{readableLanguage(x.isoCode2)}</option>)}</select></div>
    <div className="col-12"><label htmlFor="vf-channel" className="form-label">Identifiant de chaîne YouTube (channel_id) *</label><div className="input-group"><input id="vf-channel" className="form-control" required value={channelId} onChange={e=>{setLookupMessage("");updateChannel(e.target.value);}} placeholder="UC… ou @handle YouTube" maxLength={255}/><button type="button" className="btn btn-outline-primary" disabled={resolving||busy} onClick={()=>void resolveChannel()}>{resolving?"Recherche…":"Rechercher"}</button></div>{lookupMessage&&<p className="form-text text-success" role="status">{lookupMessage}</p>}<p className="form-text">Colle un identifiant UC… ou une URL youtube.com/channel/UC… ; les liens @handle devront d’abord être résolus en identifiant de chaîne.</p></div>
    <div className="col-12"><label htmlFor="vf-url" className="form-label">URL du flux Atom XML *</label><input id="vf-url" className="form-control" required type="url" value={feedUrl} onChange={e=>setFeedUrl(e.target.value)} maxLength={2048}/></div>
    <div className="col-12 form-check ms-3"><input id="vf-active" type="checkbox" className="form-check-input" checked={isActive} onChange={e=>setActive(e.target.checked)}/><label htmlFor="vf-active" className="form-check-label">Flux actif</label></div>
    </div><div className="card-footer d-flex justify-content-end gap-2"><Link href="/admin/video-feeds" className="btn btn-outline-secondary">Annuler</Link><button disabled={busy} className="btn btn-primary" type="submit">{busy?"Enregistrement…":"Enregistrer"}</button></div></form>}
  </main>;
}
