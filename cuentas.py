"""Cuentas persistentes. Los permisos se resuelven en el servidor, nunca desde el navegador."""
import argparse
from contextlib import contextmanager
from copy import deepcopy
import hashlib
import json
import os
import re
import secrets
import sqlite3
import time
import unicodedata

from flask import Blueprint, abort, g, has_request_context, jsonify, render_template, request
from werkzeug.security import check_password_hash, generate_password_hash

cuentas_bp = Blueprint('cuentas', __name__)
ARCHIVO_CUENTAS = os.environ.get('ARCADE_CUENTAS_DB', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cuentas.sqlite3'))
COOKIE = 'arcade_sesion'
DIAS_SESION = 30
USUARIO_ADMIN = 'chris'


def normalizar_usuario(value):
    return unicodedata.normalize('NFKC', str(value or '')).strip().casefold()


def usuario_valido(value):
    return 3 <= len(value) <= 14 and all(c.isalnum() or c == '_' for c in value)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


@contextmanager
def conexion():
    db = sqlite3.connect(ARCHIVO_CUENTAS, timeout=15)
    db.row_factory = sqlite3.Row
    try:
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA journal_mode=WAL')
        db.executescript('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id TEXT PRIMARY KEY, usuario TEXT NOT NULL, usuario_norm TEXT NOT NULL UNIQUE,
                correo_admin TEXT UNIQUE, password_hash TEXT NOT NULL, recuperacion_hash TEXT NOT NULL,
                administrador INTEGER NOT NULL DEFAULT 0, creado REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS sesiones (
                token_hash TEXT PRIMARY KEY, usuario_id TEXT NOT NULL REFERENCES usuarios(id),
                jugador_pid TEXT NOT NULL, expira REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS invitaciones (
                token_hash TEXT PRIMARY KEY, correo TEXT NOT NULL, usuario_norm TEXT NOT NULL,
                aliases TEXT NOT NULL, expira REAL NOT NULL, usada INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS intentos (
                clave TEXT PRIMARY KEY, inicio REAL NOT NULL, cantidad INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS invitados_copiados (
                pid TEXT PRIMARY KEY, usuario_id TEXT NOT NULL REFERENCES usuarios(id));
            CREATE TABLE IF NOT EXISTS alias_records (
                alias TEXT PRIMARY KEY, usuario_id TEXT NOT NULL REFERENCES usuarios(id));
        ''')
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def cuenta_actual():
    if not has_request_context():
        return None
    if not hasattr(g, 'arcade_cuenta'):
        g.arcade_cuenta = None
        token = request.cookies.get(COOKIE, '')
        if token and len(token) <= 100 and os.path.exists(ARCHIVO_CUENTAS):
            with conexion() as db:
                row = db.execute('''SELECT u.*, s.jugador_pid FROM sesiones s
                    JOIN usuarios u ON u.id=s.usuario_id WHERE s.token_hash=? AND s.expira>?''',
                    (digest(token), time.time())).fetchone()
                g.arcade_cuenta = dict(row) if row else None
    return g.arcade_cuenta


def es_admin():
    return bool((cuenta_actual() or {}).get('administrador'))


def identidad_perfil(pid):
    cuenta = cuenta_actual()
    if cuenta:
        if pid != cuenta['jugador_pid']:
            abort(jsonify_error('Este jugador no pertenece a la sesión', 403))
        return cuenta['id']
    if pid.startswith('cuenta:'):
        abort(jsonify_error('Inicia sesión para abrir este perfil', 401))
    return pid


def ids_administradores():
    if not os.path.exists(ARCHIVO_CUENTAS):
        return set()
    with conexion() as db:
        return {r[0] for r in db.execute('SELECT id FROM usuarios WHERE administrador=1')}


def ids_invitados_copiados():
    if not os.path.exists(ARCHIVO_CUENTAS):
        return set()
    with conexion() as db:
        return {r[0] for r in db.execute('SELECT pid FROM invitados_copiados')}


def jsonify_error(mensaje, status=400):
    response = jsonify({'error': mensaje})
    response.status_code = status
    return response


@cuentas_bp.before_app_request
def proteger_escrituras():
    if request.method == 'POST' and request.path.startswith(('/api/cuenta/', '/api/perfil')):
        if not request.is_json:
            return jsonify_error('Envía los datos como JSON', 415)
        origin = request.headers.get('Origin')
        if origin and origin.rstrip('/') != request.host_url.rstrip('/'):
            return jsonify_error('Origen no permitido', 403)


@cuentas_bp.after_app_request
def sin_cache_privada(response):
    if request.path.startswith(('/api/cuenta/', '/api/perfil')) or request.path == '/cuenta':
        response.headers['Cache-Control'] = 'no-store'
    return response


def datos_json():
    value = request.get_json(silent=True)
    return value if isinstance(value, dict) else {}


def password_valida(value):
    return isinstance(value, str) and 10 <= len(value) <= 128


def publico(cuenta):
    if not cuenta:
        return {'autenticado': False}
    return {'autenticado': True, 'usuario': cuenta['usuario'],
            'administrador': bool(cuenta['administrador']), 'correo': cuenta['correo_admin']}


def limitar(clase, usuario, maximo=10):
    clave = digest(f'{clase}:{request.remote_addr}:{usuario}')
    with conexion() as db:
        db.execute('DELETE FROM intentos WHERE inicio<?', (time.time() - 900,))
        db.execute('INSERT OR IGNORE INTO intentos VALUES (?, ?, 0)', (clave, time.time()))
        db.execute('UPDATE intentos SET cantidad=cantidad+1 WHERE clave=?', (clave,))
        cantidad = db.execute('SELECT cantidad FROM intentos WHERE clave=?', (clave,)).fetchone()[0]
    return cantidad <= maximo


def validar_invitacion(db, token, usuario, correo):
    if not token or not isinstance(token, str) or len(token) > 100:
        raise ValueError('Necesitas el enlace privado de administrador')
    inv = db.execute('SELECT * FROM invitaciones WHERE token_hash=? AND usada=0 AND expira>?',
                     (digest(token), time.time())).fetchone()
    if not inv or inv['usuario_norm'] != usuario or inv['correo'] != correo:
        raise ValueError('La invitación no es válida para esta cuenta o ya expiró')
    return inv


def activar_admin(db, cuenta_id, inv):
    from records_cuenta import normalizar_alias
    db.execute('UPDATE usuarios SET administrador=1, correo_admin=? WHERE id=?', (inv['correo'], cuenta_id))
    db.execute('UPDATE invitaciones SET usada=1 WHERE token_hash=?', (inv['token_hash'],))
    for alias in json.loads(inv['aliases']):
        db.execute('INSERT OR REPLACE INTO alias_records VALUES (?, ?)', (normalizar_alias(alias), cuenta_id))


def respuesta_sesion(db, cuenta_id, pid, extra=None):
    token = secrets.token_urlsafe(32)
    db.execute('DELETE FROM sesiones WHERE expira<?', (time.time(),))
    db.execute('INSERT INTO sesiones VALUES (?, ?, ?, ?)',
               (digest(token), cuenta_id, pid, time.time() + DIAS_SESION * 86400))
    row = db.execute('SELECT * FROM usuarios WHERE id=?', (cuenta_id,)).fetchone()
    response = jsonify({**publico(row), **(extra or {})})
    response.set_cookie(COOKIE, token, max_age=DIAS_SESION * 86400, httponly=True,
                        secure=request.is_secure or os.environ.get('ARCADE_COOKIE_SECURE') == '1', samesite='Lax')
    return response


@cuentas_bp.route('/cuenta')
def pagina_cuenta():
    return render_template('cuenta.html')


@cuentas_bp.route('/api/cuenta/estado')
def estado():
    return jsonify(publico(cuenta_actual()))


@cuentas_bp.route('/api/cuenta/registrar', methods=['POST'])
def registrar():
    import perfil
    d = datos_json()
    usuario = unicodedata.normalize('NFKC', str(d.get('usuario') or '')).strip()
    norm = normalizar_usuario(usuario)
    pid = str(d.get('pid') or '')[:40]
    password = d.get('password')
    if not usuario_valido(usuario) or not pid or pid.startswith('cuenta:') or not password_valida(password):
        return jsonify_error('Usa un usuario de 3–14 letras, números o _, y una contraseña de 10–128 caracteres')
    if cuenta_actual():
        return jsonify_error('Cierra tu sesión antes de crear otra cuenta')
    if not limitar('registro', '', 20):
        return jsonify_error('Demasiados intentos. Espera 15 minutos', 429)
    codigo = secrets.token_hex(20)
    password_hash = generate_password_hash(password)
    cuenta_id = 'cuenta:' + secrets.token_hex(12)
    try:
        with perfil.candado, conexion() as db:
            db.execute('BEGIN IMMEDIATE')
            inv = None
            if norm in ('chris', 'chrs', 'chros') or d.get('invitacion'):
                inv = validar_invitacion(db, d.get('invitacion'), norm,
                                         str(d.get('correo') or '').strip().casefold())
            db.execute('INSERT INTO usuarios VALUES (?, ?, ?, NULL, ?, ?, 0, ?)',
                       (cuenta_id, usuario, norm, password_hash, digest(codigo), time.time()))
            perfiles = perfil._leer()
            copiado = db.execute('SELECT 1 FROM invitados_copiados WHERE pid=?', (pid,)).fetchone()
            p = deepcopy(perfiles.get(pid, perfil._nuevo(usuario))) if not copiado else perfil._nuevo(usuario)
            p['nombre'] = usuario
            p['_partidas'] = {}
            perfiles[cuenta_id] = p
            db.execute('INSERT OR IGNORE INTO invitados_copiados VALUES (?, ?)', (pid, cuenta_id))
            if inv:
                activar_admin(db, cuenta_id, inv)
            # Guardar primero una copia: un fallo nunca borra el perfil original del invitado.
            perfil._guardar(perfiles)
            response = respuesta_sesion(db, cuenta_id, pid, {'recuperacion': codigo})
        return response
    except sqlite3.IntegrityError:
        return jsonify_error('Ese usuario ya está registrado. Prueba otro, como ' + usuario[:12] + '1', 409)
    except ValueError as exc:
        return jsonify_error(str(exc))


@cuentas_bp.route('/api/cuenta/entrar', methods=['POST'])
def entrar():
    d = datos_json()
    identificador = normalizar_usuario(d.get('usuario'))
    pid = str(d.get('pid') or '')[:40]
    password = d.get('password')
    if not pid or pid.startswith('cuenta:') or not isinstance(password, str) or len(password) > 128:
        return jsonify_error('Datos inválidos')
    if not limitar('login', identificador):
        return jsonify_error('Demasiados intentos. Espera 15 minutos', 429)
    with conexion() as db:
        db.execute('BEGIN IMMEDIATE')
        cuenta = db.execute('SELECT * FROM usuarios WHERE usuario_norm=? OR correo_admin=?',
                            (identificador, identificador)).fetchone()
        if not cuenta or not check_password_hash(cuenta['password_hash'], password):
            return jsonify_error('Usuario o contraseña incorrectos', 401)
        if d.get('invitacion'):
            try:
                inv = validar_invitacion(db, d['invitacion'], cuenta['usuario_norm'],
                                         str(d.get('correo') or '').strip().casefold())
                activar_admin(db, cuenta['id'], inv)
            except ValueError as exc:
                return jsonify_error(str(exc))
        return respuesta_sesion(db, cuenta['id'], pid)


@cuentas_bp.route('/api/cuenta/salir', methods=['POST'])
def salir():
    with conexion() as db:
        db.execute('DELETE FROM sesiones WHERE token_hash=?', (digest(request.cookies.get(COOKIE, '')),))
    response = jsonify({'autenticado': False})
    response.delete_cookie(COOKIE)
    return response


@cuentas_bp.route('/api/cuenta/recuperar', methods=['POST'])
def recuperar():
    d = datos_json()
    usuario = normalizar_usuario(d.get('usuario'))
    codigo = str(d.get('codigo') or '')
    if not password_valida(d.get('password')) or not codigo or len(codigo) > 100:
        return jsonify_error('Escribe tu usuario, el código de recuperación y una contraseña de 10–128 caracteres')
    if not limitar('recuperacion', usuario, 5):
        return jsonify_error('Demasiados intentos. Espera 15 minutos', 429)
    nuevo = secrets.token_hex(20)
    with conexion() as db:
        db.execute('BEGIN IMMEDIATE')
        cuenta = db.execute('SELECT * FROM usuarios WHERE usuario_norm=? AND recuperacion_hash=?',
                            (usuario, digest(codigo))).fetchone()
        if not cuenta:
            return jsonify_error('Usuario o código incorrectos', 401)
        db.execute('UPDATE usuarios SET password_hash=?, recuperacion_hash=? WHERE id=?',
                   (generate_password_hash(d['password']), digest(nuevo), cuenta['id']))
        db.execute('DELETE FROM sesiones WHERE usuario_id=?', (cuenta['id'],))
    response = jsonify({'recuperacion': nuevo})
    response.delete_cookie(COOKIE)
    return response


def crear_invitacion(correo, usuario=USUARIO_ADMIN, aliases=('chris', 'chrs', 'chros')):
    correo = correo.strip().casefold()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', correo):
        raise ValueError('Correo inválido')
    token = secrets.token_urlsafe(32)
    with conexion() as db:
        db.execute('UPDATE invitaciones SET usada=1 WHERE usuario_norm=?', (normalizar_usuario(usuario),))
        db.execute('INSERT INTO invitaciones VALUES (?, ?, ?, ?, ?, 0)',
                   (digest(token), correo, normalizar_usuario(usuario), json.dumps(list(aliases)), time.time() + 172800))
    return token


def main():
    parser = argparse.ArgumentParser(description='Administración local del arcade')
    sub = parser.add_subparsers(dest='accion', required=True)
    inv = sub.add_parser('invitar-admin')
    inv.add_argument('correo')
    args = parser.parse_args()
    if args.accion == 'invitar-admin':
        token = crear_invitacion(args.correo)
        print('Enlace privado para activar chris (válido 48 horas, un solo uso):')
        print('/cuenta?invitacion=' + token)
        print('Ábrelo en tu dominio. No compartas este enlace.')


if __name__ == '__main__':
    main()
