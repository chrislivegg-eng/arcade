"""Compatibilidad de récords históricos y cuentas, sin borrar los archivos originales."""
import ast
import os
import threading
import unicodedata
from flask import abort

candado = threading.Lock()


def normalizar_alias(nombre):
    return unicodedata.normalize('NFKC', str(nombre)).strip().casefold()


def propietarios():
    import cuentas
    if not os.path.exists(cuentas.ARCHIVO_CUENTAS):
        return {}, {}
    with cuentas.conexion() as db:
        usuarios = {r['usuario_norm']: r['usuario'] for r in db.execute('SELECT * FROM usuarios')}
        aliases = {r['alias']: r['usuario'] for r in db.execute(
            'SELECT a.alias,u.usuario FROM alias_records a JOIN usuarios u ON a.usuario_id=u.id')}
    return usuarios, aliases


def nombre_historico(nombre, usuarios, aliases):
    from cuentas import normalizar_usuario
    return aliases.get(normalizar_alias(nombre), usuarios.get(normalizar_usuario(nombre), nombre.strip()))


def nombre_guardado(nombre):
    from cuentas import cuenta_actual, normalizar_usuario, jsonify_error
    cuenta = cuenta_actual()
    if cuenta:
        return cuenta['usuario']
    usuarios, aliases = propietarios()
    # Los invitados conservan sus récords, pero no pueden escribir con una identidad registrada.
    if normalizar_usuario(nombre) in usuarios or normalizar_alias(nombre) in aliases:
        abort(jsonify_error('Inicia sesión para guardar con ese usuario', 401))
    return str(nombre).strip().replace(':', '').replace('\n', '').replace('\r', '')[:14].title() or 'Invitado'


def leer_tabla(archivo, menor=False):
    usuarios, aliases = propietarios()
    filas = {}
    victorias = os.path.basename(archivo).startswith('victorias_')
    menor = menor or os.path.basename(archivo) == 'record_memorama.txt'
    if os.path.exists(archivo):
        with open(archivo, encoding='utf-8') as f:
            for linea in f:
                try:
                    nombre, puntos = linea.strip().rsplit(':', 1)
                    puntos = int(puntos)
                except ValueError:
                    continue
                nombre = nombre_historico(nombre, usuarios, aliases)
                if nombre not in filas:
                    filas[nombre] = puntos
                elif victorias:
                    filas[nombre] += puntos
                else:
                    filas[nombre] = (min if menor else max)(filas[nombre], puntos)
    return filas


def guardar_legacy(archivo, nombre, puntos, inverso=False, acumulable=False):
    nombre = nombre_guardado(nombre)
    if isinstance(puntos, bool) or not isinstance(puntos, int) or not 0 <= puntos <= 1000000000:
        from cuentas import jsonify_error
        abort(jsonify_error('Puntos inválidos'))
    with candado:
        filas = leer_tabla(archivo, inverso)
        anterior = filas.get(nombre)
        if acumulable and os.path.basename(archivo) != 'record_memorama.txt':
            filas[nombre] = (anterior or 0) + puntos
        else:
            menor = inverso or os.path.basename(archivo) == 'record_memorama.txt'
            filas[nombre] = puntos if anterior is None else (min if menor else max)(anterior, puntos)
        with open(archivo + '.tmp', 'w', encoding='utf-8') as f:
            for n, p in filas.items():
                f.write(f'{n}:{p}\n')
        os.replace(archivo + '.tmp', archivo)


def preparar_app(codigo):
    """Modifica solo las funciones de récords; conserva las rutas de inventario del servidor."""
    tree = ast.parse(codigo)
    cambios = []
    encontrados = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef):
            continue
        if node.name == 'leer_records' and [a.arg for a in node.args.args] == ['archivo', 'inverso']:
            cuerpo = ('from records_cuenta import leer_tabla\n'
                      'filas = leer_tabla(archivo, inverso)\n'
                      'return dict(sorted(filas.items(), key=lambda x: x[1], reverse=not inverso))')
        elif node.name == 'guardar_generico' and [a.arg for a in node.args.args] == ['archivo', 'nombre', 'puntos', 'inverso', 'acumulable']:
            cuerpo = ('from records_cuenta import guardar_legacy\n'
                      'guardar_legacy(archivo, nombre, puntos, inverso, acumulable)\n'
                      'return jsonify({"status": "ok"})')
        elif node.name == 'records_pixel_art' and not node.args.args:
            cuerpo = ('from records_cuenta import leer_tabla\n'
                      'records = leer_tabla(ARCHIVO_PIXEL_ART)\n'
                      'return jsonify([{"nombre": n, "puntos": p} for n, p in sorted(records.items(), key=lambda x: x[1], reverse=True)])')
        else:
            continue
        encontrados.add(node.name)
        indent = ' ' * (node.col_offset + 4)
        cambios.append((node.body[0].lineno - 1, node.end_lineno,
                        ''.join(indent + l + '\n' for l in cuerpo.splitlines())))
    if not {'leer_records', 'guardar_generico'} <= encontrados:
        raise ValueError('No se reconocieron las funciones de récords de app.py; se conserva el archivo')
    lineas = codigo.splitlines(keepends=True)
    for inicio, fin, cuerpo in sorted(cambios, reverse=True):
        lineas[inicio:fin] = [cuerpo]
    nuevo = ''.join(lineas)
    compile(nuevo, 'app.py', 'exec')
    return nuevo
