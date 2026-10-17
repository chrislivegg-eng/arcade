const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const base='http://127.0.0.1:5055';
 for(const game of ['penales','basquet','boliche','beer_pong','mini_golf','reflejos','cruza_calle','stack','dardos']){
  const contexts=await Promise.all([b.newContext(),b.newContext()]);
  const pages=await Promise.all(contexts.map(c=>c.newPage())); const errors=[];
  for(const p of pages){p.on('pageerror',e=>errors.push(e.message));await p.route('https://fonts.**',r=>r.abort());}
  const path=game==='dardos'?'/juego_dardos':'/juego/'+game;
  await Promise.all(pages.map(p=>p.goto(base+path,{waitUntil:'domcontentloaded'})));
  for(let i=0;i<2;i++){
   await pages[i].locator('#nombre').fill(i?'Invitado':'Anfitrion');
   await pages[i].locator(game==='dardos'?'#btn-online':'[data-modo="online"]').click();
  }
  await pages[0].locator('#btn-crear').click();
  await pages[0].waitForFunction(()=>document.getElementById('codigo-espera').textContent.length===4&&document.getElementById('codigo-espera').textContent!=='----');
  const code=await pages[0].locator('#codigo-espera').innerText();
  await pages[1].locator('#codigo').fill(code);await pages[1].locator('#btn-unirse').click();
  await Promise.all(pages.map(p=>p.waitForFunction(()=>document.getElementById('menu-espera').classList.contains('oculto')&&document.getElementById('menu').classList.contains('oculto'))));
  if(game!=='dardos'){
   const states=await Promise.all(pages.map(p=>p.evaluate(()=>({partida:ui.partida,yo:ui.yo,modo:ui.modo}))));
   assert.deepEqual(states,[{partida:1,yo:0,modo:'online'},{partida:1,yo:1,modo:'online'}]);
   await pages[1].evaluate(()=>{window.received=[];const old=ui.alEvento;ui.alEvento=(t,d)=>{received.push([t,d]);old&&old(t,d)}});
   await pages[0].evaluate(()=>ui.enviar('prueba',{partida:1,valor:42}));
   await pages[1].waitForFunction(()=>received.some(e=>e[0]==='prueba'&&e[1].valor===42));
   if(game==='basquet')assert.equal(await pages[1].evaluate(()=>J.nombres[0]),'Invitado');
  }
  assert.deepEqual(errors,[],game);console.log(JSON.stringify({game,online:'PASS',errors}));
  await Promise.all(contexts.map(c=>c.close()));
 }
 for(const [game,path] of [['impostor','impostor'],['probable','mas_probable'],['dibuja','dibuja'],['verdades','verdades'],['trivia','trivia'],['frase','completa_frase'],['basta','basta'],['espia','espia']]){
  const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}); const p=await c.newPage();const errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.route('https://fonts.**',r=>r.abort());
  await p.goto(base+'/'+path,{waitUntil:'domcontentloaded'});await p.locator('#nombre').fill('Host');await p.locator('#btn-crear').click();
  await p.waitForFunction(()=>document.getElementById('codigo-sala').textContent.length===4);
  const code=await p.locator('#codigo-sala').innerText();
  for(let i=1;i<3;i++)await c.request.post(base+'/api/fiesta/unirse',{data:{codigo:code,pid:'guest'+i,juego:game,nombre:'Invitado '+i}});
  await p.evaluate(()=>Fiesta.accion('iniciar'));await p.waitForTimeout(1200);
  assert.ok((await p.locator('#zona-juego').innerText()).length>0);assert.deepEqual(errors,[],game);
  console.log(JSON.stringify({game,partyUI:'PASS',errors}));await c.close();
 }
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});

