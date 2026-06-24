import os
import json
import random
import string
from flask import Flask, render_template, request, redirect, jsonify

app = Flask(__name__)

# --- Archivos de Datos ---
ARCHIVO = "productos.txt"
ARCHIVO_PUNTOS = "puntos.txt"
ARCHIVO_VICTORIAS = "victorias_gato.txt"
ARCHIVO_VICTORIAS_ONLINE = "victorias_gato_online.txt"
ARCHIVO_VICTORIAS_C4 = "victorias_c4.txt"
ARCHIVO_VICTORIAS_C4_ONLINE = "victorias_c4_online.txt"
ARCHIVO_MEMORAMA = "record_memorama.txt"
ARCHIVO_FRESAS = "record_fresas.txt"
ARCHIVO_CLICKER = "record_clicker.txt"
ARCHIVO_VIBORA = "record_vibora.txt"
ARCHIVO_TOPO = "record_topo.txt"
ARCHIVO_TORRE = "record_torre.txt"
ARCHIVO_RALLY = "record_rally.txt"
ARCHIVO_CIMA = "record_cima.txt"
ARCHIVO_SIMON = "record_simon.txt"
ARCHIVO_SHOOTER = "record_shooter.txt"
ARCHIVO_CAFE = "record_cafe.txt"
ARCHIVO_VUELO = "record_vuelo.txt"
ARCHIVO_SALAS_GATO = "salas_gato.json"
ARCHIVO_SALAS_C4 = "salas_conecta4.json"
ARCHIVO_SALAS_NAV = "salas_navales.json"
ARCHIVO_VICTORIAS_NAV = "victorias_navales.txt"
ARCHIVO_VICTORIAS_NAV_ONLINE = "victorias_navales_online.txt"

# --- Variables Globales ---
salas_memorama = {}
emojis_memorama = ["🎀", "🐱", "🌸", "🍓", "💖", "🍰", "🍎", "⭐"]
salas_dados = {}
salas_adivina = {}
salas_fantasma = {}
salas_ahorcado = {}

palabras_ahorcado = ["KAWAII", "GATITO", "FRESA", "ARCADE", "PYTHON", "JUEGO", "COMPUTADORA", "ESTRELLA"]

# --- Rutas de Gestión (Inventario) ---
@app.route('/')
def index(): 
    return render_template('index.html')

@app.route('/agregar', methods=['GET', 'POST'])
def agregar():
    if request.method == 'POST':
        codigo = request.form['codigo']
        nombre = request.form['nombre']
        precio = request.form['precio']
        with open(ARCHIVO, "a") as f:
            f.write(f"{codigo:<10}{nombre:<25}${precio:<10}\n")
        return redirect('/')
    return render_template('agregar.html')

@app.route('/borrar', methods=['GET', 'POST'])
def borrar():
    if request.method == 'POST':
        codigo_a_borrar = request.form['codigo']
        if os.path.exists(ARCHIVO):
            with open(ARCHIVO, "r") as f:
                lineas = f.readlines()
            nuevas_lineas = [l for l in lineas if l[0:10].strip() != codigo_a_borrar]
            with open(ARCHIVO, "w") as f:
                f.writelines(nuevas_lineas)
        return redirect('/')
    return render_template('borrar.html')

@app.route('/resumen')
def resumen():
    productos = []
    if os.path.exists(ARCHIVO):
        with open(ARCHIVO, "r") as f: productos = f.readlines()
    return render_template('resumen.html', productos=productos)

