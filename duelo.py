# =======================================================
# ⚔️ DUELOS ONLINE (2 jugadores) + RÉCORDS de los juegos 3D
# =======================================================
# Sirve para Básquet, Boliche, Penales, Beer Pong, Mini Golf,
# Reflejos, Cruza la Calle y Stack.
# Para activarlo en app.py solo se necesitan estas 2 líneas:
#     from duelo import duelo_bp
#     app.register_blueprint(duelo_bp)
#
# El servidor solo reparte mensajes ("eventos") entre los dos
# celulares; cada juego decide qué significa cada evento.

import os
import random
import string
import threading
import time

from flask import Blueprint, render_template, request, jsonify, abort

duelo_bp = Blueprint('duelo', __name__)

JUEGOS = {
    'basquet': 'juego_basquet.html',
    'boliche': 'juego_boliche.html',
    'penales': 'juego_penales.html',
    'beer_pong': 'juego_beer_pong.html',
    'mini_golf': 'juego_mini_golf.html',
    'reflejos': 'juego_reflejos.html',
    'cruza_calle': 'juego_cruza_calle.html',
    'stack': 'juego_stack.html',
    'air_hockey': 'juego_air_hockey.html',
    'ping_pong': 'juego_ping_pong.html',
    'billar': 'juego_billar.html',
    'karts': 'juego_karts.html',
    'zombis': 'juego_zombis.html',
    'wordle': 'juego_wordle.html',
    '2048': 'juego_2048.html',
    'combina3': 'juego_combina3.html',
    'sudoku': 'juego_sudoku.html',
    'buscaminas': 'juego_buscaminas.html',
    'ajedrez': 'juego_ajedrez.html',
    'damas': 'juego_damas.html',
    'serpientes': 'juego_serpientes.html',
    'parchis': 'juego_parchis.html',
    'corredor': 'juego_corredor.html',
    'ladrillos': 'juego_ladrillos.html',
    'box': 'juego_box.html',
    'arco': 'juego_arco.html',
    'voleibol': 'juego_voleibol.html',
    'hockey': 'juego_hockey.html',
    'sopa': 'juego_sopa.html',
    'mate': 'juego_mate.html',
    'flow': 'juego_flow.html',
    'tetris': 'juego_tetris.html',
    'parejas': 'juego_parejas.html',
    'nonograma': 'juego_nonograma.html',
    'reversi': 'juego_reversi.html',
    'conecta3d': 'juego_conecta3d.html',
    'yahtzee': 'juego_yahtzee.html',
    'curling': 'juego_curling.html',
    'pesca': 'juego_pesca.html',
    'paracaidas': 'juego_paracaidas.html',
    'nieve': 'juego_nieve.html',
    'asteroides': 'juego_asteroides.html',
    'surf': 'juego_surf.html',
    'drift': 'juego_drift.html',
    'espadas': 'juego_espadas.html',
    'templo': 'juego_templo.html',
    'pinball': 'juego_pinball.html',
}
# En estos juegos el récord es "menos es mejor" (golpes, milisegundos)
RECORD_MENOR = {'mini_golf', 'reflejos', 'karts', 'sudoku', 'buscaminas', 'sopa', 'flow', 'parejas', 'nonograma', 'templo'}

salas = {}
candado = threading.Lock()
HORAS_VIDA_SALA = 6
MAX_EVENTOS = 60


@duelo_bp.route('/juego/<juego>')
def pagina(juego):
    if juego not in JUEGOS:
        abort(404)
    return render_template(JUEGOS[juego], juego=juego)


def _nombre(texto, defecto):
    return (texto or '').strip()[:14] or defecto


def _codigo():
    letras = string.ascii_uppercase.replace('O', '').replace('I', '')
    while True:
        codigo = ''.join(random.choices(letras, k=4))
        if codigo not in salas:
            return codigo


@duelo_bp.route('/api/duelo/crear', methods=['POST'])
def crear():
    datos = request.json or {}
    if datos.get('juego') not in JUEGOS or not datos.get('pid'):
        return jsonify({'error': 'Datos inválidos'}), 400
    with candado:
        limite = time.time() - HORAS_VIDA_SALA * 3600
        for c in [c for c, s in salas.items() if s['actualizado'] < limite]:
            del salas[c]
        codigo = _codigo()
        salas[codigo] = {
            'juego': datos['juego'], 'pids': [datos['pid']],
            'nombres': [_nombre(datos.get('nombre'), 'Jugador 1')],
            'eventos': [], 'seq': 0, 'semilla': random.randint(1, 10 ** 9),
            'actualizado': time.time(),
        }
    return jsonify({'codigo': codigo})


