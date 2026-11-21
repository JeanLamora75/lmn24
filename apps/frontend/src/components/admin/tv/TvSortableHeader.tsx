"use client";
import type {ReactNode} from "react";

export type TvSortDirection="asc"|"desc";
export type TvSortState={key:string;direction:TvSortDirection}|null;

/** Locale-aware sort: numbers are numeric, blanks remain last in both directions. */
export function sortTvRows<T>(rows:readonly T[],sort:TvSortState,
 get:(row:T,key:string)=>string|number|boolean|null|undefined,locale="fr"):T[]{
 if(!sort)return [...rows];
 const collator=new Intl.Collator(locale,{numeric:true,sensitivity:"base"});
 return rows.map((row,index)=>({row,index})).sort((a,b)=>{
  const x=get(a.row,sort.key),y=get(b.row,sort.key);
  const missing=(v:typeof x)=>v===null||v===undefined||v==="";
  if(missing(x)&&missing(y))return a.index-b.index;
  if(missing(x))return 1;
  if(missing(y))return -1;
  const order=typeof x==="number"&&typeof y==="number"?x-y
   :typeof x==="boolean"&&typeof y==="boolean"?Number(x)-Number(y)
   :collator.compare(String(x),String(y));
  return (sort.direction==="asc"?order:-order)||a.index-b.index;
 }).map(({row})=>row);
}
export function nextTvSort(current:TvSortState,key:string):TvSortState{
 return {key,direction:current?.key===key&&current.direction==="asc"?"desc":"asc"};
}
export function TvSortableHeader({label,sortKey,sort,onSort,children}:{
 label:string;sortKey:string;sort:TvSortState;onSort:(key:string)=>void;children?:ReactNode;
}){
 const direction=sort?.key===sortKey?sort.direction:null;
 return <th scope="col" aria-sort={direction==="asc"?"ascending":direction==="desc"?"descending":"none"}>
  <button type="button" className="btn btn-link text-reset text-decoration-none p-0 fw-semibold text-start"
   onClick={()=>onSort(sortKey)} title={"Trier par "+label}
   aria-label={"Trier par "+label+(direction==="asc"?", ordre croissant":direction==="desc"?", ordre décroissant":"")}>
   <span aria-hidden="true" className="d-inline-block me-1" style={{width:"1em",textAlign:"center"}}>
    {direction==="asc"?"↑":direction==="desc"?"↓":""}
   </span>{children??label}
  </button>
 </th>;
}