# --- Menú Secreto (Arcade) ---
@app.route('/secreto')
def secreto():
    def leer_records(archivo, inverso=False):
        d = {}
        if os.path.exists(archivo):
            with open(archivo, "r") as f:
                for line in f:
                    if ":" in line:
                        n, p = line.strip().split(":")
                        d[n] = int(p)
        return dict(sorted(d.items(), key=lambda item: item[1], reverse=not inverso))

    return render_template('secreto.html',
                           puntuaciones_saltos=leer_records(ARCHIVO_PUNTOS),
                           victorias_gato=leer_records(ARCHIVO_VICTORIAS),
                           victorias_gato_online=leer_records(ARCHIVO_VICTORIAS_ONLINE),
                           victorias_c4=leer_records(ARCHIVO_VICTORIAS_C4),
                           victorias_c4_online=leer_records(ARCHIVO_VICTORIAS_C4_ONLINE),
                           records_memorama=leer_records(ARCHIVO_MEMORAMA, inverso=True),
                           records_fresas=leer_records(ARCHIVO_FRESAS),
                           records_clicker=leer_records(ARCHIVO_CLICKER),
                           records_vibora=leer_records(ARCHIVO_VIBORA),
                           records_topo=leer_records(ARCHIVO_TOPO),
                           records_torre=leer_records(ARCHIVO_TORRE),
                           records_rally=leer_records(ARCHIVO_RALLY),
                           records_cima=leer_records(ARCHIVO_CIMA),
                           records_simon=leer_records(ARCHIVO_SIMON),
                           records_shooter=leer_records(ARCHIVO_SHOOTER),
                           records_cafe=leer_records(ARCHIVO_CAFE),
                           records_vuelo=leer_records(ARCHIVO_VUELO),
                           victorias_navales=leer_records(ARCHIVO_VICTORIAS_NAV),
                           victorias_navales_online=leer_records(ARCHIVO_VICTORIAS_NAV_ONLINE))

# --- Rutas de Juegos HTML ---
@app.route('/juego_salto')
def juego_salto(): return render_template('juego_salto.html')
@app.route('/juego_adivina')
def juego_adivina(): return render_template('juego_adivina.html')
@app.route('/juego_gato')
def juego_gato(): return render_template('juego_gato.html')
@app.route('/juego_conecta4')
def juego_conecta4(): return render_template('juego_conecta4.html')
@app.route('/juego_naval')
def juego_naval(): return render_template('juego_naval.html')
@app.route('/juego_memorama')
def juego_memorama(): return render_template('juego_memorama.html')
@app.route('/juego_fresas')
def juego_fresas(): return render_template('juego_fresas.html')
@app.route('/juego_clicker')
def juego_clicker(): return render_template('juego_clicker.html')
@app.route('/juego_vibora')
def juego_vibora(): return render_template('juego_vibora.html')
@app.route('/juego_topo')
def juego_topo(): return render_template('juego_topo.html')
@app.route('/juego_torre')
def juego_torre(): return render_template('juego_torre.html')
@app.route('/juego_rally')
def juego_rally(): return render_template('juego_rally.html')
@app.route('/juego_cima')
def juego_cima(): return render_template('juego_cima.html')
@app.route('/juego_simon')
def juego_simon(): return render_template('juego_simon.html')
@app.route('/juego_shooter')
def juego_shooter(): return render_template('juego_shooter.html')
@app.route('/juego_cafe')
def juego_cafe(): return render_template('juego_cafe.html')
@app.route('/juego_vuelo')
def juego_vuelo(): return render_template('juego_vuelo.html')
@app.route('/memorama_online')
def memorama_online(): return render_template('memorama_online.html')
@app.route('/dados_online')
def dados_online(): return render_template('dados_online.html')
@app.route('/adivina_online')
def adivina_online(): return render_template('adivina_online.html')
@app.route('/fantasma_online')
def fantasma_online(): return render_template('fantasma_online.html')
@app.route('/ahorcado_online')
def ahorcado_online(): return render_template('ahorcado_online.html')

