import { afterEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const enabled=process.env.SCHEDULER_PG_INTEGRATION==="1" && !!process.env.DATABASE_URL;
const fixture=fileURLToPath(new URL("./lease-loss-child.ts",import.meta.url));
const spawned:ChildProcess[]=[];

afterEach(()=>{
  for(const child of spawned)if(child.exitCode===null && child.signalCode===null)child.kill("SIGKILL");
  spawned.length=0;
});

describe.skipIf(!enabled)("global parser lease disconnection safety",()=>{
  it("exits immediately when PostgreSQL terminates its lock session",async()=>{
    const child=spawn(process.execPath,["--import","tsx",fixture],{
      env:process.env,stdio:["ignore","pipe","pipe"],
    });
    spawned.push(child);
    let output="";
    const pid=await Promise.race([
      new Promise<number>((resolve,reject)=>{
        child.stdout?.on("data",(part:Buffer)=>{
          output+=part.toString();
          const match=/LEASE_HELD:(\\d+)/.exec(output);
          if(match)resolve(Number(match[1]));
        });
        child.once("error",reject);
        child.once("exit",code=>reject(new Error("Child exited prematurely: "+code+" "+output)));
      }),
      new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("Lock holder timeout")),15_000)),
    ]);
    const client=new Client({connectionString:process.env.DATABASE_URL});
    try{
      await client.connect();
      const killed=await client.query<{stopped:boolean}>(
        "SELECT pg_terminate_backend($1) AS stopped",[pid]);
      expect(killed.rows[0]?.stopped).toBe(true);
    }finally{
      await client.end();
    }
    const [code]=await Promise.race([
      once(child,"exit"),
      new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("Lease owner did not exit")),10_000)),
    ]) as [number|null,NodeJS.Signals|null];
    expect(code).toBe(1);
    expect(output).not.toContain("UNSAFE_CONTINUATION");
  },40_000);
});
