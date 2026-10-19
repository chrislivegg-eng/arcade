# =======================================================
# 👤 PERFIL DE JUGADOR · 🪙 MONEDAS · 🏅 LOGROS · 📊 RÉCORDS
# =======================================================
# Para activarlo en app.py solo se necesitan estas 2 líneas:
#     from perfil import perfil_bp
#     app.register_blueprint(perfil_bp)
#
# Cada juego avisa cuando termina una partida (POST /api/perfil/evento)
# y aquí se reparten monedas y se revisan los logros.

import json
import os
import threading
import time
import secrets
from copy import deepcopy

from flask import Blueprint, render_template, request, jsonify

perfil_bp = Blueprint('perfil', __name__)

ARCHIVO_PERFILES = "perfiles.json"
candado = threading.Lock()

# ---------------- Avatares (algunos se compran con monedas) ----------------
AVATARES = [
    # (emoji, precio)
    ("😺", 0), ("🐶", 0), ("🐼", 0), ("🦊", 0), ("🐸", 0), ("🐵", 0),
    ("🐯", 50), ("🦁", 50), ("🐨", 50), ("🐙", 80), ("🦄", 120), ("🐲", 150),
    ("👽", 200), ("🤖", 200), ("👻", 250), ("🎃", 250), ("🦖", 300), ("🧙", 400),
    ("🥷", 500), ("👑", 800), ("💎", 1000), ("🔥", 1500),
]
COLORES_MARCO = [
    ("#ff4f8b", 0), ("#4fb3ff", 0), ("#26de81", 0), ("#ffb84f", 0),
    ("#a29bfe", 60), ("#ff6b6b", 60), ("#0fb9b1", 60), ("#2d3436", 100),
    ("arcoiris", 600), ("oro", 900),
]

# ---------------- Logros ----------------
# id: (icono, nombre, descripción, monedas de premio)
LOGROS = {
    "primer_juego": ("🎮", "¡A jugar!", "Termina tu primera partida", 20),
    "explorador": ("🧭", "Explorador", "Juega 10 juegos distintos", 100),
    "todologo": ("🌎", "Todólogo", "Juega 25 juegos distintos", 300),
    "primera_victoria": ("🏆", "Primera victoria", "Gana una partida", 20),
    "ganador_10": ("🥇", "Imparable", "Gana 10 partidas", 100),
    "ganador_50": ("👑", "Leyenda", "Gana 50 partidas", 400),
    "online_1": ("🌐", "Conectado", "Gana una partida online", 50),
    "online_10": ("📡", "Rey del online", "Gana 10 partidas online", 200),
    "bot_pro": ("🤖", "Mata-robots", "Gánale a un bot en dificultad Pro", 120),
    "bot_pro_5": ("🦾", "Terminator", "Gánale al bot Pro en 5 juegos distintos", 400),
    "fiestero": ("🎉", "Fiestero", "Juega 5 partidas de juegos de fiesta", 80),
    "rico": ("💰", "Millonario", "Junta 1000 monedas", 0),
    "strikes_10": ("🎳", "Rey del boliche", "Haz 10 strikes en total", 150),
    "penales_pro": ("⚽", "Muro de acero", "Gana Penales contra el bot Pro", 150),
    "canastas_100": ("🏀", "Francotirador", "Encesta 100 canastas en total", 150),
    "zombis_100": ("🧟", "Cazador de zombis", "Elimina 100 zombis en total", 150),
    "hoyo_en_uno": ("⛳", "Hoyo en uno", "Mete un hoyo en uno en Mini Golf", 120),
    "reflejos_200": ("⚡", "Rayo", "Reacciona en menos de 200 ms", 120),
    "karts_1": ("🏎️", "Piloto", "Gana una carrera de Karts", 80),
    "wordle_2": ("🔤", "Adivino", "Adivina un Wordle en 2 intentos o menos", 150),
    "f2048": ("🔢", "¡2048!", "Llega a la ficha 2048", 250),
    "sudoku_dificil": ("🧩", "Cerebrito", "Resuelve un Sudoku difícil", 200),
    "buscaminas": ("💣", "Desactivador", "Gana un Buscaminas", 60),
    "uno": ("🃏", "¡UNO!", "Gana una partida de UNO", 80),
    "jaque_mate": ("♟️", "Gran maestro", "Gana una partida de Ajedrez", 120),
    "combo_dulce": ("🍬", "Combo dulce", "Haz un combo de 5 en Combina 3", 100),
}