# --- Motor de Guardado (Acumulativo y Limpio) ---
def guardar_generico(archivo, nombre, puntos, inverso=False, acumulable=False):
    # LIMPIEZA MAESTRA: Normaliza el nombre antes de cualquier comparación
    nombre_normalizado = nombre.strip().lower().title()
    
    lista = {}
    if os.path.exists(archivo):
        with open(archivo, "r") as f:
            for line in f:
                if ":" in line:
                    n, p = line.strip().split(":")
                    # Importante: al leer el archivo, también normalizamos 
                    # los nombres existentes por si tenías datos viejos "sucios"
                    lista[n.strip().lower().title()] = int(p)

    if acumulable:
        if nombre_normalizado in lista:
            lista[nombre_normalizado] += puntos
        else:
            lista[nombre_normalizado] = puntos
    else:
        if inverso:
            if nombre_normalizado not in lista or puntos < lista[nombre_normalizado]: 
                lista[nombre_normalizado] = puntos
        else:
            if nombre_normalizado not in lista or puntos > lista[nombre_normalizado]: 
                lista[nombre_normalizado] = puntos

    with open(archivo, "w") as f:
        for n, p in lista.items(): 
            f.write(f"{n}:{p}\n")
    return jsonify({"status": "ok"})

# --- APIs Guardado Juegos Individuales ---
@app.route('/guardar_cafe', methods=['POST'])
def guardar_cafe(): return guardar_generico(ARCHIVO_CAFE, request.json['nombre'].strip().title(), request.json['puntos'], acumulable=True)
@app.route('/guardar_shooter', methods=['POST'])
def guardar_shooter(): return guardar_generico(ARCHIVO_SHOOTER, request.json['nombre'].strip().title(), request.json['puntos'], acumulable=True)
@app.route('/guardar_puntos', methods=['POST'])
def guardar_puntos(): return guardar_generico(ARCHIVO_PUNTOS, request.json['nombre'].strip().title(), request.json['puntos'], acumulable=True)
@app.route('/guardar_memorama', methods=['POST'])
def guardar_memorama(): return guardar_generico(ARCHIVO_MEMORAMA, request.json['nombre'].strip().title(), request.json['intentos'], acumulable=True)
@app.route('/guardar_fresas', methods=['POST'])
def guardar_fresas(): return guardar_generico(ARCHIVO_FRESAS, request.json['nombre'].strip().title(), request.json['puntos'], acumulable=True)
@app.route('/guardar_clicker', methods=['POST'])
def guardar_clicker(): return guardar_generico(ARCHIVO_CLICKER, request.json['nombre'].strip().title(), request.json['puntos'], acumulable=True)
@app.route('/guardar_vibora', methods=['POST'])
def guardar_vibora(): return guardar_generico(ARCHIVO_VIBORA, request.json['nombre'].strip().title(), request.json['puntos'], acumulable=True)
@app.route('/guardar_topo', methods=['POST'])
def guardar_topo(): return guardar_generico(ARCHIVO_TOPO, request.json['nombre'].strip().title(), request.json['puntos'], acumulable=True)
@app.route('/guardar_torre', methods=['POST'])
def guardar_torre(): return guardar_generico(ARCHIVO_TORRE, request.json['nombre'].strip().title(), request.json['puntos'], acumulable=True)
@app.route('/guardar_rally', methods=['POST'])
def guardar_rally(): return guardar_generico(ARCHIVO_RALLY, request.json['nombre'].strip().title(), request.json['puntos'], acumulable=True)
@app.route('/guardar_cima', methods=['POST'])
def guardar_cima(): return guardar_generico(ARCHIVO_CIMA, request.json['nombre'].strip().title(), request.json['puntos'], acumulable=True)
@app.route('/guardar_simon', methods=['POST'])
def guardar_simon(): return guardar_generico(ARCHIVO_SIMON, request.json['nombre'].strip().title(), request.json['puntos'], acumulable=True)
@app.route('/guardar_vuelo', methods=['POST'])
def guardar_vuelo(): return guardar_generico(ARCHIVO_VUELO, request.json['nombre'].strip().title(), request.json['puntos'], acumulable=True)

