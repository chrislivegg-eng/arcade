(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const SIZE = 720, CENTER = 360, RING = 294;
  const catalog = [
    { icon: "🐥", name: "Patito", at: 0 },
    { icon: "⚽", name: "Pelota", at: 3 },
    { icon: "⭐", name: "Estrella", at: 8 },
    { icon: "🧸", name: "Osito", at: 15 },
    { icon: "🍭", name: "Paleta", at: 25 },
    { icon: "🎮", name: "Control", at: 40 },
    { icon: "🦋", name: "Mariposa", at: 60 },
    { icon: "🚀", name: "Cohete", at: 90 },
    { icon: "💎", name: "Cristal", at: 130 },
    { icon: "🦄", name: "Unicornio", at: 180 },
    { icon: "👑", name: "Corona", at: 250 },
    { icon: "🌌", name: "Galaxia", at: 350 },
  ];
  let total = 0, round = 0, combo = 0, time = 60, playing = false, admin = false;
  let phase = 0, wobble = 0, trail = [], objects = [], particles = [], last = 0, audio;
  let pending = 0, saving = false, timerSave = 0, toastTimer = 0, sound = true;
  let pid;
  try {
    pid = localStorage.getItem("fiesta_pid");
    if (!pid) {
      pid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("fiesta_pid", pid);
    }
    total = Math.max(0, Number(localStorage.getItem("squish_total")) || 0);
  } catch (_) { pid = Math.random().toString(36).slice(2); }

  function toast(message) {
    const el = $("toast"); el.textContent = message; el.style.opacity = "1";
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.style.opacity = "0", 1100);
  }
  function note(freq, length = 0.11) {
    if (!sound) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain(), now = audio.currentTime;
      o.type = "sine"; o.frequency.setValueAtTime(freq, now);
      o.frequency.exponentialRampToValueAtTime(freq * 0.68, now + length);
      g.gain.setValueAtTime(0.065, now); g.gain.exponentialRampToValueAtTime(0.001, now + length);
      o.connect(g).connect(audio.destination); o.start(now); o.stop(now + length);
    } catch (_) {}
  }
  function unlocked(item) { return admin || total >= item.at; }
  function renderCollection() {
    $("total").textContent = total.toLocaleString("es-MX");
    $("found").textContent = `${catalog.filter(unlocked).length}/${catalog.length}`;
    $("items").replaceChildren(...catalog.map(item => {
      const el = document.createElement("div"); el.className = `item${unlocked(item) ? "" : " locked"}`;
      const icon = document.createElement("b"); icon.textContent = unlocked(item) ? item.icon : "❔";
      const label = document.createElement("span"); label.textContent = unlocked(item) ? item.name : `${item.at} objetos`;
      el.append(icon, label); return el;
    }));
  }
  async function sync() {
    try {
      const r = await fetch(`/api/perfil/squish?pid=${encodeURIComponent(pid)}`);
      if (!r.ok) return;
      const data = await r.json(); admin = !!data.administrador;
      total = Math.max(total, data.total + pending);
      renderCollection();
    } catch (_) {}
  }
  async function save() {
    if (saving || !pending) return;
    saving = true; const count = Math.min(50, pending);
    try {
      const r = await fetch("/api/perfil/squish", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({pid,cantidad:count})});
      if (!r.ok) throw new Error("No se pudo guardar");
      const data = await r.json(); pending -= count; admin = !!data.administrador;
      total = Math.max(total, data.total + pending); renderCollection();
    } catch (_) {} finally { saving = false; if (pending > 0 && count < pending) setTimeout(save, 700); }
  }
  function addObject(item) {
    objects.push({ icon:item.icon, x:CENTER + Math.random()*100-50, y:CENTER + Math.random()*80-40,
      vx:Math.random()*230-115, vy:-80-Math.random()*140, spin:Math.random()*3-1.5, angle:0 });
    if (objects.length > 75) objects.shift();
    for(let i=0;i<12;i++) particles.push({x:CENTER,y:CENTER,vx:Math.random()*430-215,vy:Math.random()*430-215,life:.35+Math.random()*.45,hue:Math.random()*360});
  }
  function squish() {
    if (!playing) return;
    const before = total;
    total++; round++; pending++; wobble = 1;
    try { localStorage.setItem("squish_total", String(total)); } catch (_) {}
    const distance = Math.abs(Math.atan2(Math.sin(phase + Math.PI/2), Math.cos(phase + Math.PI/2)));
    combo = distance < .48 ? combo + 1 : 0;
    const newly = catalog.find(item => item.at === total && item.at > before);
    const options = catalog.filter(unlocked);
    const item = newly || options[Math.floor(Math.random() * options.length)];
    addObject(item);
    note(newly ? 920 : 340 + Math.min(combo, 20)*30);
    if (newly) toast(`¡DESBLOQUEADO! ${item.icon} ${item.name}`);
    else if (combo >= 3) toast(`¡SQUISH PERFECTO! ×${combo}`);
    $("combo").textContent = combo;
    renderCollection();
    if (pending >= 5) save();
  }
  function draw(ms) {
    requestAnimationFrame(draw);
    const dt = Math.min(.05, (ms-last || 0)/1000); last = ms;
    if (playing) { time = Math.max(0,time-dt); phase += (1.2 + round*.006)*dt; if (time === 0) finish(); }
    $("timer").textContent = Math.ceil(time);
    ctx.fillStyle = "#080717"; ctx.fillRect(0,0,SIZE,SIZE);
    const g = ctx.createConicGradient(-Math.PI/2,CENTER,CENTER);
    ["#ff4c78","#f9aa43","#f5f250","#38f996","#54ecfa","#6977ff","#d65cff","#ff4c78"].forEach((color,i)=>g.addColorStop(i/7,color));
    ctx.strokeStyle = g; ctx.lineWidth = 11; ctx.shadowColor = "#67dcff"; ctx.shadowBlur = 17;
    ctx.beginPath(); ctx.arc(CENTER,CENTER,RING,0,Math.PI*2); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(CENTER,CENTER-RING,9,0,Math.PI*2); ctx.fill();
    wobble = Math.max(0,wobble-dt*2.8);
    const squash = 1 - wobble*.26;
    const steps = 19, base = 90 + Math.sin(ms*.0017)*10;
    trail = [];
    for (let i=0;i<steps;i++) {
      const a = phase*.24 + i*.52;
      const radius = (base + Math.sin(i*2.4+phase*2)*23)*squash;
      trail.push({x:CENTER+Math.cos(a)*radius,y:CENTER+Math.sin(a)*radius});
    }
    ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.shadowBlur = 16;
    for (let i=1;i<trail.length;i++) {
      ctx.beginPath(); ctx.moveTo(trail[i-1].x,trail[i-1].y); ctx.lineTo(trail[i].x,trail[i].y);
      ctx.strokeStyle = `hsl(${(i*25+phase*70)%360} 100% 65%)`; ctx.shadowColor = ctx.strokeStyle; ctx.stroke();
    }
    ctx.shadowBlur = 0; ctx.fillStyle = "#fff";
    const tip=trail[trail.length-1]; ctx.beginPath(); ctx.arc(tip.x,tip.y,5,0,Math.PI*2); ctx.fill();
    for (const o of objects) {
      o.vy += 220*dt; o.x += o.vx*dt; o.y += o.vy*dt; o.angle += o.spin*dt;
      const dx=o.x-CENTER,dy=o.y-CENTER,dist=Math.hypot(dx,dy);
      if(dist>RING-25){const nx=dx/dist,ny=dy/dist; o.x=CENTER+nx*(RING-25); o.y=CENTER+ny*(RING-25);const dot=o.vx*nx+o.vy*ny;o.vx=(o.vx-2*dot*nx)*.78;o.vy=(o.vy-2*dot*ny)*.78;}
      ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.angle);ctx.font="30px system-ui";ctx.textAlign="center";ctx.fillText(o.icon,0,10);ctx.restore();
    }
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=`hsl(${p.hue} 100% 70%)`;ctx.fillRect(p.x,p.y,5,5);if(p.life<=0)particles.splice(i,1);}ctx.globalAlpha=1;
  }
  function start() { round=0; combo=0; time=60; objects=[]; particles=[]; playing=true; $("combo").textContent="0"; $("intro").close(); $("end").close(); }
  async function finish() {
    playing=false;
    await save();
    $("summary").textContent=`Creaste ${round} objetos. Tu colección tiene ${catalog.filter(unlocked).length} de ${catalog.length} desbloqueados.`;
    $("end").showModal();
    if (round > 0) {
      let name = "Jugador";
      try { name = localStorage.getItem("nombreUsuario") || name; } catch (_) {}
      fetch("/api/records/squish", {method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({nombre:name,puntos:round})}).catch(()=>{});
    }
  }
  canvas.addEventListener("pointerdown",e=>{e.preventDefault();squish()});
  document.addEventListener("keydown",e=>{if(e.code==="Space" && playing){e.preventDefault();squish();}});
  $("start").onclick=start; $("again").onclick=start;
  $("mute").onclick=()=>{sound=!sound;$("mute").textContent=sound?"♫":"×";};
  $("collectionToggle").onclick=()=>{const open=$("items").hidden;$("items").hidden=!open;$("collectionToggle").setAttribute("aria-expanded",String(open));$("collectionToggle").textContent=open?"Ocultar ↑":"Ver objetos ↓";};
  timerSave=setInterval(save,2200); window.addEventListener("pagehide",()=>{if(pending)save();clearInterval(timerSave);});
  renderCollection(); sync(); $("intro").showModal(); requestAnimationFrame(draw);
})();
