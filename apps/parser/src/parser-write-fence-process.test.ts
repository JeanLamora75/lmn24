import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createPrismaClient, fencedParserWrite } from "@lmn24/database";
import { acquireGlobalParserLease } from "./global-parser-lock.js";

const enabled=process.env.SCHEDULER_PG_INTEGRATION==="1" && !!process.env.DATABASE_URL;
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

describe.skipIf(!enabled)("PostgreSQL parser business-write fencing",()=>{
  it("holds the transaction fence until COMMIT and rejects superseded owners",async()=>{
    const db=createPrismaClient();
    const url=process.env.DATABASE_URL!;
    const first=await acquireGlobalParserLease(url);
    let second:Awaited<ReturnType<typeof acquireGlobalParserLease>>|undefined;
    let unlockWrite:()=>void=()=>undefined;
    let ready:()=>void=()=>undefined;
    const blocked=new Promise<void>(resolve=>{unlockWrite=resolve;});
    const entered=new Promise<void>(resolve=>{ready=resolve;});
    const originalId=randomUUID();
    const nextId=randomUUID();
    try{
      await db.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS parser_fence_integration_test (id UUID PRIMARY KEY)");
      const oldWrite=fencedParserWrite(db,first.ownerToken,async tx=>{
        await tx.$executeRaw`INSERT INTO parser_fence_integration_test(id) VALUES(${originalId}::uuid)`;
        ready();
        await blocked;
      });
      await entered;
      await first.release();
      let successorReady=false;
      const acquisition=acquireGlobalParserLease(url).then(lease=>{
        successorReady=true;
        return lease;
      });
      await pause(400);
      expect(successorReady).toBe(false);
      unlockWrite();
      await oldWrite;
      second=await acquisition;
      expect(successorReady).toBe(true);
      await expect(fencedParserWrite(db,first.ownerToken,tx=>
        tx.$executeRaw`INSERT INTO parser_fence_integration_test(id) VALUES(${nextId}::uuid)`
      )).rejects.toThrow();
      expect(await db.$queryRaw<Array<{id:string}>>`
        SELECT id FROM parser_fence_integration_test WHERE id=${nextId}::uuid
      `).toHaveLength(0);
      await fencedParserWrite(db,second.ownerToken,tx=>
        tx.$executeRaw`INSERT INTO parser_fence_integration_test(id) VALUES(${nextId}::uuid)`
      );
      expect(await db.$queryRaw<Array<{id:string}>>`
        SELECT id FROM parser_fence_integration_test WHERE id=${nextId}::uuid
      `).toHaveLength(1);
    }finally{
      unlockWrite();
      await second?.release();
      await first.release();
      await db.$executeRaw`DELETE FROM parser_fence_integration_test WHERE id IN (${originalId}::uuid,${nextId}::uuid)`.catch(()=>undefined);
      await db.$disconnect();
    }
  },45_000);
});