# --- APIs Guardado Multijugador ---
@app.route('/guardar_victoria', methods=['POST'])
def guardar_victoria(): return guardar_generico(ARCHIVO_VICTORIAS, request.json['nombre'].strip().title(), 1, acumulable=True)
@app.route('/guardar_victoria_online', methods=['POST'])
def guardar_victoria_online(): return guardar_generico(ARCHIVO_VICTORIAS_ONLINE, request.json['nombre'].strip().title(), 1, acumulable=True)
@app.route('/guardar_victoria_c4', methods=['POST'])
def guardar_victoria_c4(): return guardar_generico(ARCHIVO_VICTORIAS_C4, request.json['nombre'].strip().title(), 1, acumulable=True)
@app.route('/guardar_victoria_c4_online', methods=['POST'])
def guardar_victoria_c4_online(): return guardar_generico(ARCHIVO_VICTORIAS_C4_ONLINE, request.json['nombre'].strip().title(), 1, acumulable=True)
@app.route('/guardar_victoria_nav', methods=['POST'])
def guardar_victoria_nav(): return guardar_generico(ARCHIVO_VICTORIAS_NAV, request.json['nombre'].strip().title(), 1, acumulable=True)
@app.route('/guardar_victoria_nav_online', methods=['POST'])
def guardar_victoria_nav_online(): return guardar_generico(ARCHIVO_VICTORIAS_NAV_ONLINE, request.json['nombre'].strip().title(), 1, acumulable=True)

# --- APIs MULTIJUGADOR: GATO ---
def leer_salas():
    if os.path.exists(ARCHIVO_SALAS_GATO):
        with open(ARCHIVO_SALAS_GATO, "r") as f: return json.load(f)
    return {}

def guardar_salas(salas):
    with open(ARCHIVO_SALAS_GATO, "w") as f: json.dump(salas, f)

@app.route('/api/crear_sala_gato', methods=['POST'])
def crear_sala_gato():
    salas = leer_salas()
    codigo = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    salas[codigo] = {"tablero": [""]*9, "turno": "❌", "chat": []}
    guardar_salas(salas)
    return jsonify({"sala": codigo})

@app.route('/api/estado_gato', methods=['GET'])
def api_estado_gato():
    sala_id = request.args.get('sala')
    salas = leer_salas()
    if sala_id in salas: return jsonify(salas[sala_id])
    return jsonify({"error": "Sala no encontrada"}), 404

@app.route('/api/jugar_gato', methods=['POST'])
def api_jugar_gato():
    datos = request.json
    salas = leer_salas()
    sala_id, casilla, jugador = datos['sala'], datos['casilla'], datos['jugador']
    if sala_id in salas:
        estado = salas[sala_id]
        if estado['tablero'][casilla] == "" and estado['turno'] == jugador:
            estado['tablero'][casilla] = jugador
            estado['turno'] = "⭕" if jugador == "❌" else "❌"
            guardar_salas(salas)
        return jsonify(estado)
    return jsonify({"error": "Sala no encontrada"}), 404

@app.route('/api/enviar_chat_gato', methods=['POST'])
def api_enviar_chat_gato():
    datos = request.json
    salas = leer_salas()
    sala_id = datos['sala']
    if sala_id in salas:
        salas[sala_id]['chat'].append(f"<b>{datos['jugador']}:</b> {datos['mensaje']}")
        if len(salas[sala_id]['chat']) > 8: salas[sala_id]['chat'].pop(0)
        guardar_salas(salas)
    return jsonify({"status": "ok"})

@app.route('/api/reiniciar_gato', methods=['POST'])
def api_reiniciar_gato():
    datos = request.json
    salas = leer_salas()
    sala_id = datos['sala']
    if sala_id in salas:
        salas[sala_id] = {"tablero": [""]*9, "turno": "❌", "chat": salas[sala_id].get("chat", [])}
        guardar_salas(salas)
        return jsonify(salas[sala_id])
    return jsonify({"error": "Sala no encontrada"}), 404

# --- APIs MULTIJUGADOR: CONECTA 4 ---
def leer_salas_c4():
    if os.path.exists(ARCHIVO_SALAS_C4):
        with open(ARCHIVO_SALAS_C4, "r") as f: return json.load(f)
    return {}

