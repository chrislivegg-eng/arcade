const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const a=await browser.newContext(),b=await browser.newContext({viewport:{width:390,height:844}});
  const p=await a.newPage(),q=await b.newPage();
  const errors=[];for(const page of [p,q])page.on('pageerror',e=>errors.push(e.message));
  const url=process.env.ARCADE_URL || 'http://127.0.0.1:5055';
  const user='Prueba'+Date.now().toString(36).slice(-7);
  await p.goto(url+'/cuenta');await p.locator('[data-modo="registrar"]').click();
  assert.equal(await p.locator('#correo').isVisible(),false);
  await p.locator('#usuario').fill(user);await p.locator('#password').fill('clave-prueba-123');await p.locator('#enviar').click();
  await p.locator('#respaldo').waitFor({state:'visible'});
  const recovery=await p.locator('#codigo').textContent();assert.equal(recovery.length,40);
  await p.locator('#continuar').click();await p.waitForURL('**/perfil');
  await p.waitForFunction(()=>Perfil.datos?.cuenta);
  assert.equal(await p.locator('#nombre').getAttribute('readonly'),'');
  await p.evaluate(()=>Perfil.editar({avatar:'🐼'}));
  await q.goto(url+'/cuenta');await q.locator('#usuario').fill(user.toLowerCase());await q.locator('#password').fill('clave-prueba-123');await q.locator('#enviar').click();
  await q.waitForURL('**/perfil');await q.waitForFunction(()=>Perfil.datos?.avatar==='🐼');
  assert.equal(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.notEqual(await p.evaluate(()=>Perfil.pid),await q.evaluate(()=>Perfil.pid));
  await q.evaluate(()=>Perfil.editar({avatar:'🐶'}));
  await p.reload();await p.waitForFunction(()=>Perfil.datos?.avatar==='🐶');
  await q.goto(url+'/cuenta');await q.locator('#salir').click();await q.waitForFunction(()=>!document.getElementById('acceso').hidden);
  await q.locator('[data-modo="registrar"]').click();await q.locator('#usuario').fill(user.toUpperCase());await q.locator('#password').fill('clave-prueba-123');await q.locator('#enviar').click();
  await q.waitForFunction(()=>document.getElementById('error').textContent.includes('registrado'));
  await q.locator('[data-modo="recuperar"]').click();await q.locator('#usuario').fill(user);await q.locator('#recuperacion').fill(recovery);await q.locator('#password').fill('nueva-prueba-123');await q.locator('#enviar').click();
  await q.locator('#respaldo').waitFor({state:'visible'});
  assert.notEqual(await q.locator('#codigo').textContent(),recovery);
  const state=await p.evaluate(()=>fetch('/api/cuenta/estado').then(r=>r.json()));assert.equal(state.autenticado,false);
  if(process.env.ADMIN_INVITACION){
   await p.goto(url+'/cuenta?invitacion='+process.env.ADMIN_INVITACION);
   await p.locator('#correo').fill('admin@example.com');await p.locator('#password').fill('admin-prueba-123');await p.locator('#enviar').click();
   await p.locator('#respaldo').waitFor({state:'visible'});await p.locator('#continuar').click();await p.waitForURL('**/perfil');
   await p.waitForFunction(()=>Perfil.datos?.monedas_infinitas);assert.equal(await p.locator('#monedas').textContent(),'∞');
   await p.locator('[data-valor="🔥"]').click();await p.waitForFunction(()=>Perfil.datos?.avatar==='🔥');
   assert.equal(await p.locator('.bloqueado').count(),0);
   assert.equal(await p.evaluate(()=>Perfil.datos.monedas),50);
  }
  assert.deepEqual(errors,[]);console.log('OK: registro, usuario único, acceso móvil, sincronización, recuperación y permisos de administrador.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
