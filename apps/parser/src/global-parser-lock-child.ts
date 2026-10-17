import { acquireGlobalParserLease, GlobalParserBusyError } from "./global-parser-lock.js";

async function main() {
  const url=process.env.DATABASE_URL;
  if(!url)throw new Error("DATABASE_URL required");
  const lease=await acquireGlobalParserLease(url);
  process.stdout.write("LOCK_ACQUIRED\n");
  process.on("SIGTERM", () => { void lease.release().finally(()=>process.exit(0)); });
  await new Promise<void>(()=>{});
}

main().catch(error=>{
  if(error instanceof GlobalParserBusyError) {
    process.stdout.write("LOCK_BUSY\n");
    process.exitCode=2;
  } else {
    console.error(error);
    process.exitCode=1;
  }
});
