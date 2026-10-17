const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  for(const game of ['penales','basquet','boliche','beer_pong','mini_golf','reflejos','cruza_calle','stack','dardos']){
   const page=await context.newPage(); const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.url().includes('127.0.0.1')&&r.status()>=400)errors.push(r.status()+' '+r.url())});
   page.on('dialog',d=>d.accept('Jugador 2'));
   await page.goto('http://127.0.0.1:5055/'+(game==='dardos'?'juego_dardos':'juego/'+game));
   await page.waitForTimeout(400);
   const modes=game==='dardos'?['bot','local']:await page.locator('#menu [data-modo]').evaluateAll(es=>es.map(e=>e.dataset.modo).filter(x=>x!=='online'));
   for(const mode of modes){
    if(mode!==modes[0])await page.reload();
    await page.locator(game==='dardos'?'#btn-'+mode:'#menu [data-modo="'+mode+'"]').click({timeout:5000}).catch(e=>errors.push('start '+mode+': '+e.message.slice(0,150)));
    await page.waitForTimeout(750);
    await page.mouse.move(180,500);await page.mouse.down();await page.mouse.move(210,280,{steps:8});await page.mouse.up();
    await page.keyboard.press('Space');await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(750);
   }
   console.log(JSON.stringify({mobile,game,modes,errors}));await page.close();
  }
  await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
