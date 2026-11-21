/** SCRUM-121: numeric searches are whole national channel numbers only. */
export function classifyTvWorldQuery(input:string):{
 query:string;numeric:boolean;number:number|null
}{
 const query=input.trim();
 const numeric=/^[0-9]+$/.test(query);
 if(!numeric)return {query,numeric:false,number:null};
 // PostgreSQL numbers in the TV catalogue are 32-bit integers.
 const value=BigInt(query);
 return {query,numeric:true,number:value<=2147483647n?Number(value):null};
}
