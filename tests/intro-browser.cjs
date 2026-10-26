const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.ARCADE_URL||'http://127.0.0.1:5055';
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 const errors=[];
 async function page(options={}){
  const c=await b.newContext(options),p=await c.newPage();
  p.on('pageerror',e=>errors.push(e.message));return {c,p};
 }
 try{
  for(const mobile of [false,true]){
   const {c,p}=await page({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
   const media=[];p.on('request',r=>{if(r.url().endsWith('.mp4'))media.push(r.url())});
   await p.goto(base+'/secreto?modo=pc');
   await p.waitForFunction(()=>document.querySelector('#arcade-intro').matches(':modal'));
   await p.waitForFunction(()=>document.querySelector('#intro-video').currentTime>.3);
   assert.equal(await p.locator('#intro-video').evaluate(v=>v.muted),true);
   assert.ok(media.length>0&&media.every(u=>u.endsWith(mobile?'intro-movil-v1.mp4':'intro-pc-v1.mp4')),media.join(','));
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await p.locator('#intro-sonido').click();
   assert.equal(await p.locator('#intro-video').evaluate(v=>v.muted),false);
   await p.locator('#intro-pausa').click();
   assert.equal(await p.locator('#intro-video').evaluate(v=>v.paused),true);
   await p.locator('#intro-sonido').click();
   assert.equal(await p.locator('#intro-video').evaluate(v=>v.muted&&v.paused),true);
   await p.locator('#intro-pausa').click();
   await p.waitForFunction(()=>!document.querySelector('#intro-video').paused);
   if(process.env.CAPTURAS_INTRO){
    fs.mkdirSync(process.env.CAPTURAS_INTRO,{recursive:true});
    await p.locator('#intro-video').evaluate(v=>{v.currentTime=8;});
    await p.waitForTimeout(350);
    await p.screenshot({path:process.env.CAPTURAS_INTRO+(mobile?'/intro-movil.png':'/intro-pc.png')});
   }
   await p.locator('#intro-saltar').click();
   await p.waitForFunction(()=>!document.querySelector('#arcade-intro').open&&!document.querySelector('#intro-video').hasAttribute('src'));
   assert.equal(await p.locator('#intro-video').evaluate(v=>v.paused),true);
   assert.notEqual(await p.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
   await p.locator('#intro-repetir').click();
   await p.waitForFunction(()=>document.querySelector('#intro-video').currentTime>.1);
   await p.locator('#intro-video').evaluate(v=>{v.currentTime=v.duration-.3});
   await p.waitForFunction(()=>!document.querySelector('#arcade-intro').open);
   await p.reload();
   assert.equal(await p.locator('#arcade-intro').evaluate(d=>d.open),false);
   await p.locator('#intro-repetir').click();
   await p.waitForFunction(()=>document.querySelector('#arcade-intro').open);
   await p.keyboard.press('Escape');
   await p.waitForFunction(()=>!document.querySelector('#arcade-intro').open);
   await c.close();console.log('PASS',mobile?'móvil':'PC','fuente única, autoplay, música, pausa, saltar, replay, final y recarga');
  }
  {
   const {c,p}=await page({reducedMotion:'reduce'});const media=[];
   p.on('request',r=>{if(r.url().endsWith('.mp4'))media.push(r.url())});
   await p.goto(base+'/secreto');await p.waitForTimeout(500);
   assert.equal(media.length,0,'reduced motion does not download video before play');
   await p.getByRole('button',{name:'Reproducir con música'}).click();
   await p.waitForFunction(()=>document.querySelector('#intro-video').currentTime>.1);
   await p.locator('#intro-saltar').click();
   await p.locator('#selector-modo button[data-modo=pc]').click();
   assert.equal(await p.evaluate(()=>document.body.classList.contains('modo-pc')),true);
   await c.close();console.log('PASS movimiento reducido y selector de dispositivo');
  }
  {
   const {c,p}=await page();
   await p.addInitScript(()=>{const orig=HTMLMediaElement.prototype.play;let first=true;HTMLMediaElement.prototype.play=function(){if(first){first=false;return Promise.reject(new DOMException('blocked','NotAllowedError'))}return orig.call(this)}});
   await p.goto(base+'/secreto?modo=pc');
   await p.getByRole('button',{name:'Reproducir con música'}).click();
   await p.waitForFunction(()=>document.querySelector('#intro-video').currentTime>.1);
   await c.close();console.log('PASS autoplay bloqueado recuperable por gesto');
  }
  {
   const {c,p}=await page();await p.route('**/intro-*-v1.mp4',r=>r.fulfill({status:404,body:''}));
   await p.goto(base+'/secreto?modo=pc');
   await p.waitForFunction(()=>!document.querySelector('#arcade-intro').open);
   assert.notEqual(await p.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
   await c.close();console.log('PASS vídeo no disponible: acceso al menú');
  }
  {
   const {c,p}=await page({javaScriptEnabled:false});await p.goto(base+'/secreto?modo=pc');
   assert.equal(await p.locator('#arcade-intro').isVisible(),false);
   assert.notEqual(await p.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
   await c.close();console.log('PASS sin JavaScript: menú accesible');
  }
  assert.deepEqual(errors,[]);
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});