# Juegos de fiesta (cuentan para "Fiestero")
JUEGOS_FIESTA = {"impostor", "probable", "verdad_reto", "dibuja", "verdades", "trivia", "frase", "basta", "espia", "uno",
                 "papa", "blackjack", "poker", "loteria", "domino"}


def _leer():
    if os.path.exists(ARCHIVO_PERFILES):
        try:
            with open(ARCHIVO_PERFILES, encoding="utf-8") as f:
                return json.load(f)
        except (ValueError, OSError) as exc:
            # No sustituir perfiles dañados por una base vacía al guardar.
            raise RuntimeError("No se pudo leer perfiles.json; conserva el archivo para recuperarlo") from exc
    return {}


def _guardar(perfiles):
    temporal = ARCHIVO_PERFILES + ".tmp"
    with open(temporal, "w", encoding="utf-8") as f:
        json.dump(perfiles, f, ensure_ascii=False)
    os.replace(temporal, ARCHIVO_PERFILES)


def _nuevo(nombre=""):
    return {"nombre": nombre[:14] or "Jugador", "avatar": "😺", "marco": "#ff4f8b", "monedas": 50,
            "comprados": [], "logros": {}, "stats": {}, "juegos": [], "creado": time.time()}


def _publico(p):
    return {
        "nombre": p["nombre"], "avatar": p["avatar"], "marco": p["marco"], "monedas": p["monedas"],
        "comprados": p["comprados"], "logros": p["logros"], "stats": p["stats"], "juegos": p["juegos"],
    }


def _sumar(p, clave, n=1):
    p["stats"][clave] = p["stats"].get(clave, 0) + n
    return p["stats"][clave]


def _dar_logro(p, logro_id, nuevos):
    if logro_id in p["logros"] or logro_id not in LOGROS:
        return
    p["logros"][logro_id] = time.time()
    premio = LOGROS[logro_id][3]
    p["monedas"] += premio
    icono, nombre, descripcion, _ = LOGROS[logro_id]
    nuevos.append({"id": logro_id, "icono": icono, "nombre": nombre, "descripcion": descripcion, "premio": premio})


