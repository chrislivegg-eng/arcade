(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const canvas = $("game"), ctx = canvas.getContext("2d");
  const W = 480, H = 780, colors = ["#fb6d77", "#62dffb", "#ffe064", "#a78bff", "#8df0b7"];
  const rows = [
    { y: 236, split: 240, left: 15, right: 10 },
    { y: 388, split: 182, left: 10, right: 15 },
    { y: 540, split: 295, left: 15, right: 10 },
  ];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let playing = false, wave = 1, reserve = 8, score = 0, best = 0;
  let cupX = W / 2, bucketX = W / 2, balls = [], sparks = [], last = 0;
  let name = "Jugador", sound = true, audio = null, nextWave = 0, toastTimeout, lastGateSignal = 0;
  try { name = localStorage.getItem("nombreUsuario") || name; } catch (_) {}
  function hud() {
    $("score").textContent = Math.round(score).toLocaleString("es-MX");
    $("wave").textContent = `${wave}/3`;
    $("reserve").textContent = reserve;
    $("best").textContent = Math.round(best).toLocaleString("es-MX");
    $("launch").disabled = !playing || reserve === 0;
  }
  function callout(message) {
    $("callout").textContent = message;
    $("callout").style.opacity = "1";
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => $("callout").style.opacity = "0", 650);
  }
  function ping(frequency = 400) {
    if (!sound) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
      osc.type = "sine"; osc.frequency.setValueAtTime(frequency, now);
      osc.frequency.exponentialRampToValueAtTime(frequency * .6, now + .11);
      gain.gain.setValueAtTime(.045, now); gain.gain.exponentialRampToValueAtTime(.001, now + .12);
      osc.connect(gain).connect(audio.destination); osc.start(now); osc.stop(now + .12);
    } catch (_) {}
  }
  function burst(x, y, color, amount = 12) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      sparks.push({x, y, vx:Math.cos(angle) * (30 + Math.random() * 100),
        vy:Math.sin(angle) * (30 + Math.random() * 100), life:.45, color});
    }
  }
  function launch() {
    if (!playing || reserve < 1) return;
    const count = Math.min(4, reserve);
    for (let i = 0; i < count; i++) {
      balls.push({x:cupX + (i - (count - 1) / 2) * 14, y:102 - i * 7,
        vx:(Math.random() - .5) * 85, vy:25 + Math.random() * 45,
        value:1, row:0, color:colors[(wave + reserve + i) % colors.length], radius:8});
    }
    reserve -= count; ping(440); hud();
  }
  function start() {
    playing = true; wave = 1; reserve = 8; score = 0; cupX = bucketX = 240;
    balls = []; sparks = []; nextWave = 0; hud();
    if ($("intro").open) $("intro").close();
    if ($("end").open) $("end").close();
  }
  async function finish() {
    playing = false; hud();
    $("result").textContent = `${Math.round(score).toLocaleString("es-MX")} puntos`;
    $("save").textContent = score ? "Guardando tu récord…" : "Intenta recoger más canicas.";
    $("end").showModal();
    if (score <= 0) return;
    best = Math.max(best, score); hud();
    try {
      const response = await fetch("/api/records/canicas", {method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({nombre:name, puntos:Math.round(score)})});
      if (!response.ok) throw new Error("Respuesta inválida");
      $("save").textContent = "Récord guardado.";
    } catch (_) { $("save").textContent = "No se pudo guardar; comprueba tu conexión."; }
  }
  function roundedRect(x, y, w, h, radius, fill) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill();
  }
  function draw(ms) {
    requestAnimationFrame(draw);
    const dt = Math.min(.034, (ms - last || 0) / 1000); last = ms;
    ctx.fillStyle = "#091321"; ctx.fillRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#102943"); sky.addColorStop(1, "#0a1020");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 46; i++) {
      const x = (i * 149 + 41) % W, y = (i * 233 + 57) % H;
      ctx.fillStyle = `rgba(131,222,255,${.1 + .16 * Math.sin(ms * .001 + i) ** 2})`;
      ctx.fillRect(x, y, 2, 2);
    }
    roundedRect(8, 2, W - 16, H - 4, 15, "#a8dfff14");
    // Vaso rojo: el jugador mueve el punto de salida.
    ctx.fillStyle = "#f74f6b";
    ctx.beginPath();ctx.moveTo(cupX-36,48);ctx.lineTo(cupX+36,48);
    ctx.lineTo(cupX+25,91);ctx.lineTo(cupX-25,91);ctx.closePath();ctx.fill();
    roundedRect(cupX-39,43,78,9,5,"#ff9cac");
    ctx.fillStyle="#fff0f0";ctx.font="bold 13px system-ui";ctx.textAlign="center";
    ctx.fillText("SOLTAR",cupX,72);
    ctx.strokeStyle="#83daff70";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(cupX,96);ctx.lineTo(cupX,160);ctx.stroke();
    // Dos rutas por cada barra. Los multiplicadores se aplican al atravesarlas.
    for (const row of rows) {
      roundedRect(18,row.y-4,W-36,38,9,"#091627");
      roundedRect(22,row.y, row.split-27,30,6,"#f66b89");
      roundedRect(row.split+5,row.y,W-row.split-27,30,6,"#4bd8eb");
      ctx.fillStyle="#fff";ctx.font="900 19px system-ui";
      ctx.fillText(`×${row.left}`,row.split/2,row.y+22);
      ctx.fillText(`×${row.right}`,(row.split+W)/2,row.y+22);
      ctx.fillStyle="#e8fcff";ctx.beginPath();ctx.arc(row.split,row.y+15,5,0,Math.PI*2);ctx.fill();
    }
    for (let i=0;i<7;i++) {
      const y=170+i*70;
      ctx.fillStyle="#d7eaf5";ctx.beginPath();ctx.arc(60+(i*113)%360,y,5,0,Math.PI*2);ctx.fill();
    }
    // Recipiente de recogida.
    ctx.fillStyle="#ffdf70";ctx.beginPath();ctx.moveTo(bucketX-70,706);
    ctx.lineTo(bucketX+70,706);ctx.lineTo(bucketX+54,757);
    ctx.quadraticCurveTo(bucketX,774,bucketX-54,757);ctx.closePath();ctx.fill();
    roundedRect(bucketX-76,700,152,12,6,"#fff2ab");
    ctx.fillStyle="#392843";ctx.font="bold 15px system-ui";ctx.fillText("ATRAPA",bucketX,741);
    if (playing) {
      for(let i=balls.length-1;i>=0;i--) {
        const b=balls[i], prevY=b.y;
        b.vy += 700*dt; b.x += b.vx*dt; b.y += b.vy*dt;
        if (b.x < 17 || b.x > W-17) { b.x=clamp(b.x,17,W-17); b.vx *= -.72; }
        for (let j=b.row;j<rows.length;j++) {
          const row=rows[j];
          if (prevY < row.y+30 && b.y >= row.y+30) {
            const multiplier=b.x < row.split ? row.left : row.right;
            b.value *= multiplier; b.row=j+1;
            b.vy *= .53; b.vx+=(Math.random()-.5)*110;
            // Tres canicas físicas por cruce, con el valor repartido entre ellas.
            // El límite mantiene fluida la cascada en pantallas móviles.
            if (balls.length < 220) {
              const share=b.value/3;b.value=share;b.radius=6;
              for(let k=0;k<2;k++) balls.push({...b,x:b.x+(k?8:-8),y:b.y-4,
                vx:b.vx+(k?75:-75),vy:b.vy-25,color:colors[(j+k+wave)%colors.length]});
            }
            burst(b.x,b.y,b.color,4);
            if (ms-lastGateSignal>160) {lastGateSignal=ms;callout(`×${multiplier}`);ping(510+j*120);}
          }
        }
        if (b.y >= 705) {
          if (Math.abs(b.x-bucketX)<70) {
            score += b.value; best=Math.max(best,score);burst(b.x,715,b.color,18);
            if (ms-lastGateSignal>160) {lastGateSignal=ms;callout(`+${Math.round(b.value).toLocaleString("es-MX")}`);ping(780);}
            hud();
          }
          balls.splice(i,1);continue;
        }
        const glow=ctx.createRadialGradient(b.x-2,b.y-3,1,b.x,b.y,14);
        glow.addColorStop(0,"#fff");glow.addColorStop(.32,b.color);glow.addColorStop(1,"#ffffff00");
        ctx.fillStyle=glow;ctx.beginPath();ctx.arc(b.x,b.y,14,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(b.x,b.y,b.radius,0,Math.PI*2);ctx.fill();
        ctx.fillStyle="#fff8";ctx.beginPath();ctx.arc(b.x-3,b.y-3,2.5,0,Math.PI*2);ctx.fill();
      }
      if (reserve===0 && balls.length===0 && !nextWave) nextWave=ms+800;
      if (nextWave && ms>=nextWave) {
        nextWave=0;
        if (wave===3) finish();
        else {wave++;reserve=8;hud();callout(`RONDA ${wave}`);}
      }
    }
    for(let i=sparks.length-1;i>=0;i--) {
      const p=sparks[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=210*dt;
      ctx.globalAlpha=clamp(p.life*2.2,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);
      if(p.life<=0)sparks.splice(i,1);
    }ctx.globalAlpha=1;
  }
  function point(e) {
    const r=canvas.getBoundingClientRect();
    return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};
  }
  function move(e) {
    if (!playing) return;
    const p=point(e);
    if (p.y<350) cupX=clamp(p.x,55,W-55);
    else bucketX=clamp(p.x,85,W-85);
  }
  canvas.addEventListener("pointerdown",e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);move(e);if(point(e).y<170)launch();});
  canvas.addEventListener("pointermove",e=>{if(e.pointerType==="mouse" || e.buttons) move(e);});
  document.addEventListener("keydown",e=>{
    if (!playing) return;
    if (e.code==="Space") {e.preventDefault();launch();}
    if (e.code==="ArrowLeft" || e.code==="ArrowRight") {
      e.preventDefault();bucketX=clamp(bucketX+(e.code==="ArrowLeft"?-30:30),85,W-85);
    }
  });
  $("start").onclick=start;$("again").onclick=start;$("launch").onclick=launch;
  $("mute").onclick=()=>{sound=!sound;$("mute").textContent=sound?"♫":"×";};
  fetch("/api/records/canicas").then(r=>r.json()).then(list=>{
    best=Math.max(0,...(Array.isArray(list)?list:[]).map(item=>Number(item.puntos)||0));hud();
  }).catch(()=>{});
  hud();$("intro").showModal();requestAnimationFrame(draw);
})();
