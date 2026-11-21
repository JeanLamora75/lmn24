import {describe,expect,it,vi} from "vitest";
import {ConfigService} from "@nestjs/config";
import {AuthService} from "../auth/auth.service";
import {TvTranslationAdminService} from "./tv-translation-admin.service";
import {TvTranslationAdminController} from "./tv-translation-admin.controller";

const request={headers:{cookie:"lmn24_session=example"}};
const uuid="f1000000-0000-4000-8000-000000000001";
function setup(role:"ADMIN"|"EDITOR"|null,enabled=true){
 const providers=vi.fn().mockResolvedValue({items:[]});
 const selectProvider=vi.fn().mockResolvedValue({id:uuid,selected:true});
 const descriptions=vi.fn().mockResolvedValue({items:[]});
 const setManualDescription=vi.fn().mockResolvedValue({languageCode:"fr",origin:"MANUAL"});
 const auth={getUserFromSession:vi.fn().mockResolvedValue(role?{role}:null)} as unknown as AuthService;
 const service={providers,selectProvider,descriptions,setManualDescription} as unknown as TvTranslationAdminService;
 const config={get:(key:string)=>key==="TV_CATALOG_ADMIN_ENABLED"?(enabled?"true":"false"):undefined} as unknown as ConfigService;
 return {controller:new TvTranslationAdminController(auth,service,config),providers,selectProvider,setManualDescription};
}
describe("SCRUM-122 guarded TV translation administration",()=>{
 it("rejects anonymous, editors and disabled admin without touching provider data",async()=>{
  const anon=setup(null);
  await expect(anon.controller.providers(request)).rejects.toMatchObject({status:401});
  expect(anon.providers).not.toHaveBeenCalled();
  const editor=setup("EDITOR");
  await expect(editor.controller.providers(request)).rejects.toMatchObject({status:403});
  const off=setup("ADMIN",false);
  await expect(off.controller.providers(request)).rejects.toMatchObject({status:503});
 });
 it("validates UUID, supported locales and explicit manual description",async()=>{
  const s=setup("ADMIN");
  await expect(s.controller.selectProvider(request,"invalid")).rejects.toMatchObject({status:400});
  await expect(s.controller.setManual(request,uuid,"xx",{content:"ABC",expectedVersion:null}))
    .rejects.toMatchObject({status:400});
  await expect(s.controller.setManual(request,uuid,"fr",{content:"  ",expectedVersion:null}))
    .rejects.toMatchObject({status:400});
  expect(s.setManualDescription).not.toHaveBeenCalled();
  await expect(s.controller.setManual(request,uuid,"fr",{content:"Un texte",expectedVersion:null}))
    .resolves.toMatchObject({origin:"MANUAL"});
  expect(s.setManualDescription).toHaveBeenCalledWith(uuid,"fr","Un texte",null);
 });
 it("does not expose provider credentials through controller responses",async()=>{
  const s=setup("ADMIN");
  await expect(s.controller.providers(request)).resolves.toEqual({items:[]});
  expect(s.providers).toHaveBeenCalledOnce();
  await expect(s.controller.selectProvider(request,uuid)).resolves.toMatchObject({selected:true});
 });
});