def procesar_evento(p, juego, tipo, datos):
    """Reparte monedas y revisa logros. Regresa (monedas_ganadas, logros_nuevos)."""
    nuevos = []
    antes = p["monedas"]
    datos = datos or {}

    if tipo == "fin":
        gano = bool(datos.get("gano"))
        modo = datos.get("modo", "")
        if juego not in p["juegos"]:
            p["juegos"].append(juego)
        _sumar(p, "partidas")
        p["monedas"] += 5 + (10 if gano else 0) + (5 if modo == "online" else 0)
        if datos.get("record_nuevo"):
            p["monedas"] += 15
        _dar_logro(p, "primer_juego", nuevos)
        if len(p["juegos"]) >= 10:
            _dar_logro(p, "explorador", nuevos)
        if len(p["juegos"]) >= 25:
            _dar_logro(p, "todologo", nuevos)
        if juego in JUEGOS_FIESTA and _sumar(p, "fiesta") >= 5:
            _dar_logro(p, "fiestero", nuevos)
        if gano:
            victorias = _sumar(p, "victorias")
            _dar_logro(p, "primera_victoria", nuevos)
            if victorias >= 10:
                _dar_logro(p, "ganador_10", nuevos)
            if victorias >= 50:
                _dar_logro(p, "ganador_50", nuevos)
            if modo == "online":
                _dar_logro(p, "online_1", nuevos)
                if _sumar(p, "victorias_online") >= 10:
                    _dar_logro(p, "online_10", nuevos)
            if modo == "bot" and datos.get("dificultad") == "pro":
                _dar_logro(p, "bot_pro", nuevos)
                pro = set(p["stats"].get("bot_pro_juegos", []))
                pro.add(juego)
                p["stats"]["bot_pro_juegos"] = sorted(pro)
                if len(pro) >= 5:
                    _dar_logro(p, "bot_pro_5", nuevos)
                if juego == "penales":
                    _dar_logro(p, "penales_pro", nuevos)
            if juego == "karts":
                _dar_logro(p, "karts_1", nuevos)
            if juego == "buscaminas":
                _dar_logro(p, "buscaminas", nuevos)
            if juego == "uno":
                _dar_logro(p, "uno", nuevos)
            if juego == "ajedrez":
                _dar_logro(p, "jaque_mate", nuevos)
            if juego == "sudoku" and datos.get("nivel") == "dificil":
                _dar_logro(p, "sudoku_dificil", nuevos)
            if juego == "wordle" and 0 < int(datos.get("intentos") or 99) <= 2:
                _dar_logro(p, "wordle_2", nuevos)

    # contadores que mandan los juegos mientras juegas
    elif tipo == "strike" and _sumar(p, "strikes") >= 10:
        _dar_logro(p, "strikes_10", nuevos)
    elif tipo == "canasta" and _sumar(p, "canastas", int(datos.get("n", 1))) >= 100:
        _dar_logro(p, "canastas_100", nuevos)
    elif tipo == "zombi" and _sumar(p, "zombis", int(datos.get("n", 1))) >= 100:
        _dar_logro(p, "zombis_100", nuevos)
    elif tipo == "hoyo_en_uno":
        _dar_logro(p, "hoyo_en_uno", nuevos)
    elif tipo == "reaccion" and 0 < int(datos.get("ms") or 9999) < 200:
        _dar_logro(p, "reflejos_200", nuevos)
    elif tipo == "ficha" and int(datos.get("valor") or 0) >= 2048:
        _dar_logro(p, "f2048", nuevos)
    elif tipo == "combo" and int(datos.get("n") or 0) >= 5:
        _dar_logro(p, "combo_dulce", nuevos)

    if p["monedas"] >= 1000:
        _dar_logro(p, "rico", nuevos)
    return p["monedas"] - antes, nuevos


# ---------------- Páginas ----------------
@perfil_bp.route('/perfil')
def pagina_perfil():
    return render_template('perfil.html', avatares=AVATARES, marcos=COLORES_MARCO,
                           logros=[{"id": k, "icono": v[0], "nombre": v[1], "descripcion": v[2], "premio": v[3]} for k, v in LOGROS.items()])


@perfil_bp.route('/records')
def pagina_records():
    return render_template('records.html')


# ---------------- API ----------------
@perfil_bp.route('/api/perfil')
def ver_perfil():
    pid = request.args.get('pid', '')[:40]
    if not pid:
        return jsonify({'error': 'Falta el jugador'}), 400
    with candado:
        perfiles = _leer()
        if pid not in perfiles:
            perfiles[pid] = _nuevo(request.args.get('nombre', ''))
            _guardar(perfiles)
        return jsonify(_publico(perfiles[pid]))


@perfil_bp.route('/api/perfil', methods=['POST'])
def editar_perfil():
    datos = _json_objeto()
    pid = str(datos.get('pid', ''))[:40]
    if not pid:
        return jsonify({'error': 'Falta el jugador'}), 400
    with candado:
        perfiles = _leer()
        p = deepcopy(perfiles.get(pid, _nuevo()))
        if datos.get('nombre'):
            p['nombre'] = str(datos['nombre']).strip()[:14] or p['nombre']
        for campo, lista in (('avatar', AVATARES), ('marco', COLORES_MARCO)):
            valor = datos.get(campo)
            if valor is None:
                continue
            if not isinstance(valor, str):
                return jsonify({'error': 'Eso no existe'}), 400
            precio = dict(lista).get(valor)
            if precio is None:
                return jsonify({'error': 'Eso no existe'}), 400
            if precio > 0 and valor not in p['comprados']:
                if p['monedas'] < precio:
                    return jsonify({'error': f'Te faltan {precio - p["monedas"]} monedas 🪙'}), 400
                p['monedas'] -= precio
                p['comprados'].append(valor)
            p[campo] = valor
        perfiles[pid] = p
        _guardar(perfiles)
        return jsonify(_publico(p))


