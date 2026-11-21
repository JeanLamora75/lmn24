declare module "xml2js" {
  export function parseStringPromise(
    xml:string,options?:Record<string,unknown>,
  ):Promise<unknown>;
  // xml2js 0.5.x SAX events used for bounded-memory XMLTV decoding.
  export class Parser {
    constructor(options?:Record<string,unknown>);
    saxParser:{
      write(chunk:string):unknown;
      close():unknown;
      onopentag:(node:{name:string;attributes:Record<string,string>})=>void;
      ontext:(text:string)=>void;
      oncdata:(text:string)=>void;
      ondoctype:(text:string)=>void;
      onclosetag:(name:string)=>void;
    };
  }
}