@duelo_bp.route('/api/duelo/unirse', methods=['POST'])
def unirse():
    datos = request.json or {}
    codigo = (datos.get('codigo') or '').strip().upper()
    pid = datos.get('pid')
    with candado:
        sala = salas.get(codigo)
        if not sala:
            return jsonify({'error': 'Esa sala no existe 😿'}), 404
        if datos.get('juego') and datos['juego'] != sala['juego']:
            return jsonify({'error': 'Ese código es de otro juego'}), 400
        if pid not in sala['pids']:
            if len(sala['pids']) >= 2:
                return jsonify({'error': 'La sala ya está llena'}), 400
            sala['pids'].append(pid)
            sala['nombres'].append(_nombre(datos.get('nombre'), 'Jugador 2'))
        sala['actualizado'] = time.time()
    return jsonify({'codigo': codigo})


@duelo_bp.route('/api/duelo/estado/<codigo>')
def estado(codigo):
    pid = request.args.get('pid')
    desde = request.args.get('desde', 0, type=int)
    with candado:
        sala = salas.get(codigo.upper())
        if not sala:
            return jsonify({'error': 'La sala ya no existe'}), 404
        if pid not in sala['pids']:
            return jsonify({'error': 'No estás en esta sala'}), 403
        return jsonify({
            'yo': sala['pids'].index(pid), 'nombres': sala['nombres'],
            'listo': len(sala['pids']) == 2, 'semilla': sala['semilla'],
            'eventos': [e for e in sala['eventos'] if e['seq'] > desde],
            'seq': sala['seq'],
        })


@duelo_bp.route('/api/duelo/evento', methods=['POST'])
def evento():
    datos = request.json or {}
    codigo = (datos.get('codigo') or '').upper()
    pid = datos.get('pid')
    with candado:
        sala = salas.get(codigo)
        if not sala or pid not in sala['pids']:
            return jsonify({'error': 'Sala no encontrada'}), 404
        sala['seq'] += 1
        sala['eventos'] = (sala['eventos'] + [{
            'seq': sala['seq'], 'de': sala['pids'].index(pid),
            'tipo': str(datos.get('tipo', ''))[:30], 'datos': datos.get('datos'),
        }])[-MAX_EVENTOS:]
        sala['actualizado'] = time.time()
        return jsonify({'seq': sala['seq']})


@duelo_bp.route('/api/duelo/salir', methods=['POST'])
def salir():
    datos = request.json or {}
    codigo = (datos.get('codigo') or '').upper()
    with candado:
        sala = salas.get(codigo)
        if sala and datos.get('pid') in sala['pids']:
            sala['seq'] += 1
            sala['eventos'].append({'seq': sala['seq'], 'de': sala['pids'].index(datos['pid']),
                                    'tipo': 'salio', 'datos': None})
    return jsonify({'status': 'ok'})


# ---------------- Récords ----------------
def _archivo_record(juego):
    return f"record_{juego}.txt"


def _leer_records(juego):
    from records_cuenta import leer_tabla
    return leer_tabla(_archivo_record(juego), juego in RECORD_MENOR)


@duelo_bp.route('/api/records/<juego>')
def ver_records(juego):
    if juego not in JUEGOS:
        abort(404)
    with candado:
        records = _leer_records(juego)
    orden = sorted(records.items(), key=lambda r: r[1], reverse=juego not in RECORD_MENOR)
    return jsonify([{'nombre': n, 'puntos': p} for n, p in orden[:10]])


@duelo_bp.route('/api/records/<juego>', methods=['POST'])
def guardar_record(juego):
    if juego not in JUEGOS:
        abort(404)
    datos = request.json or {}
    from records_cuenta import nombre_guardado
    nombre = nombre_guardado(_nombre(datos.get('nombre'), 'Invitado'))
    try:
        puntos = int(datos.get('puntos'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Puntos inválidos'}), 400
    with candado:
        records = _leer_records(juego)
        anterior = records.get(nombre)
        mejor = anterior is None or (puntos < anterior if juego in RECORD_MENOR else puntos > anterior)
        if mejor:
            records[nombre] = puntos
            with open(_archivo_record(juego), 'w', encoding='utf-8') as f:
                for n, p in records.items():
                    f.write(f"{n}:{p}\n")
    return jsonify({'nuevo_record': mejor})
