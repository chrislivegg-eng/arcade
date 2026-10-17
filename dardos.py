# =======================================================
# 🎯 DARDOS 3D (vs bot, 2 jugadores y online)
# =======================================================
# Para activarlo en app.py solo se necesitan estas 2 líneas:
#     from dardos import dardos_bp
#     app.register_blueprint(dardos_bp)

import math
import random
import string
import threading
import time

from flask import Blueprint, render_template, request, jsonify

dardos_bp = Blueprint('dardos', __name__)

salas_dardos = {}
candado = threading.Lock()
PUNTOS_INICIALES = 301
HORAS_VIDA_SALA = 6

# Medidas reales de una diana (en metros)
SEGMENTOS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
R_BULL = 0.00635
R_BULL_EXT = 0.0159
R_TRIPLE_INT = 0.099
R_TRIPLE_EXT = 0.107
R_DOBLE_INT = 0.162
R_DOBLE_EXT = 0.170


def calcular_tiro(x, y):
    """Devuelve (puntos, etiqueta) para un dardo que pegó en (x, y)."""
    r = math.hypot(x, y)
    if r <= R_BULL:
        return 50, 'BULL'
    if r <= R_BULL_EXT:
        return 25, '25'
    if r > R_DOBLE_EXT:
        return 0, 'FUERA'
    angulo = (math.degrees(math.atan2(x, y)) + 9) % 360
    numero = SEGMENTOS[int(angulo // 18)]
    if R_TRIPLE_INT <= r <= R_TRIPLE_EXT:
        return numero * 3, f'T{numero}'
    if R_DOBLE_INT <= r <= R_DOBLE_EXT:
        return numero * 2, f'D{numero}'
    return numero, str(numero)


def _nuevo_codigo():
    letras = string.ascii_uppercase.replace('O', '').replace('I', '')
    while True:
        codigo = ''.join(random.choices(letras, k=4))
        if codigo not in salas_dardos:
            return codigo


def _reiniciar(sala):
    sala.update({
        'fase': 'jugando' if len(sala['jugadores']) == 2 else 'esperando',
        'puntos': [PUNTOS_INICIALES, PUNTOS_INICIALES],
        'turno': random.randint(0, 1), 'turno_n': 1,
        'dardos_turno': [], 'puntos_inicio_turno': PUNTOS_INICIALES,
        'ganador': None,
    })


@dardos_bp.route('/juego_dardos')
def juego_dardos():
    return render_template('juego_dardos.html')


@dardos_bp.route('/api/dardos/crear', methods=['POST'])
def crear():
    datos = request.json or {}
    with candado:
        limite = time.time() - HORAS_VIDA_SALA * 3600
        for c in [c for c, s in salas_dardos.items() if s['actualizado'] < limite]:
            del salas_dardos[c]
        codigo = _nuevo_codigo()
        sala = {'jugadores': [datos.get('pid')],
                'nombres': [(datos.get('nombre') or 'Jugador 1').strip()[:16]],
                'lanzamientos': [], 'seq': 0, 'actualizado': time.time()}
        _reiniciar(sala)
        salas_dardos[codigo] = sala
    return jsonify({'codigo': codigo})


@dardos_bp.route('/api/dardos/unirse', methods=['POST'])
def unirse():
    datos = request.json or {}
    codigo = (datos.get('codigo') or '').strip().upper()
    pid = datos.get('pid')
    with candado:
        sala = salas_dardos.get(codigo)
        if not sala:
            return jsonify({'error': 'Esa sala no existe 😿'}), 404
        if pid not in sala['jugadores']:
            if len(sala['jugadores']) >= 2:
                return jsonify({'error': 'La sala ya está llena'}), 400
            sala['jugadores'].append(pid)
            sala['nombres'].append((datos.get('nombre') or 'Jugador 2').strip()[:16])
            _reiniciar(sala)
        sala['actualizado'] = time.time()
    return jsonify({'codigo': codigo})


@dardos_bp.route('/api/dardos/estado/<codigo>')
def estado(codigo):
    pid = request.args.get('pid')
    with candado:
        sala = salas_dardos.get(codigo.upper())
        if not sala:
            return jsonify({'error': 'La sala ya no existe'}), 404
        if pid not in sala['jugadores']:
            return jsonify({'error': 'No estás en esta sala'}), 403
        return jsonify({
            'fase': sala['fase'], 'yo': sala['jugadores'].index(pid),
            'nombres': sala['nombres'], 'puntos': sala['puntos'],
            'turno': sala['turno'], 'turno_n': sala['turno_n'],
            'dardos_turno': sala['dardos_turno'], 'ganador': sala['ganador'],
            'lanzamientos': sala['lanzamientos'],
        })


@dardos_bp.route('/api/dardos/lanzar', methods=['POST'])
def lanzar():
    datos = request.json or {}
    codigo = (datos.get('codigo') or '').upper()
    pid = datos.get('pid')
    with candado:
        sala = salas_dardos.get(codigo)
        if not sala or pid not in sala['jugadores']:
            return jsonify({'error': 'Sala no encontrada'}), 404
        yo = sala['jugadores'].index(pid)
        if sala['fase'] != 'jugando' or sala['turno'] != yo or len(sala['dardos_turno']) >= 3:
            return jsonify({'error': 'No es tu turno'}), 400
        try:
            x, y = float(datos['x']), float(datos['y'])
        except (KeyError, TypeError, ValueError):
            return jsonify({'error': 'Tiro inválido'}), 400

        valor, etiqueta = calcular_tiro(x, y)
        if not sala['dardos_turno']:
            sala['puntos_inicio_turno'] = sala['puntos'][yo]
        restante = sala['puntos'][yo] - valor
        pasado = restante < 0
        sala['puntos'][yo] = sala['puntos_inicio_turno'] if pasado else restante
        sala['dardos_turno'].append({'valor': valor, 'etiqueta': etiqueta})

        sala['seq'] += 1
        tiro = {'seq': sala['seq'], 'jugador': yo, 'turno_n': sala['turno_n'], 'x': x, 'y': y,
                'valor': valor, 'etiqueta': etiqueta, 'pasado': pasado}
        sala['lanzamientos'] = (sala['lanzamientos'] + [tiro])[-12:]

        if restante == 0:
            sala['fase'] = 'terminado'
            sala['ganador'] = yo
        elif pasado or len(sala['dardos_turno']) >= 3:
            sala['turno'] = 1 - yo
            sala['turno_n'] += 1
            sala['dardos_turno'] = []
        sala['actualizado'] = time.time()
    return jsonify({'status': 'ok', 'tiro': tiro})


@dardos_bp.route('/api/dardos/revancha', methods=['POST'])
def revancha():
    datos = request.json or {}
    with candado:
        sala = salas_dardos.get((datos.get('codigo') or '').upper())
        if sala and datos.get('pid') in sala['jugadores'] and sala['fase'] == 'terminado':
            turno_anterior = sala['turno_n']
            _reiniciar(sala)
            sala['turno_n'] = turno_anterior + 1  # así los dos celulares notan que empezó otra partida
    return jsonify({'status': 'ok'})
