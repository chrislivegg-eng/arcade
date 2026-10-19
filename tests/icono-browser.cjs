const {chromium}=require(process.env.PLAYWRIGHT_PATH);
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const p=await browser.newPage({viewport:{width:390,height:844}});
await p.goto('http://127.0.0.1:5055/cuenta');
await p.locator('#usuario').fill('admin@example.com');await p.locator('#password').fill('admin-prueba-123');await p.locator('#enviar').click();await p.waitForURL('**/perfil');await p.locator('#icono-admin').waitFor({state:'visible'});
const image=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=300;const g=c.getContext('2d');g.fillStyle='#0088ff';g.fillRect(0,0,400,300);return c.toDataURL('image/png').split(',')[1]});
await p.locator('#icono-archivo').setInputFiles({name:'mi-icono.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
await p.waitForFunction(()=>document.getElementById('icono-estado').textContent.includes('guardado'));
assert.equal(await p.locator('#cara img').count(),1);assert.equal(await p.locator('#cara img').evaluate(i=>i.complete && i.naturalWidth===256),true);
await p.goto('http://127.0.0.1:5055/secreto');await p.waitForSelector('.perfil-insignia img');assert.equal(await p.locator('.perfil-insignia img').evaluate(i=>i.naturalWidth),256);
console.log('OK: subida móvil, recorte 256px, persistencia y avatar del menú.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
