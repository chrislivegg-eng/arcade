(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const canvas = $("game"), ctx = canvas.getContext("2d");
  const W = 720, H = 900, clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  let pid, state = null, tab = "personajes", mode = "idle", pitch = null;
  let pitchStarted = 0, flightStarted = 0, flightDuration = 0, outcome = null;
  let distanceShown = 0, last = 0, sound = true, audio = null, busy = false;
  try {
    pid = localStorage.getItem("fiesta_pid");
    if (!pid) {pid = crypto.randomUUID();localStorage.setItem("fiesta_pid",pid);}
  } catch (_) {pid = Math.random().toString(36).slice(2);}
  function note(frequency, duration=.14) {
    if (!sound) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
      osc.type="triangle";osc.frequency.setValueAtTime(frequency,now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(60,frequency*.45),now+duration);
      gain.gain.setValueAtTime(.075,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
      osc.connect(gain).connect(audio.destination);osc.start(now);osc.stop(now+duration);
    } catch (_) {}
  }
  async function api(path, body) {
    const response = await fetch(`/api/beisbol/${path}`, body ? {
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pid,...body})
    } : undefined);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo conectar");
    return data;
  }
  function label(message) {$("status").textContent=message;}
  function updateHud() {
    $("distance").textContent=`${Math.round(distanceShown).toLocaleString("es-MX")} m`;
    if (!state) return;
    $("record").textContent=`${state.record.toLocaleString("es-MX")} m`;
    $("coins").textContent=state.infinitas?"🪙 ∞":`🪙 ${state.monedas.toLocaleString("es-MX")}`;
    $("shots").textContent=`${state.golpes} golpes`;
  }
  function itemCard(item, category) {
    const equipped=state.equipado[category]===item.id;
    const card=document.createElement("article");card.className=`item-card${equipped?" equipped":""}`;
    const icon=document.createElement("span");icon.className="icon";icon.textContent=item.icon;
    const name=document.createElement("b");name.textContent=item.nombre;
    const detail=document.createElement("small");detail.textContent=item.habilidad;
    const stat=document.createElement("div");stat.className="stat";
    if(category==="personajes")stat.textContent=`Potencia ×${item.potencia.toFixed(2)}`;
    else if(category==="bates")stat.textContent=`Potencia ×${item.potencia.toFixed(2)} · Nivel ${item.nivel}/5`;
    else stat.textContent=`Vuelo ×${item.vuelo.toFixed(2)} · Monedas ×${item.monedas.toFixed(2)}`;
    card.append(icon,name,detail,stat);
    const button=document.createElement("button");button.type="button";
    button.dataset.category=category;button.dataset.item=item.id;
    if(!item.comprado){button.dataset.action="comprar";button.textContent=`DESBLOQUEAR · 🪙 ${item.precio}`;}
    else if(equipped){button.textContent="EQUIPADO";button.disabled=true;}
    else {button.dataset.action="equipar";button.textContent="EQUIPAR";}
    card.append(button);
    if(category==="bates"&&item.comprado){
      const level=document.createElement("button");level.type="button";level.className="secondary";
      level.dataset.action="mejorar_bate";level.dataset.category="bates";level.dataset.item=item.id;
      level.dataset.level=item.nivel;level.disabled=item.nivel>=5;
      level.textContent=item.nivel>=5?"MEJORA MÁXIMA":`MEJORAR BATE · 🪙 ${item.mejora_precio}`;
      card.append(level);
    }
    return card;
  }
  function renderShop() {
    if(!state)return;
    document.querySelectorAll("[data-tab]").forEach(button=>button.classList.toggle("active",button.dataset.tab===tab));
    const box=$("shopItems");box.replaceChildren();
    if(tab==="mejoras"){
      for(const [id,item] of Object.entries(state.mejoras)){
        const card=document.createElement("article");card.className="item-card";
        const icon=document.createElement("span");icon.className="icon";icon.textContent=id==="fuerza"?"💪":"🪙";
        const title=document.createElement("b");title.textContent=item.nombre;
        const detail=document.createElement("small");detail.textContent=id==="fuerza"?"Cada nivel manda la pelota más lejos":"Cada nivel aumenta las monedas ganadas";
        const stat=document.createElement("div");stat.className="stat";stat.textContent=`Nivel ${item.nivel}/${item.maximo}`;
        const button=document.createElement("button");button.type="button";
        button.dataset.action="mejorar";button.dataset.category=id;button.dataset.level=item.nivel;
        button.disabled=item.precio===null;
        button.textContent=item.precio===null?"MEJORA MÁXIMA":`MEJORAR · 🪙 ${item.precio}`;
        card.append(icon,title,detail,stat,button);box.append(card);
      }
    } else box.replaceChildren(...state.catalogo[tab].map(item=>itemCard(item,tab)));
  }
  async function shopAction(button) {
    if(busy||mode==="pitch"||mode==="flight")return;
    busy=true;
    try {
      const payload={accion:button.dataset.action,categoria:button.dataset.category,item:button.dataset.item};
      if(button.dataset.level!==undefined)payload.nivel=Number(button.dataset.level);
      state=await api("tienda",payload);renderShop();updateHud();note(680);
      label("Equipo actualizado. ¡Prepara un lanzamiento!");
    } catch(error) {label(error.message);}
    finally{busy=false;}
  }
  async function prepare() {
    if(busy||mode==="pitch"||mode==="flight")return;
    busy=true;$("pitch").disabled=true;$("result").hidden=true;distanceShown=0;updateHud();
    try {
      pitch=await api("lanzar",{});pitchStarted=performance.now();mode="pitch";
      $("swing").disabled=false;label("¡Mira la aguja! Batea al cruzar la franja dorada.");note(330);
      const center=pitch.dulce_ms/2500*100;
      $("sweet").style.left=`${clamp(center-5,0,88)}%`;
    } catch(error) {$("pitch").disabled=false;label(error.message);}
    finally {busy=false;}
  }
  async function hit() {
    if(mode!=="pitch"||busy)return;
    busy=true;mode="waiting";$("swing").disabled=true;note(160,.22);
    try {
      outcome=await api("golpear",{lanzamiento:pitch.lanzamiento});
      state=outcome.estado;renderShop();updateHud();mode="flight";
      flightStarted=performance.now();flightDuration=clamp(3900+outcome.distancia*.45,4500,10500);
      $("flightCaption").textContent=outcome.perfecto?"¡GOLPE PERFECTO!":"¡BUEN GOLPE!";
      $("flightCaption").style.opacity="1";
      label("La pelota está volando… mira cuántos metros alcanza.");
      note(outcome.perfecto?960:660,.28);
      setTimeout(()=>$("flightCaption").style.opacity="0",1200);
    } catch(error) {mode="idle";$("pitch").disabled=false;label(error.message);}
    finally {busy=false;}
  }
  function land() {
    mode="landed";distanceShown=outcome.distancia;updateHud();
    $("resultTitle").textContent=outcome.perfecto?"¡GOLPE PERFECTO!":"¡BATAZO!";
    $("resultText").textContent=`La pelota llegó a ${outcome.distancia.toLocaleString("es-MX")} m. Ganaste ${outcome.monedas_ganadas.toLocaleString("es-MX")} monedas. Precisión: ${Math.round(outcome.precision*100)}%.`;
    $("result").hidden=false;$("pitch").disabled=false;label("Mejora tu equipo o intenta superar tu récord.");note(860,.25);
  }
  function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fill();}
  function hash(n){const x=Math.sin(n*127.1+78.233)*43758.5453;return x-Math.floor(x);}
  function tree(x,y,size,index){
    ctx.fillStyle="#78683f";ctx.fillRect(x-size*.11,y-size*.23,size*.22,size*.23);
    polygon([[x,y-size],[x-size*.47,y-size*.23],[x+size*.47,y-size*.23]],index%3?"#4cab30":"#8dcf28");
    polygon([[x,y-size*.83],[x-size*.4,y-size*.36],[x+size*.4,y-size*.36]],"#80dd3d");
  }
  function house(x,y,size,index){
    ctx.fillStyle="#f4fbf0";ctx.fillRect(x-size*.35,y-size*.62,size*.7,size*.62);
    polygon([[x-size*.46,y-size*.62],[x,y-size],[x+size*.46,y-size*.62]],index%2?"#e68c58":"#d45d6d");
    ctx.fillStyle="#366779";ctx.fillRect(x-size*.12,y-size*.35,size*.24,size*.35);
  }
  function world(ms){
    const moving=mode==="flight"?distanceShown:0;
    const sky=ctx.createLinearGradient(0,0,0,520);sky.addColorStop(0,"#35c6f4");sky.addColorStop(1,"#80edee");
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    for(let i=0;i<7;i++){
      const x=((i*187-moving*.09)%920+920)%920-100,y=125+i%3*71;
      ctx.fillStyle="#dffaffdb";ctx.fillRect(x,y,70,21);ctx.fillRect(x+17,y-20,48,21);ctx.fillRect(x+55,y+5,38,15);
    }
    polygon([[0,412],[145,333],[292,408],[455,327],[720,389],[720,900],[0,900]],"#3dba3f");
    polygon([[0,433],[115,369],[260,420],[463,357],[720,405],[720,900],[0,900]],"#70ce35");
    polygon([[0,473],[155,414],[312,448],[514,392],[720,456],[720,900],[0,900]],"#7cdb39");
    // Camino lateral en perspectiva, como en el paisaje del video.
    polygon([[36,419],[91,419],[194,900],[-95,900]],"#b9bbad");
    polygon([[45,419],[83,419],[153,900],[-55,900]],"#263d4c");
    for(let i=0;i<10;i++){
      const depth=((i*149-moving*.48)%1500+1500)%1500/1500;
      const y=420+depth*depth*480;
      ctx.fillStyle="#ffe690";ctx.fillRect(57-depth*17,y,2+depth*5,4+depth*19);
    }
    ctx.fillStyle="#286e47";ctx.fillRect(0,875,W,25);
    for(let i=0;i<62;i++){
      const offset=((i*131-moving*.8)%2400+2400)%2400;
      const depth=offset/2400,y=426+depth*depth*470;
      const x=145+hash(i+9)*600;
      const size=8+depth*88;
      if(i%5===0)house(x,y,size,i);else tree(x,y,size,i);
    }
    for(let i=0;i<72;i++){
      const depth=((i*79-moving*.75)%2000+2000)%2000/2000;
      const y=453+depth*depth*440,x=135+hash(i+317)*630;
      ctx.fillStyle=i%3?"#eaf2c0":"#ffd979";
      ctx.fillRect(x,y,2+depth*7,2+depth*5);
    }
    ctx.textAlign="center";ctx.fillStyle="#064862";ctx.font="900 15px system-ui";
    ctx.fillText(`PUEBLO · ${Math.max(0,6000-Math.round(moving)).toLocaleString("es-MX")} m`,W/2,265);
    ctx.textAlign="left";
  }
  function baseball(x,y,r,color){
    ctx.save();ctx.shadowColor="#fff";ctx.shadowBlur=15;
    ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle="#ed5960";ctx.lineWidth=Math.max(2,r*.09);
    ctx.beginPath();ctx.arc(x-r*.35,y,r*.55,-1.3,1.3);ctx.stroke();
    ctx.beginPath();ctx.arc(x+r*.35,y,r*.55,1.8,4.5);ctx.stroke();ctx.restore();
  }
  function player(ms){
    const type=state?.equipado.personajes||"novato",bat=state?.equipado.bates||"madera";
    ctx.fillStyle="#304837";ctx.beginPath();ctx.ellipse(357,812,110,26,0,0,Math.PI*2);ctx.fill();
    const jerseys={novato:"#457bf1",felina:"#fc8cc2",robot:"#849daf",samurai:"#3f3f78",dragon:"#e57844"};
    const heads={novato:"🧑",felina:"🐱",robot:"🤖",samurai:"🥷",dragon:"🐲"};
    ctx.strokeStyle="#1f3955";ctx.lineWidth=18;ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(334,771);ctx.lineTo(322,812);ctx.moveTo(374,771);ctx.lineTo(389,812);ctx.stroke();
    ctx.fillStyle="#162d48";ctx.fillRect(307,803,27,13);ctx.fillRect(381,803,27,13);
    polygon([[322,705],[385,705],[398,779],[314,779]],jerseys[type]);
    ctx.strokeStyle=jerseys[type];ctx.lineWidth=22;ctx.beginPath();
    ctx.moveTo(324,722);ctx.lineTo(295,760);ctx.moveTo(384,722);ctx.lineTo(410,744);ctx.stroke();
    ctx.fillStyle="#fff9";ctx.font="bold 20px system-ui";ctx.textAlign="center";ctx.fillText("CR",355,757);
    ctx.font="83px system-ui";ctx.fillText(heads[type],352,718);
    ctx.save();ctx.translate(407,728);ctx.rotate(-.65+Math.sin(ms*.003)*.05);
    ctx.fillStyle={madera:"#a65f31",neon:"#bb7cfa",acero:"#c7e0e8",rayo:"#ffd549",galaxia:"#8994ff"}[bat];
    ctx.fillRect(-9,-116,18,143);ctx.fillStyle="#fff6";ctx.fillRect(-5,-110,4,118);ctx.restore();
    ctx.textAlign="left";
  }
  function draw(ms){
    requestAnimationFrame(draw);
    const dt=Math.min(.04,(ms-last||0)/1000);last=ms;
    if(mode==="flight"){
      const t=clamp((ms-flightStarted)/flightDuration,0,1);
      distanceShown=outcome.distancia*(1-Math.pow(1-t,2.1));updateHud();
      if(t>=1)land();
    }
    world(ms);
    if(mode==="flight"){
      const t=clamp((ms-flightStarted)/flightDuration,0,1);
      const ability=state?.equipado.pelotas;
      const x=360+Math.sin(t*9)*56;
      const y=ability==="rebote"&&t>.64
        ? 710-190*Math.sin(Math.PI*(t-.64)/.36)
        : 715-440*Math.sin(Math.PI*(ability==="rebote"?Math.min(1,t/.64):t*.87));
      const trailLength=ability==="cometa"||ability==="cohete"?22:13;
      for(let i=trailLength;i>0;i--){ctx.globalAlpha=(trailLength-i)/trailLength*.35;
        ctx.fillStyle=ability==="cohete"?"#ff723c":ability==="cometa"?"#b4a0ff":"#fff9b2";
        ctx.beginPath();ctx.arc(x-i*3,y+i*5,Math.max(2,22-i),0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=1;
      baseball(x,y,18+8*Math.sin(Math.PI*t),ability==="oro"?"#ffda3c":ability==="rebote"?"#5ca9ff":"#fffaf0");
    } else {
      player(ms);
      if(mode==="pitch"){
        const elapsed=ms-pitchStarted,t=clamp(elapsed/2500,0,1);
        $("needle").style.left=`${Math.round(t*100)}%`;
        baseball(360,400+t*230,8+t*22,"#fffaf0");
        if(elapsed>6000){mode="idle";$("swing").disabled=true;$("pitch").disabled=false;
          label("Se fue el lanzamiento. Prepara otro para intentarlo.");}
      } else if(mode==="idle"||mode==="landed") {
        baseball(360,455+Math.sin(ms*.002)*8,15,"#fffaf0");
      }
    }
    ctx.fillStyle="#084f65";ctx.font="900 19px system-ui";ctx.textAlign="center";
    if(mode!=="flight")ctx.fillText("TOCA ¡BATEAR! EN LA ZONA DORADA",W/2,94);
    ctx.textAlign="left";
  }
  $("pitch").onclick=prepare;$("again").onclick=prepare;$("swing").onclick=hit;
  canvas.addEventListener("pointerdown",()=>{if(mode==="pitch")hit();});
  document.addEventListener("keydown",e=>{if(e.code==="Space"&&mode==="pitch"){e.preventDefault();hit();}});
  document.querySelectorAll("[data-tab]").forEach(button=>button.onclick=()=>{tab=button.dataset.tab;renderShop();});
  $("shopItems").addEventListener("click",e=>{const button=e.target.closest("button[data-action]");if(button)shopAction(button);});
  $("mute").onclick=()=>{sound=!sound;$("mute").textContent=sound?"♫":"×";};
  api(`estado?pid=${encodeURIComponent(pid)}`).then(data=>{state=data;renderShop();updateHud();$("pitch").disabled=false;})
    .catch(error=>{label(error.message);$("pitch").disabled=true;});
  requestAnimationFrame(draw);
})();
