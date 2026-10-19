const NOMBRE_COLOR = {
  rojo: "#e8323c",
  amarillo: "#f5b800",
  verde: "#1fa055",
  azul: "#1f6fe0",
};
const SIMBOLO = {
  salta: "⊘",
  reversa: "⇄",
  comodin: "🌈",
  "+4": "+4",
  "+2": "+2",
};
let ultimo = null;
let relojTurno = null;
let enviando = false;

function carta(c, extra = "", atributos = "") {
  const s = SIMBOLO[c.v] || c.v;
  return `<button class="carta ${c.c} ${extra}" aria-label="${c.v} ${c.c}" ${atributos}><span class="esq">${s}</span><b>${s}</b><span class="esq esq-abajo">${s}</span></button>`;
}

function jugar(id) {
  const e = Fiesta.estado;
  if (enviando || !e || !(e.jugables || []).includes(id)) return;
  const c = e.mano.find((x) => x.id === id);
  if (c.c === "negro") return elegirColor(id);
  accionUno("jugar", { id });
}
async function accionUno(tipo, datos) {
  if (enviando) return;
  enviando = true;
  try {
    return await Fiesta.accion(tipo, datos);
  } finally {
    enviando = false;
  }
}
function elegirColor(id) {
  document.querySelector(".uno-selector")?.close();
  const div = document.createElement("dialog");
  div.className = "uno-selector";
  div.dataset.carta = id;
  div.dataset.ronda = Fiesta.estado.ronda;
  div.dataset.sala = document.getElementById("codigo-sala").textContent;
  div.innerHTML = `<div class="caja"><h2>Elige el siguiente color</h2><p>Tu comodín cambia la luz de toda la mesa.</p><div class="uno-colores">${Object.entries(
    NOMBRE_COLOR,
  )
    .map(
      ([n, col]) =>
        `<button type="button" style="--opcion:${col}" data-c="${n}" aria-label="Elegir ${n}">${n}</button>`,
    )
    .join(
      "",
    )}</div><button type="button" class="uno-cancelar">Cancelar</button></div>`;
  div.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-c]");
    if (b) {
      div.close();
      const e = Fiesta.estado;
      if (e?.turno === Fiesta.pid && e.jugables?.includes(id))
        accionUno("jugar", { id, color: b.dataset.c });
    } else if (ev.target.closest(".uno-cancelar")) div.close();
  });
  div.addEventListener("close", () => div.remove());
  document.body.appendChild(div);
  div.showModal();
}

