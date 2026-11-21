"use client";
import {useEffect,useState} from "react";
import {loadTvCountryNames,type TvCountryNames} from "./tv-country-names";

/** Lazy-load the existing LMN24 country translations for the active locale. */
export function useTvCountryNames(locale:string):TvCountryNames{
 const [state,setState]=useState<{locale:string;names:TvCountryNames}>({locale,names:{}});
 useEffect(()=>{
  let alive=true;
  void loadTvCountryNames(locale).then(names=>{
   if(alive)setState({locale,names});
  }).catch(()=>{
   if(alive)setState({locale,names:{}});
  });
  return ()=>{alive=false;};
 },[locale]);
 return state.locale===locale?state.names:{};
}
