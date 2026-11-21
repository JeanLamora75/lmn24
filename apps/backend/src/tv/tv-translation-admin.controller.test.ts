import {describe,expect,it,vi} from "vitest";
import {ConfigService} from "@nestjs/config";
import {AuthService} from "../auth/auth.service";
import {TvTranslationAdminService} from "./tv-translation-admin.service";
import {TvTranslationAdminController} from "./tv-translation-admin.controller";
import {TvTranslationWorkflowService} from "./tv-translation-workflow.service";

const request={headers:{cookie:"lmn24_session=example"}};
const uuid="f1000000-0000-4000-8000-000000000001";
function setup(role:"ADMIN"|"EDITOR"|null,enabled=true){
 const providers=vi.fn().mockResolvedValue({items:[]});
 const selectProvider=vi.fn().mockResolvedValue({id:uuid,selected:true});
 const descriptions=vi.fn().mockResolvedValue({items:[]});
 const setManualDescription=vi.fn().mockResolvedValue({languageCode:"fr",origin:"MANUAL"});
 const auth={getUserFromSession:vi.fn().mockResolvedValue(role?{role}:null)} as unknown as AuthService;
 const registerLocalProvider=vi.fn().mockResolvedValue({status:"PENDING_REVIEW"});
 const service={providers,selectProvider,descriptions,setManualDescription,registerLocalProvider} as unknown as TvTranslationAdminService;
 const config={get:(key:string)=>key==="TV_CATALOG_ADMIN_ENABLED"?(enabled?"true":"false"):undefined} as unknown as ConfigService;
 const statuses=vi.fn().mockResolvedValue({items:[]});
 const preview=vi.fn().mockResolvedValue({status:"PARTIAL",translated:{de:"Hallo"},failed:["es"]});
 const approve=vi.fn().mockResolvedValue({saved:["de"],conflicts:[]});
 const workflow={statuses,preview,approve} as unknown as TvTranslationWorkflowService;
 return {controller:new TvTranslationAdminController(auth,service,config,workflow),providers,selectProvider,setManualDescription,registerLocalProvider,preview,approve};
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
 }); it("SCRUM-123 never previews for anonymous, editor or disabled admin",async()=>{
  const anonymous=setup(null);const editor=setup("EDITOR");const disabled=setup("ADMIN",false);
  for(const [s,status] of [[anonymous,401],[editor,403],[disabled,503]] as const){
   await expect(s.controller.preview(request,uuid,{sourceLanguage:"fr"})).rejects.toMatchObject({status});
   expect(s.preview).not.toHaveBeenCalled();
  }
 });
 it("SCRUM-123 validates source locale, target set and preview token",async()=>{
  const s=setup("ADMIN");
  await expect(s.controller.preview(request,uuid,{sourceLanguage:"zz"})).rejects.toMatchObject({status:400});
  await expect(s.controller.approve(request,uuid,{previewId:uuid,languages:["zz"]})).rejects.toMatchObject({status:400});
  await expect(s.controller.approve(request,uuid,{previewId:"bad",languages:["de"]})).rejects.toMatchObject({status:400});
  expect(s.approve).not.toHaveBeenCalled();
  await expect(s.controller.preview(request,uuid,{sourceLanguage:"fr"})).resolves.toMatchObject({status:"PARTIAL"});
  await expect(s.controller.approve(request,uuid,{previewId:uuid,languages:["de"]})).resolves.toMatchObject({saved:["de"]});
 });

});