function pintar(e, zona) {
  ultimo = e;
  document.body.classList.toggle("uno-jugando", e.fase !== "lobby");
  window.UNOMesa3D?.actualizar(e);
  const selector = document.querySelector(".uno-selector");
  if (
    selector &&
    (Number(selector.dataset.ronda) !== e.ronda ||
      selector.dataset.sala !==
        document.getElementById("codigo-sala").textContent ||
      e.fase !== "jugando" ||
      e.turno !== Fiesta.pid ||
      !e.jugables?.includes(Number(selector.dataset.carta)))
  )
    selector.close();
  clearInterval(relojTurno);
  const manoVieja = zona.querySelector(".mano");
  const scroll = manoVieja ? manoVieja.scrollLeft : 0;
  const n = e.jugadores.length;
  if (e.fase === "lobby") {
    zona.innerHTML = e.soy_host
      ? `<div class="tarjeta pila">
            <h2>🃏 Mesa lista (${n}/${e.max_jugadores})</h2>
            <p class="nota">¿Pocos amigos? Agrega bots para completar la mesa.</p>
            <button class="boton morado" ${n >= e.max_jugadores ? "disabled" : ""} onclick="Fiesta.accion('agregar_bot')">➕🤖 Agregar bot</button>
            <button class="boton verde" ${n < 2 ? "disabled" : ""} onclick="Fiesta.accion('iniciar')">${n < 2 ? "Invita a alguien o agrega un bot" : "🚀 ¡Repartir cartas!"}</button>
          </div>`
      : `<div class="tarjeta centro pila"><div class="grande">⏳</div><p class="nota">Esperando a que <b>${Fiesta.esc(Fiesta.nombreDe(e.host))}</b> reparta…</p></div>`;
    return;
  }

  const miTurno = e.turno === Fiesta.pid && e.fase === "jugando";
  const rivales = e.cuentas
    .map(
      (r) =>
        `<div class="rival ${r.id === e.turno && e.fase === "jugando" ? "turno" : ""}"><span class="nom">${Fiesta.esc(Fiesta.nombreDe(r.id))}${r.id === Fiesta.pid ? " (tú)" : ""}</span><span class="n ${r.n === 1 ? "uno" : ""}">🂠 ${r.n}</span></div>`,
    )
    .join("");
  const segundos = Fiesta.segundosHasta(e.limite);
  const turnoTexto =
    e.fase === "resultado"
      ? `🏆 ¡${Fiesta.esc(Fiesta.nombreDe(e.ganador_ronda))} ganó! +${e.puntos_ronda} pts`
      : miTurno
        ? e.robo != null
          ? "Tira la que robaste o pasa"
          : "¡Te toca! 👇"
        : `Turno de ${Fiesta.esc(Fiesta.nombreDe(e.turno))}`;

  let html = `<div class="mesa pila">
      <div class="uno-color-info"><span style="--color-activo:${NOMBRE_COLOR[e.color] || "#fff"}"></span> Color ${e.color} <b>${e.sentido > 0 ? "↻" : "↺"}</b><small>${e.mazo} en el mazo</small></div>
      <div class="rivales">${rivales}</div>
      <div class="centro-mesa">
        <div>${e.fase === "jugando" ? `<div class="carta dorso ${miTurno && e.robo == null ? "puede" : ""}" onclick="${miTurno && e.robo == null ? "Fiesta.accion('robar')" : ""}"><b>UNO</b></div>` : ""}</div>
        <div>${carta(e.arriba, "grande")}</div>
        <div><div class="color-actual" style="background:${NOMBRE_COLOR[e.color] || "#fff"}"></div><div style="font-size:1.6rem;text-align:center">${e.sentido > 0 ? "↻" : "↺"}</div></div>
      </div>
      <div class="info-turno">${turnoTexto} ${e.fase === "jugando" && !String(e.turno).startsWith("bot-") ? `<span id="seg-turno">⏱️ ${segundos}</span>` : ""}</div>
      <div class="registro">${e.log.map((l) => Fiesta.esc(l)).join("<br>")}</div>
    </div>`;

  if (e.mano) {
    const jugables = e.jugables || [];
    html += `<div class="mano">${e.mano
      .map((c) =>
        carta(
          c,
          miTurno ? (jugables.includes(c.id) ? "si" : "no") : "",
          `data-carta="${c.id}" onclick="jugar(${c.id})"`,
        ),
      )
      .join("")}</div>`;
    if (e.fase === "jugando")
      html += `<div class="acciones-uno">
          <button id="uno-robar" class="boton claro" ${miTurno && e.robo == null ? "" : "disabled"} onclick="UNOUI.robar()">🂠 Robar</button>
          <button class="boton uno ${e.dije_uno ? "dicho" : ""}" ${e.mano.length > 2 || e.dije_uno ? "disabled" : ""} onclick="Fiesta.accion('uno')">${e.dije_uno ? "✅ ¡Dijiste UNO!" : "📣 ¡UNO!"}</button>
          ${miTurno && e.robo != null ? `<button class="boton claro" onclick="Fiesta.accion('pasar')">Pasar ⏭️</button>` : ""}
        </div>`;
  }

  if (e.fase === "resultado") {
    html += `<div class="tarjeta pila">
        <h2>🏅 Puntos</h2>${Fiesta.ranking ? Fiesta.ranking(e) : ""}
        ${e.soy_host ? `<button class="boton morado" onclick="Fiesta.accion('agregar_bot')">➕🤖 Agregar bot</button><button class="boton verde" onclick="Fiesta.accion('iniciar')">🔁 Otra ronda</button>` : `<p class="nota centro">Esperando a que ${Fiesta.esc(Fiesta.nombreDe(e.host))} reparta otra vez…</p>`}
      </div>`;
  }
  zona.innerHTML = html;
  const mano = zona.querySelector(".mano");
  if (mano) mano.scrollLeft = scroll;
  if (e.fase === "jugando") {
    relojTurno = setInterval(() => {
      const s = document.getElementById("seg-turno");
      if (s) s.textContent = `⏱️ ${Fiesta.segundosHasta(e.limite)}`;
    }, 500);
  }
}

window.UNOUI = {
  jugar,
  robar: () => accionUno("robar"),
  get enviando() {
    return enviando;
  },
};
document.body.classList.add("uno-premium");
Fiesta.iniciar({ juego: "uno", titulo: "UNO 3D 🃏", pintar, intervalo: 700 });
document.getElementById("btn-salir").addEventListener("click", () => {
  window.UNOMesa3D?.ocultar();
  document.querySelector(".uno-selector")?.close();
  clearInterval(relojTurno);
});
