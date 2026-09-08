// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright module, if not installed locally.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const profile = { slug:'sample', nickname:'林同学', school:'中山大学', city:'广州', intro:'用 AI 把想法变成作品，期待遇见一起动手的伙伴。', skills:['AI应用'], roles:[], currentFocus:'探索校园项目', workLinks:['https://example.com/'+'portfolio'.repeat(20)], contributions:[] };
const counterpart = { ...profile, nickname:'VeryLongMemberNameWithoutSpaces', school:'SchoolNameWithoutSpaces'.repeat(4) };
const item = {request:{id:'sample', topic:'交流', message:'一起交流校园项目。'.repeat(12),status:'pending',createdAt:1,updatedAt:1},counterpart,counterpartSlug:'sample',unlockedContactCard:{email:'long'.repeat(30)+'@example.com',otherLabel:'OtherContact'.repeat(8),otherValue:'https://example.com/'+'link'.repeat(60)}};
const source = `import React from 'react';import{createRoot}from'react-dom/client';import{ProfileEditor}from'./components/forms/ProfileEditor';import About from './app/about/page';createRoot(document.getElementById('root')).render(location.pathname==='/about'?<About/>:<main className="member-center-shell"><div className="member-center-content"><ProfileEditor profile={${JSON.stringify(profile)}} visibility={{currentFocus:'public',workLinks:'public'}} schools={[{id:'school',name:'中山大学',campus:'广州校区',city:'广州'}]} currentSchoolId="school" published={true}/></div></main>);`;
// Layout harness: framework navigation is a plain link; Image preserves its fill geometry.
const frameworkElements={name:'framework-elements',setup(build){build.onResolve({filter:/^next\/(image|link)$/},args=>({path:args.path,namespace:'qa'}));build.onLoad({filter:/.*/,namespace:'qa'},args=>({loader:'tsx',resolveDir:root,contents:args.path==='next/link'?`import React from 'react';export default props=><a {...props}/>;`:`import React from 'react';export default ({fill,priority,unoptimized,...props})=><img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:props.style}/>;` }));}};
const bundle = await require('esbuild').build({absWorkingDir:root,plugins:[frameworkElements],stdin:{contents:source,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'},jsx:'automatic'});
const css = await require('postcss')([require('@tailwindcss/postcss')()]).process(await fs.readFile('app/globals.css','utf8'),{from:path.join(root,'app/globals.css')});
const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css.css+'</style><div id="root"></div><script src="/app.js"></script></html>';
const mutations = [];
const server = http.createServer(async(req,res)=>{
  const url = new URL(req.url,'http://localhost');
  if(url.pathname==='/app.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);}
  else if(url.pathname.startsWith('/api/')) {
    res.setHeader('content-type','application/json');
    if(req.method!=='GET'){mutations.push(url.pathname);if(url.pathname==='/api/me/profile'){res.end(JSON.stringify({updated:true}));return;}res.statusCode=503;res.end(JSON.stringify({error:'测试：网络暂时不可用'}));return;}
    const box=url.searchParams.get('box');
    // Slow received responses expose races when switching tabs quickly.
    const items=box==='received'?[item]:box==='accepted'?[{...item,request:{...item.request,status:'accepted'}}]:[];
    setTimeout(()=>res.end(JSON.stringify({items})),box==='received'?180:10);
  } else if(/^\/(brand|about)\//.test(url.pathname)) {
    try{res.setHeader('content-type',url.pathname.endsWith('.webp')?'image/webp':'image/png');res.end(await fs.readFile(path.join(root,'public',url.pathname)));}catch{res.statusCode=404;res.end();}
  } else {res.setHeader('content-type','text/html; charset=utf-8');res.end(html);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const output=path.join(root,'.codex-mobile-qa');await fs.mkdir(output,{recursive:true});
async function fits(selector){assert(await page.locator(selector).evaluateAll(elements=>elements.every(el=>el.scrollWidth<=el.clientWidth+1)),selector+' must not overflow');}
try {
  for(const width of [320,390,430]) {
    await page.setViewportSize({width,height:740});await page.goto(base);
    for(const name of ['个人资料','联系方式与链接','资料展示','账号设置']) {await page.getByRole('tab',{name,exact:true}).click();await fits('html');await fits('.settings-panel:not([hidden])');}
    await page.getByRole('tab',{name:'个人资料',exact:true}).click();await page.getByRole('textbox',{name:'昵称',exact:true}).fill('保存后的昵称');await page.getByRole('button',{name:'保存更改',exact:true}).click();await page.getByText('个人资料已保存。',{exact:true}).waitFor();
    await page.getByRole('button',{name:'预览公开主页',exact:true}).click();await page.getByRole('dialog').getByRole('heading',{name:'保存后的昵称',exact:true}).waitFor();await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'连接中心',exact:true}).click();await page.getByRole('button',{name:'查看',exact:true}).click();
    await fits('.connection-dialog');
    assert(await page.locator('.connection-dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),'member dialog must fit viewport');
    assert(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow==='hidden'),'background scroll is locked');
    await page.screenshot({path:path.join(output,`member-dialog-${width}.png`)});
    await page.getByRole('button',{name:'接受',exact:true}).click();await page.getByRole('dialog').last().getByRole('alert').waitFor();
    await page.keyboard.press('Escape');assert.equal(await page.locator('.profile-quick-panel').count(),1,'Escape closes only the nested dialog');
    assert.equal(await page.evaluate(()=>document.activeElement.textContent),'查看','focus returns to the request');
    await page.getByRole('tab',{name:'好友列表',exact:true}).click();await page.getByText('更多安全操作').click();await fits('.profile-quick-panel-content');await fits('.connection-card');
    await page.getByRole('button',{name:'举报',exact:true}).click();await page.getByRole('heading',{name:'举报成员'}).waitFor();await fits('.connection-dialog');await page.keyboard.press('Escape');assert.equal(await page.locator('.profile-quick-panel').count(),1);
    await page.screenshot({path:path.join(output,`connections-${width}.png`)});
    await page.getByRole('tab',{name:'公开主页',exact:true}).click();await fits('.profile-quick-panel-content');await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'连接中心',exact:true}).click();await page.getByRole('tab',{name:'好友列表',exact:true}).click();await page.getByText('更多安全操作').waitFor();
    await page.waitForTimeout(250);assert.equal(await page.getByText('更多安全操作').count(),1,'late new-friends response must not replace friends');
    await page.keyboard.press('Escape');
    const assets=[];page.on('request',req=>{if(req.url().includes('/about/')&&/\.(png|webp)/.test(req.url()))assets.push(req.url());});
    await page.goto(base+'/about');await page.getByRole('heading',{level:1}).waitFor();await fits('html');assert.deepEqual(assets,[],'mobile must not download hidden desktop artwork');
    await page.screenshot({path:path.join(output,`about-${width}.png`),fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/about');
  for(const artwork of await page.locator('.about-artwork img').all()){await artwork.scrollIntoViewIfNeeded();await artwork.evaluate(img=>img.decode());}
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,'about-desktop.png'),fullPage:true});await fits('html');
  await page.setViewportSize({width:667,height:375});await page.goto(base);await page.getByRole('button',{name:'连接中心',exact:true}).click();await page.getByRole('button',{name:'查看',exact:true}).click();assert(await page.locator('.connection-dialog').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'short viewport scrolls inside modal');
  assert.deepEqual(errors,[]);console.log('PASS 320/390/430px settings, connections, nested dialogs, errors, tab races, preview, About assets, 667x375 landscape. Mock mutations only:',mutations.length);
} finally {await browser.close();server.close();}
