import { afterEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createPrismaClient } from "@lmn24/database";
import { recoverOrphanedSchedulerJobs } from "./scheduler-recovery.js";

const enabled=process.env.SCHEDULER_PG_INTEGRATION==="1" && !!process.env.DATABASE_URL;
const fixture=fileURLToPath(new URL("./global-parser-lock-child.ts",import.meta.url));
const children:ChildProcess[]=[];

async function startHolder():Promise<ChildProcess>{
  const child=spawn(process.execPath,["--import","tsx",fixture],{
    env:process.env,stdio:["ignore","pipe","pipe"],
  });
  children.push(child);
  await Promise.race([
    new Promise<void>((resolve,reject)=>{
      let output="";
      child.stdout?.on("data",(part:Buffer)=>{
        output+=part.toString();
        if(output.includes("LOCK_ACQUIRED"))resolve();
        if(output.includes("LOCK_BUSY"))reject(new Error("Lock unexpectedly busy"));
      });
      child.once("error",reject);
      child.once("exit",code=>reject(new Error("Holder exited: "+code+" "+output)));
    }),
    new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("Holder startup timeout")),15000)),
  ]);
  return child;
}

afterEach(async()=>{
  for(const child of children)if(child.exitCode===null && child.signalCode===null)child.kill("SIGKILL");
  children.length=0;
});

describe.skipIf(!enabled)("real process crash and orphan recovery",()=>{
  it("refuses recovery while holder lives, then recovers exactly one stale job after SIGKILL",async()=>{
    const db=createPrismaClient();
    const id=randomUUID(),owner=randomUUID();
    const old=new Date("2020-01-01T00:00:00Z");
    let holder:ChildProcess|undefined;
    try{
      await db.schedulerJob.create({data:{
        id,parserType:"INFOS",scheduledFor:new Date("2037-02-03T00:00:00Z"),
        status:"RUNNING",attempt:1,ownerToken:owner,
        heartbeatAt:old,startedAt:old,
      }});
      holder=await startHolder();
      const cutoff=new Date(Date.now()-5*60_000);
      expect(await recoverOrphanedSchedulerJobs(db,process.env.DATABASE_URL!,cutoff)).toBeNull();
      expect((await db.schedulerJob.findUniqueOrThrow({where:{id}})).status).toBe("RUNNING");
      holder.kill("SIGKILL");
      if(holder.exitCode===null && holder.signalCode===null)await once(holder,"exit");
      let changed:number|null=null;
      const deadline=Date.now()+12_000;
      while(Date.now()<deadline){
        changed=await recoverOrphanedSchedulerJobs(db,process.env.DATABASE_URL!,cutoff);
        if(changed!==null)break;
        await new Promise(resolve=>setTimeout(resolve,250));
      }
      expect(changed).toBe(1);
      const recovered=await db.schedulerJob.findUniqueOrThrow({where:{id}});
      expect(recovered.status).toBe("PENDING");
      expect(recovered.ownerToken).toBeNull();
      expect(recovered.attempt).toBe(1);
    }finally{
      if(holder?.exitCode===null&&holder.signalCode===null)holder.kill("SIGKILL");
      await db.schedulerJob.deleteMany({where:{id}});
      await db.$disconnect();
    }
  },45000);
});