def _json_objeto():
    datos = request.get_json(silent=True)
    return datos if isinstance(datos, dict) else {}


@perfil_bp.route('/api/perfil/iniciar', methods=['POST'])
def iniciar_partida():
    from duelo import JUEGOS
    datos = _json_objeto()
    pid = str(datos.get('pid') or '')[:40]
    juego = str(datos.get('juego') or '')
    modo = str(datos.get('modo') or '')
    if not pid or juego not in {*JUEGOS, 'dardos', 'naval'} or modo not in ('solo', 'local', 'bot', 'online'):
        return jsonify({'error': 'Partida inválida'}), 400
    token = secrets.token_urlsafe(24)
    with candado:
        perfiles = _leer()
        p = perfiles.setdefault(pid, _nuevo(str(datos.get('nombre') or '')))
        partidas = p.setdefault('_partidas', {})
        # Una ficha expirada ya no se acepta, aunque se reenvíe su resultado.
        partidas = {k: v for k, v in partidas.items() if v['creado'] > time.time() - 86400}
        if sum(not v.get('fin') for v in partidas.values()) >= 30:
            pendientes = [k for k, v in partidas.items() if not v.get('fin')]
            del partidas[pendientes[0]]
        partidas[token] = {'juego': juego, 'modo': modo, 'dificultad': datos.get('dificultad'),
                           'creado': time.time(), 'eventos': [], 'fin': False}
        p['_partidas'] = partidas
        _guardar(perfiles)
    return jsonify({'partida': token})


def _resultado_fiesta(datos, pid, juego):
    """Usa la sala real y la ronda actual; nunca el ganador enviado por el navegador."""
    from fiesta import salas_fiesta, candado as candado_fiesta
    with candado_fiesta:
        sala = salas_fiesta.get(str(datos.get('codigo') or '').upper())
        if (not sala or sala['juego'] != juego or pid not in sala['jugadores']
                or sala['fase'] not in ('resultado', 'final') or datos.get('ronda') != sala['ronda']):
            raise ValueError('La ronda no ha terminado o no perteneces a ella')
        identidad = sala.setdefault('perfil_id', secrets.token_urlsafe(24))
        from fiesta import JUEGOS_EXTRA
        extra = JUEGOS_EXTRA.get(juego)
        if hasattr(extra, 'gano'):
            # los juegos de mesa dicen ellos mismos quién ganó la ronda
            gano = bool(extra.gano(sala, pid))
        elif juego == 'uno':
            gano = sala['uno']['ganador'] == pid
        elif juego == 'impostor':
            gano = (pid not in sala['impostores']) == bool(sala['resultado']['atrapado'])
        elif juego == 'espia':
            gano = (pid == sala['espia']) == (sala['resultado']['gano'] == 'espia')
        else:
            puntos = sala['jugadores'][pid]['puntos']
            gano = puntos > 0 and puntos == max(j['puntos'] for j in sala['jugadores'].values())
        return f"{identidad}:{sala['ronda']}", {'gano': gano, 'modo': 'online'}