def guardar_salas_c4(salas):
    with open(ARCHIVO_SALAS_C4, "w") as f: json.dump(salas, f)

@app.route('/api/crear_sala_c4', methods=['POST'])
def crear_sala_c4():
    salas = leer_salas_c4()
    codigo = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    salas[codigo] = {"tablero": [""] * 42, "turno": "🔴", "chat": []}
    guardar_salas_c4(salas)
    return jsonify({"sala": codigo})

@app.route('/api/estado_c4', methods=['GET'])
def api_estado_c4():
    sala_id = request.args.get('sala')
    salas = leer_salas_c4()
    if sala_id in salas: return jsonify(salas[sala_id])
    return jsonify({"error": "Sala no encontrada"}), 404

@app.route('/api/jugar_c4', methods=['POST'])
def api_jugar_c4():
    datos = request.json
    salas = leer_salas_c4()
    sala_id, columna, jugador = datos['sala'], datos['columna'], datos['jugador']
    if sala_id in salas:
        estado = salas[sala_id]
        if estado['turno'] == jugador:
            for fila in range(5, -1, -1):
                idx = fila * 7 + columna
                if estado['tablero'][idx] == "":
                    estado['tablero'][idx] = jugador
                    estado['turno'] = "🟡" if jugador == "🔴" else "🔴"
                    guardar_salas_c4(salas)
                    break
        return jsonify(estado)
    return jsonify({"error": "Sala no encontrada"}), 404

@app.route('/api/enviar_chat_c4', methods=['POST'])
def api_enviar_chat_c4():
    datos = request.json
    salas = leer_salas_c4()
    sala_id = datos['sala']
    if sala_id in salas:
        salas[sala_id]['chat'].append(f"<b>{datos['jugador']}:</b> {datos['mensaje']}")
        if len(salas[sala_id]['chat']) > 6: salas[sala_id]['chat'].pop(0)
        guardar_salas_c4(salas)
    return jsonify({"status": "ok"})

@app.route('/api/reiniciar_c4', methods=['POST'])
def api_reiniciar_c4():
    datos = request.json
    salas = leer_salas_c4()
    sala_id = datos['sala']
    if sala_id in salas:
        salas[sala_id] = {"tablero": [""] * 42, "turno": "🔴", "chat": salas[sala_id].get("chat", [])}
        guardar_salas_c4(salas)
        return jsonify(salas[sala_id])
    return jsonify({"error": "Sala no encontrada"}), 404

# --- APIs MULTIJUGADOR: BATALLA NAVAL ---
def leer_salas_nav():
    if os.path.exists(ARCHIVO_SALAS_NAV):
        with open(ARCHIVO_SALAS_NAV, "r") as f: return json.load(f)
    return {}

def guardar_salas_nav(salas):
    with open(ARCHIVO_SALAS_NAV, "w") as f: json.dump(salas, f)

@app.route('/api/crear_sala_nav', methods=['POST'])
def crear_sala_nav():
    salas = leer_salas_nav()
    cod = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    salas[cod] = {
        "p1": {"tablero": [0]*25, "listo": False},
        "p2": {"tablero": [0]*25, "listo": False},
        "turno": "p1", "estado": "esperando", "ganador": ""
    }
    guardar_salas_nav(salas)
    return jsonify({"sala": cod})

@app.route('/api/unirse_nav', methods=['GET'])
def api_unirse_nav():
    sala = request.args.get('sala')
    salas = leer_salas_nav()
    if sala in salas: return jsonify({"status": "ok"})
    return jsonify({"error": "no existe"}), 404

@app.route('/api/colocar_nav', methods=['POST'])
def api_colocar_nav():
    datos = request.json
    salas = leer_salas_nav()
    sala, jug, barcos = datos['sala'], datos['jugador'], datos['barcos']
    if sala in salas:
        for b in barcos: salas[sala][jug]["tablero"][b] = 1
        salas[sala][jug]["listo"] = True
        if salas[sala]["p1"]["listo"] and salas[sala]["p2"]["listo"]:
            salas[sala]["estado"] = "jugando"
        guardar_salas_nav(salas)
        return jsonify({"status": "ok"})
    return jsonify({"error": "no existe"}), 404

