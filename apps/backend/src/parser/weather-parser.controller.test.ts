import {describe,expect,it,vi} from "vitest";
import {ForbiddenException,UnauthorizedException,BadRequestException} from "@nestjs/common";
import {ParserController} from "./parser.controller";

function setup(user:unknown={role:"ADMIN"}) {
  const gateway={
    startWeatherRun:vi.fn(async()=>({accepted:true,runId:"abc"})),
    listWeatherRuns:vi.fn(async()=>({items:[]})),
    getWeatherRun:vi.fn(async()=>({id:"abc",status:"SUCCESS"})),
  };
  const auth={getUserFromSession:vi.fn(async()=>user)};
  const controller=new ParserController(gateway as never,auth as never,{
    get:vi.fn(()=>undefined),
  } as never);
  const req={headers:{cookie:"lmn24_session=valid"}};
  return {controller,gateway,auth,req};
}
describe("SCRUM-72 weather parser admin protection",()=>{
  it("starts only validated manual weather payloads for ADMIN",async()=>{
    const {controller,gateway,req}=setup();
    await expect(controller.startWeather(req, {continentCode:"AF"})).resolves.toEqual({
      accepted:true,runId:"abc",
    });
    expect(gateway.startWeatherRun).toHaveBeenCalledWith({continentCode:"AF"});
    await expect(controller.startWeather(req,{})).resolves.toBeDefined();
    await expect(controller.startWeather(req,{continentCode:"XX"})).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.startWeather(req,{scheduled:true})).rejects.toBeInstanceOf(BadRequestException);
    expect(gateway.startWeatherRun).toHaveBeenCalledTimes(2);
  });
  it("rejects unauthenticated users and non-admins for both reads and writes",async()=>{
    const unauth=setup(null);
    await expect(unauth.controller.startWeather(unauth.req,{})).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(unauth.controller.listWeather(unauth.req)).rejects.toBeInstanceOf(UnauthorizedException);
    const editor=setup({role:"EDITOR"});
    await expect(editor.controller.startWeather(editor.req,{})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(editor.controller.getWeather(editor.req,"11111111-1111-4111-8111-111111111111")).rejects.toBeInstanceOf(ForbiddenException);
    expect(editor.gateway.startWeatherRun).not.toHaveBeenCalled();
    expect(editor.gateway.getWeatherRun).not.toHaveBeenCalled();
  });
  it("allows ADMIN to retrieve run history and validates run id",async()=>{
    const {controller,gateway,req}=setup();
    await expect(controller.listWeather(req)).resolves.toEqual({items:[]});
    await expect(controller.getWeather(req,"11111111-1111-4111-8111-111111111111")).resolves.toBeDefined();
    await expect(controller.getWeather(req,"not-an-id")).rejects.toBeInstanceOf(BadRequestException);
    expect(gateway.getWeatherRun).toHaveBeenCalledTimes(1);
  });
});