@perfil_bp.route('/api/perfil/evento', methods=['POST'])
def evento_perfil():
    datos = _json_objeto()
    pid = str(datos.get('pid', ''))[:40]
    juego = str(datos.get('juego', ''))[:30]
    tipo = str(datos.get('tipo', ''))[:20]
    if not pid or not juego or not tipo:
        return jsonify({'error': 'Datos incompletos'}), 400
    extra = datos.get('datos') or {}
    if not isinstance(extra, dict):
        return jsonify({'error': 'Datos inválidos'}), 400
    clave_fiesta = None
    if juego in JUEGOS_FIESTA:
        if tipo != 'fin':
            return jsonify({'error': 'Evento inválido'}), 400
        try:
            clave_fiesta, extra = _resultado_fiesta(datos, pid, juego)
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    with candado:
        perfiles = _leer()
        p = perfiles.setdefault(pid, _nuevo(str(datos.get('nombre', ''))))
        partida = None
        if clave_fiesta:
            cobradas = p.setdefault('_rondas', [])
            if clave_fiesta in cobradas:
                return jsonify({'monedas': p['monedas'], 'ganadas': 0, 'logros': []})
        else:
            partida = p.get('_partidas', {}).get(str(datos.get('partida') or ''))
            if (not partida or partida['juego'] != juego or partida['creado'] < time.time() - 86400):
                return jsonify({'error': 'Inicia una partida antes de enviar su resultado'}), 400
            evento = str(datos.get('evento') or '')[:80]
            if not evento:
                return jsonify({'error': 'Falta el identificador del evento'}), 400
            if partida['fin'] or evento in partida['eventos']:
                return jsonify({'monedas': p['monedas'], 'ganadas': 0, 'logros': []})
            permitidos = {'boliche': {'strike'}, 'basquet': {'canasta'}, 'zombis': {'zombi'},
                          'mini_golf': {'hoyo_en_uno'}, 'reflejos': {'reaccion'},
                          '2048': {'ficha'}, 'combina3': {'combo'}}
            if tipo != 'fin' and tipo not in permitidos.get(juego, set()):
                return jsonify({'error': 'Evento inválido para este juego'}), 400
            extra = {**extra, 'modo': partida['modo'], 'dificultad': partida['dificultad']}
        # Validar antes de tocar contadores, incluso cuando un cliente manda datos malformados.
        for campo in ('n', 'ms', 'valor', 'intentos'):
            if campo in extra:
                valor = extra[campo]
                if isinstance(valor, bool) or not isinstance(valor, int) or not 0 <= valor <= 1000000:
                    return jsonify({'error': 'Contador inválido'}), 400
        ganadas, nuevos = procesar_evento(p, juego, tipo, extra)
        if clave_fiesta:
            cobradas.append(clave_fiesta)
        else:
            partida['eventos'].append(evento)
            if tipo == 'fin':
                partida['fin'] = True
                partida['eventos'] = []
        _guardar(perfiles)
        return jsonify({'monedas': p['monedas'], 'ganadas': ganadas, 'logros': nuevos})


