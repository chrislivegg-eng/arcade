"""Monedas por enemigos emitidos y armería persistente del modo Zombis."""
import random
import secrets
import time
from flask import Blueprint, request, jsonify
from cuentas import identidad_perfil, es_admin

zombis_bp = Blueprint('zombis_progreso', __name__)
PRECIOS = (30, 60, 110, 180, 280)
MEJORAS = {'danio': 'Daño', 'cargador': 'Cargador', 'recarga': 'Recarga', 'cadencia': 'Cadencia'}
PREMIOS = {'normal': 3, 'corredor': 5, 'gigante': 12}


def arsenal(p):
    admin = es_admin()
    guardados = p.get('zombis_mejoras', {})
    niveles = {k: 5 if admin else max(0, min(5, int(guardados.get(k, 0)))) for k in MEJORAS}
    return {'monedas': p['monedas'], 'infinitas': admin, 'niveles': niveles,
            'mejoras': [{'id': k, 'nombre': v, 'nivel': niveles[k], 'precio': PRECIOS[niveles[k]] if niveles[k] < 5 else None} for k, v in MEJORAS.items()],
            'arma': {'danio': 1 + niveles['danio'] * .4, 'cargador': 8 + niveles['cargador'] * 2,
                     'recarga': round(1.4 - niveles['recarga'] * .15, 2), 'cadencia': round(.3 - niveles['cadencia'] * .035, 3)}}


def identidad(datos):
    pid = datos.get('pid')
    return identidad_perfil(pid[:40]) if isinstance(pid, str) and pid else None


def partida_valida(p, token):
    s = p.get('_partidas', {}).get(str(token or ''))
    return s if s and s['juego'] == 'zombis' and not s['fin'] and s['creado'] >= time.time() - 86400 else None


@zombis_bp.route('/api/zombis/arsenal', methods=['GET', 'POST'])
def comprar():
    import perfil
    d = request.args if request.method == 'GET' else (request.get_json(silent=True) or {})
    if not isinstance(d, dict) and request.method == 'POST':
        return jsonify(error='Datos inválidos'), 400
    pid = identidad(d)
    if not pid:
        return jsonify(error='Falta el jugador'), 400
    with perfil.candado:
        ps = perfil._leer(); p = ps.setdefault(pid, perfil._nuevo())
        if request.method == 'POST':
            key = d.get('mejora'); esperado = d.get('nivel')
            if not isinstance(key, str) or key not in MEJORAS or isinstance(esperado, bool) or not isinstance(esperado, int):
                return jsonify(error='Mejora inválida'), 400
            niveles = p.setdefault('zombis_mejoras', {})
            nivel = niveles.get(key, 0)
            if es_admin():
                return jsonify(arsenal(p))
            if nivel != esperado:
                return jsonify(error='La mejora ya cambió. Se actualizó la armería.', **arsenal(p)), 409
            if nivel >= 5:
                return jsonify(error='Nivel máximo'), 400
            if p['monedas'] < PRECIOS[nivel]:
                return jsonify(error='No tienes suficientes monedas', **arsenal(p)), 400
            p['monedas'] -= PRECIOS[nivel]; niveles[key] = nivel + 1
            perfil._guardar(ps)
        return jsonify(arsenal(p))


@zombis_bp.route('/api/zombis/oleada', methods=['POST'])
def oleada():
    import perfil
    d = request.get_json(silent=True)
    if not isinstance(d, dict):
        return jsonify(error='Datos inválidos'), 400
    pid = identidad(d); n = d.get('oleada')
    if not pid or isinstance(n, bool) or not isinstance(n, int) or not 1 <= n <= 200:
        return jsonify(error='Oleada inválida'), 400
    with perfil.candado:
        ps = perfil._leer(); p = ps.get(pid, {}); s = partida_valida(p, d.get('partida'))
        if not s:
            return jsonify(error='La partida no está activa'), 400
        anterior = s.get('z_oleada', 0)
        if n == anterior:
            return jsonify(enemigos=s['z_enemigos'], **arsenal(p))
        if n != anterior + 1 or any(not x['cobrada'] for x in s.get('z_enemigos', [])):
            return jsonify(error='Completa primero la oleada actual'), 409
        enemigos = []
        for _ in range(min(40, 4 + n * 3)):
            r = random.random(); tipo = 'gigante' if n >= 3 and r < .12 else 'corredor' if n >= 2 and r < .4 else 'normal'
            enemigos.append({'id': secrets.token_urlsafe(12), 'tipo': tipo, 'cobrada': False})
        s['z_oleada'] = n; s['z_enemigos'] = enemigos
        perfil._guardar(ps)
        return jsonify(enemigos=enemigos, **arsenal(p))


@zombis_bp.route('/api/zombis/baja', methods=['POST'])
def baja():
    import perfil
    d = request.get_json(silent=True)
    if not isinstance(d, dict):
        return jsonify(error='Datos inválidos'), 400
    pid = identidad(d)
    if not pid:
        return jsonify(error='Falta el jugador'), 400
    with perfil.candado:
        ps = perfil._leer(); p = ps.get(pid, {}); s = partida_valida(p, d.get('partida'))
        if not s:
            return jsonify(error='La partida no está activa'), 400
        z = next((z for z in s.get('z_enemigos', []) if z['id'] == d.get('enemigo')), None)
        if z is None:
            return jsonify(error='Enemigo no reconocido'), 400
        ganadas = 0; nuevos = []
        if not z['cobrada']:
            z['cobrada'] = True; ganadas = PREMIOS[z['tipo']]; p['monedas'] += ganadas
            if perfil._sumar(p, 'zombis') >= 100:
                perfil._dar_logro(p, 'zombis_100', nuevos)
            if p['monedas'] >= 1000:
                perfil._dar_logro(p, 'rico', nuevos)
            perfil._guardar(ps)
        return jsonify(ganadas=ganadas, logros=nuevos, **arsenal(p))