@app.route('/api/estado_nav', methods=['GET'])
def api_estado_nav():
    sala, jugador = request.args.get('sala'), request.args.get('jugador')
    salas = leer_salas_nav()
    if sala not in salas: return jsonify({"error": "no existe"}), 404
    s = salas[sala]
    rival = "p2" if jugador == "p1" else "p1"
    tablero_rival_oculto = [ (v if v in [2,3] else 0) for v in s[rival]["tablero"] ]
    return jsonify({
        "mi_tablero": s[jugador]["tablero"],
        "tablero_rival": tablero_rival_oculto,
        "turno": s["turno"],
        "estado": s["estado"],
        "ganador": s["ganador"],
        "listo_rival": s[rival]["listo"]
    })

@app.route('/api/disparar_nav', methods=['POST'])
def api_disparar_nav():
    datos = request.json
    salas = leer_salas_nav()
    sala, jug, idx = datos['sala'], datos['jugador'], datos['idx']
    s = salas[sala]

    if s["estado"] != "jugando" or s["turno"] != jug: return jsonify({"error": "No es tu turno"})

    rival = "p2" if jug == "p1" else "p1"
    if s[rival]["tablero"][idx] == 1:
        s[rival]["tablero"][idx] = 3
        if s[rival]["tablero"].count(3) == 3:
            s["ganador"] = jug
            s["estado"] = "terminado"
    elif s[rival]["tablero"][idx] == 0:
        s[rival]["tablero"][idx] = 2
        s["turno"] = rival

    guardar_salas_nav(salas)
    return jsonify({"status": "ok"})

# --- APIs MULTIJUGADOR: MEMORAMA ---
@app.route('/api/estado_memorama/<sala>')
def estado_memorama(sala):
    if sala not in salas_memorama:
        cartas = emojis_memorama + emojis_memorama
        random.shuffle(cartas)
        salas_memorama[sala] = {
            'cartas': cartas,
            'visibles': [False] * 16,
            'resueltas': [False] * 16,
            'turno': 1,
            'puntos_1': 0,
            'puntos_2': 0,
            'cartas_seleccionadas': []
        }
    return jsonify(salas_memorama[sala])

@app.route('/api/estado_dados/<sala>')
def estado_dados(sala):
    if sala not in salas_dados:
        salas_dados[sala] = {'p1': 0, 'p2': 0, 'estado': 'esperando', 'ganador': ''}
    # Ocultamos la tirada del rival hasta que ambos tiren
    s = salas_dados[sala].copy()
    if s['estado'] == 'esperando':
        s['p1'] = 'listo' if s['p1'] != 0 else 0
        s['p2'] = 'listo' if s['p2'] != 0 else 0
    return jsonify(s)

@app.route('/api/jugar_dados', methods=['POST'])
def jugar_dados():
    sala, jug = request.json['sala'], request.json['jugador']
    s = salas_dados.get(sala)
    if s and s['estado'] == 'esperando' and s[jug] == 0:
        s[jug] = random.randint(1, 6) # Tira un dado del 1 al 6
        if s['p1'] != 0 and s['p2'] != 0:
            s['estado'] = 'terminado'
            if s['p1'] > s['p2']: s['ganador'] = 'p1'
            elif s['p2'] > s['p1']: s['ganador'] = 'p2'
            else: s['ganador'] = 'Empate'
    return jsonify({"status": "ok"})

@app.route('/api/reiniciar_dados', methods=['POST'])
def reiniciar_dados():
    sala = request.json['sala']
    if sala in salas_dados: salas_dados[sala] = {'p1': 0, 'p2': 0, 'estado': 'esperando', 'ganador': ''}
    return jsonify({"status": "ok"})

