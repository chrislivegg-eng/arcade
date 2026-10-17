const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge',headless:true});
 const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
 const pages=await Promise.all(contexts.map(c=>c.newPage()));
 const html=`<!doctype html><html><head><style>.oculto{display:none!important}</style></head><body><script src="/static/js/arcade3d.js"></script><script>
 window.starts=[];window.events=[];
 window.testUI=Arcade.ui({juego:'stack',titulo:'Prueba',emoji:'',modos:['solo','online'],records:true,alEmpezar:(modo,info)=>starts.push({modo,partida:info.partida})});
 testUI.alEvento=(tipo,datos)=>events.push({tipo,datos});
 </script></body></html>`;
 for(const page of pages){
  await page.route('**/__test',r=>r.fulfill({contentType:'text/html',body:html}));
  page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:5055/__test');
 }
 // Dos partidas locales antes de online no deben cambiar el número de partida de la sala.
 await pages[0].locator('[data-modo="solo"]').click();
 await pages[0].evaluate(()=>testUI.terminar({texto:'fin'}));
 await pages[0].locator('#btn-revancha').click();
 await pages[0].evaluate(()=>testUI.terminar({texto:'fin'}));
 await pages[0].locator('#btn-fin-menu').click();
 let record;
 await pages[1].route('**/api/records/stack',async route=>{
  if(route.request().method()==='POST'){record=route.request().postDataJSON();await route.fulfill({json:{nuevo_record:true}})}else await route.continue();
 });
 for(let round=0;round<2;round++){
  for(let i=0;i<2;i++){await pages[i].locator('#nombre').fill(i?'Invitado':'Host');await pages[i].locator('[data-modo="online"]').click();}
  let delay=true;
  await pages[0].route('**/api/duelo/estado/**',async route=>{
   if(delay){delay=false;await new Promise(r=>setTimeout(r,1400));}
   await route.continue();
  });
  await pages[0].locator('#btn-crear').click();
  await pages[0].locator('#menu-espera').waitFor({state:'visible'});
  const code=await pages[0].locator('#codigo-espera').innerText();
  await pages[1].locator('#codigo').fill(code);await pages[1].locator('#btn-unirse').click();
  await pages[1].waitForFunction(()=>testUI.modo==='online');
  await pages[1].evaluate(()=>testUI.enviar('primero',{partida:1}));
  await pages[0].waitForFunction(n=>events.filter(e=>e.tipo==='primero').length===n,round+1);
  for(const page of pages)assert.equal(await page.evaluate(()=>testUI.partida),1);
  assert.equal(await pages[0].evaluate(()=>events.filter(e=>e.tipo==='primero').length),round+1);
  await pages[1].evaluate(()=>testUI.terminar({texto:'fin',record:12}));
  assert.equal(record.nombre,'Invitado');
  await pages[1].locator('#btn-fin-menu').click();
  await pages[0].evaluate(()=>testUI.terminar({texto:'fin'}));
  await pages[0].locator('#btn-fin-menu').click();
  await pages[0].unroute('**/api/duelo/estado/**');
 }
 console.log('PASS: primer evento con entrada tardía, nueva sala tras partidas locales, segunda sala y récord del invitado');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
