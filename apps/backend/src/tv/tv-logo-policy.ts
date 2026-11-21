/** Reject only strong evidence of a generic provider placeholder, not all
 * duplicated images: simulcast channels may legitimately share station logos.
 * Never inspect or delete administrator-uploaded image files.
 */
export type XmltvLogoCandidate={externalId:string;name:string;logoUrl:string|null;logoUrls?:string[]};
export type XmltvLogoDecision={chosen:Map<string,string>;rejected:Set<string>};
const genericFile=/^(?:clear(?:[-_]\d+)?|placeholder|default|no[-_]?logo|unknown|transparent|blank)(?:[-_]\d+)?\.(?:png|jpe?g|webp)$/i;
export function selectXmltvLogos(channels:readonly XmltvLogoCandidate[]):XmltvLogoDecision{
 const usage=new Map<string,Set<string>>();
 for(const channel of channels){
  // Distinct names, not duplicate XMLTV channel entries.
  const identity=channel.name.normalize("NFKC").trim().toLowerCase();
  for(const url of new Set(channel.logoUrls??(channel.logoUrl?[channel.logoUrl]:[]))){
   const group=usage.get(url)??new Set<string>();
   group.add(identity);
   usage.set(url,group);
  }
 }
 const rejected=new Set<string>();
 for(const [url,names] of usage){
  let filename="";
  try{filename=decodeURIComponent(new URL(url).pathname.split("/").pop()??"");}
  catch{continue;}
  if(names.size>=3&&genericFile.test(filename))rejected.add(url);
 }
 const chosen=new Map<string,string>();
 for(const channel of channels){
  const urls=channel.logoUrls??(channel.logoUrl?[channel.logoUrl]:[]);
  const eligible=urls.find(url=>!rejected.has(url));
  if(eligible)chosen.set(channel.externalId,eligible);
 }
 return {chosen,rejected};
}