# =======================================================
# 2. APIs MULTIJUGADOR: ADIVINA EL NÚMERO
# =======================================================
@app.route('/api/estado_adivina/<sala>')
def estado_adivina(sala):
    if sala not in salas_adivina:
        salas_adivina[sala] = {'secreto': random.randint(1, 100), 'msg_p1': 'Escribe un número', 'msg_p2': 'Escribe un número', 'ganador': ''}
    # Ocultamos el número secreto al enviarlo a los celulares
    s = salas_adivina[sala].copy()
    s['secreto'] = '???' 
    return jsonify(s)

@app.route('/api/jugar_adivina', methods=['POST'])
def jugar_adivina():
    sala, jug, intento = request.json['sala'], request.json['jugador'], int(request.json['intento'])
    s = salas_adivina.get(sala)
    if s and s['ganador'] == '':
        llave_msg = 'msg_p1' if jug == 'p1' else 'msg_p2'
        if intento == s['secreto']:
            s[llave_msg] = f"¡ATINASTE! Era el {intento}"
            s['ganador'] = jug
        elif intento < s['secreto']:
            s[llave_msg] = f"{intento} es muy BAJO ⬆️"
        else:
            s[llave_msg] = f"{intento} es muy ALTO ⬇️"
    return jsonify({"status": "ok"})

# =======================================================
# 3. APIs MULTIJUGADOR: ATRAPA EL FANTASMA
# =======================================================
@app.route('/api/estado_fantasma/<sala>')
def estado_fantasma(sala):
    if sala not in salas_fantasma:
        # fx y fy son las coordenadas (porcentaje de la pantalla)
        salas_fantasma[sala] = {'p1': 0, 'p2': 0, 'fx': 50, 'fy': 50, 'fid': 1, 'ganador': ''}
    return jsonify(salas_fantasma[sala])

@app.route('/api/jugar_fantasma', methods=['POST'])
def jugar_fantasma():
    sala, jug, fid_tocado = request.json['sala'], request.json['jugador'], request.json['fid']
    s = salas_fantasma.get(sala)
    # Si le atinó al fantasma actual (fid)
    if s and s['ganador'] == '' and s['fid'] == fid_tocado:
        s[jug] += 1
        if s[jug] >= 10:
            s['ganador'] = jug
        else:
            # Mueve el fantasma a otra parte aleatoria
            s['fx'] = random.randint(10, 80)
            s['fy'] = random.randint(10, 80)
            s['fid'] += 1
    return jsonify({"status": "ok"})

# =======================================================
# 4. APIs MULTIJUGADOR: AHORCADO COOPERATIVO
# =======================================================
@app.route('/api/estado_ahorcado/<sala>')
def estado_ahorcado(sala):
    if sala not in salas_ahorcado:
        secreto = random.choice(palabras_ahorcado)
        salas_ahorcado[sala] = {
            'secreto': secreto, 'descubierto': ['_'] * len(secreto),
            'errores': 0, 'turno': 'p1', 'estado': 'jugando', 'letras_usadas': []
        }
    s = salas_ahorcado[sala].copy()
    s['secreto'] = '???' # Ocultar la palabra real
    return jsonify(s)

@app.route('/api/jugar_ahorcado', methods=['POST'])
def jugar_ahorcado():
    sala, jug, letra = request.json['sala'], request.json['jugador'], request.json['letra'].upper()
    s = salas_ahorcado.get(sala)
    
    if s and s['estado'] == 'jugando' and s['turno'] == jug and letra not in s['letras_usadas']:
        s['letras_usadas'].append(letra)
        if letra in s['secreto']:
            # Revelar las letras
            for i, l in enumerate(s['secreto']):
                if l == letra: s['descubierto'][i] = letra
            if '_' not in s['descubierto']:
                s['estado'] = 'ganaron'
        else:
            s['errores'] += 1
            if s['errores'] >= 6:
                s['estado'] = 'perdieron'
        
        # Cambiar de turno si el juego sigue
        if s['estado'] == 'jugando':
            s['turno'] = 'p2' if jug == 'p1' else 'p1'
            
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)