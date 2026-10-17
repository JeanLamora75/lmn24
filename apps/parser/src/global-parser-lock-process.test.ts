import { afterEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const enabled=Boolean(process.env.SCHEDULER_PG_INTEGRATION && process.env.DATABASE_URL);
const children: ChildProcess[]=[];
const fixture=fileURLToPath(new URL("./global-parser-lock-child.ts", import.meta.url));
const tsx=resolve(process.cwd(),"node_modules","tsx","dist","cli.mjs");

async function launch(): Promise<{child:ChildProcess; outcome:string}> {
  const child=spawn(process.execPath,[tsx,fixture],{
    env:process.env,stdio:["ignore","pipe","pipe"],
  });
  children.push(child);
  const result=await Promise.race([
    new Promise<string>((resolveResult,reject)=>{
      let output="";
      child.stdout?.on("data",(chunk:Buffer)=>{
        output+=chunk.toString();
        if(output.includes("LOCK_ACQUIRED"))resolveResult("LOCK_ACQUIRED");
        if(output.includes("LOCK_BUSY"))resolveResult("LOCK_BUSY");
      });
      child.once("error",reject);
      child.once("exit",code=>reject(new Error("Child exited early: "+code+" output="+output)));
    }),
    new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("Lock fixture timeout")),15000)),
  ]);
  return {child,outcome:result};
}

afterEach(async ()=>{
  for(const child of children) if(child.exitCode===null)child.kill("SIGKILL");
  await Promise.all(children.map(async child=>{
    if(child.exitCode===null && child.signalCode===null)
      await Promise.race([once(child,"exit").catch(()=>undefined),new Promise(r=>setTimeout(r,2000))]);
  }));
  children.length=0;
});

describe.skipIf(!enabled)("global parser lock across Node processes",()=>{
  it("rejects a competing child, releases on SIGKILL, then allows a new child",async()=>{
    const first=await launch();
    expect(first.outcome).toBe("LOCK_ACQUIRED");
    const competing=await launch();
    expect(competing.outcome).toBe("LOCK_BUSY");
    first.child.kill("SIGKILL");
    if(first.child.exitCode===null && first.child.signalCode===null) await once(first.child,"exit");
    const successor=await launch();
    expect(successor.outcome).toBe("LOCK_ACQUIRED");
  },45000);
});