# ---------------- 📊 Récords de todos los juegos ----------------
# (archivo, nombre visible, unidad, ¿menos es mejor?)
TABLAS = [
    ("record_basquet.txt", "🏀 Básquet 3D", "pts", False),
    ("record_boliche.txt", "🎳 Boliche 3D", "pts", False),
    ("record_beer_pong.txt", "🥤 Vaso Pong", "vasos", False),
    ("record_mini_golf.txt", "⛳ Mini Golf", "golpes", True),
    ("record_reflejos.txt", "⚡ Reflejos", "ms", True),
    ("record_cruza_calle.txt", "🐔 Cruza la Calle", "pasos", False),
    ("record_stack.txt", "🧱 Stack 3D", "pisos", False),
    ("record_karts.txt", "🏎️ Karts", "ms", True),
    ("record_zombis.txt", "🧟 Zombis", "pts", False),
    ("record_corredor.txt", "🛹 Corredor", "m", False),
    ("record_ladrillos.txt", "🧱 Rompe-ladrillos", "pts", False),
    ("record_arco.txt", "🎯 Tiro con arco", "pts", False),
    ("record_2048.txt", "🔢 2048", "pts", False),
    ("record_combina3.txt", "🍬 Combina 3", "pts", False),
    ("record_wordle.txt", "🔤 Wordle", "seguidas", False),
    ("record_sudoku.txt", "🧩 Sudoku", "s", True),
    ("record_buscaminas.txt", "💣 Buscaminas", "s", True),
    ("record_sopa.txt", "🔠 Sopa de Letras", "s", True),
    ("record_mate.txt", "➕ Mate Rápido", "pts", False),
    ("record_flow.txt", "🎨 Conecta Colores", "s", True),
    ("record_tetris.txt", "🧩 Tetris", "pts", False),
    ("record_parejas.txt", "🃏 Memorama Duelo", "intentos", True),
    ("record_nonograma.txt", "🔢 Nonograma", "s", True),
    ("record_yahtzee.txt", "🎲 Yahtzee", "pts", False),
    ("record_pesca.txt", "🐟 Pesca", "kg", False),
    ("record_paracaidas.txt", "🪂 Paracaidista", "pts", False),
    ("record_nieve.txt", "⛄ Bolos de Nieve", "pts", False),
    ("record_asteroides.txt", "🚀 Asteroides 3D", "pts", False),
    ("record_surf.txt", "🏄 Surf", "pts", False),
    ("record_drift.txt", "🏎️ Drift", "pts", False),
    ("puntos.txt", "🎀 Kitty Saltarina", "pts", False),
    ("record_shooter.txt", "🚀 Space Defender", "pts", False),
    ("record_vibora.txt", "🐍 Viborita", "largo", False),
    ("record_vuelo.txt", "🎀 Vuelo Kawaii", "pts", False),
    ("record_cafe.txt", "☕ Kitty Cafe", "pts", False),
    ("record_fresas.txt", "🍓 Atrapa Fresas", "pts", False),
    ("record_topo.txt", "🐹 Atrapa al Topo", "pts", False),
    ("record_torre.txt", "🍰 Torre Pasteles", "pisos", False),
    ("record_rally.txt", "🏎️ Rally Kawaii", "m", False),
    ("record_cima.txt", "⛰️ Salto a la Cima", "m", False),
    ("record_simon.txt", "✨ Simon Kawaii", "nivel", False),
    ("record_clicker.txt", "🖱️ Kitty Clicker", "clics", False),
    ("record_memorama.txt", "💖 Memorama", "intentos", True),
    ("victorias_gato_online.txt", "❌ Gato Online", "victorias", False),
    ("victorias_c4_online.txt", "🔴 Conecta 4 Online", "victorias", False),
    ("victorias_navales_online.txt", "🚢 Batalla Naval Online", "victorias", False),
]


def _leer_tabla(archivo):
    filas = {}
    if os.path.exists(archivo):
        with open(archivo, encoding="utf-8") as f:
            for linea in f:
                if ':' in linea:
                    n, v = linea.strip().rsplit(':', 1)
                    try:
                        filas[n] = int(v)
                    except ValueError:
                        pass
    return filas


@perfil_bp.route('/api/records_generales')
def records_generales():
    tablas = []
    for archivo, nombre, unidad, menor in TABLAS:
        filas = _leer_tabla(archivo)
        if not filas:
            continue
        orden = sorted(filas.items(), key=lambda x: x[1], reverse=not menor)[:5]
        tablas.append({"juego": nombre, "unidad": unidad, "top": [{"nombre": n, "valor": v} for n, v in orden]})
    with candado:
        perfiles = _leer()
    ricos = sorted(perfiles.values(), key=lambda p: p.get("monedas", 0), reverse=True)[:10]
    logreros = sorted(perfiles.values(), key=lambda p: len(p.get("logros", {})), reverse=True)[:10]
    return jsonify({
        "tablas": tablas,
        "monedas": [{"nombre": p["nombre"], "avatar": p["avatar"], "valor": p["monedas"]} for p in ricos],
        "logros": [{"nombre": p["nombre"], "avatar": p["avatar"], "valor": len(p["logros"])} for p in logreros if p["logros"]],
        "total_logros": len(LOGROS),
    })
