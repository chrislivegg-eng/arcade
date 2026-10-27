"""Progreso persistente y recompensas verificadas del béisbol de distancia."""
import random
import secrets
import time

from flask import Blueprint, jsonify, request
from cuentas import cuenta_actual, es_admin, identidad_perfil

beisbol_bp = Blueprint('beisbol_progreso', __name__)

CATALOGO = {
    'personajes': [
        {'id':'novato','nombre':'Novato','icono':'🧢','precio':0,'potencia':1,'ventana':0,'habilidad':'Equilibrado'},
        {'id':'felina','nombre':'Felina Veloz','icono':'🐱','precio':120,'potencia':1.05,'ventana':.13,'habilidad':'Zona perfecta más amplia'},
        {'id':'robot','nombre':'Robot Slugger','icono':'🤖','precio':270,'potencia':1.22,'ventana':0,'habilidad':'Golpe más fuerte'},
        {'id':'samurai','nombre':'Samurái del Diamante','icono':'🥷','precio':420,'potencia':1.15,'ventana':.2,'habilidad':'Precisión superior'},
        {'id':'dragon','nombre':'Dragón Estelar','icono':'🐲','precio':750,'potencia':1.38,'ventana':.08,'habilidad':'Fuerza legendaria'},
    ],
    'bates': [
        {'id':'madera','nombre':'Madera Clásica','icono':'🏏','precio':0,'potencia':1,'ventana':0,'habilidad':'Golpe confiable'},
        {'id':'neon','nombre':'Neón','icono':'💜','precio':110,'potencia':1.08,'ventana':.07,'habilidad':'Mayor precisión'},
        {'id':'acero','nombre':'Acero','icono':'🔩','precio':240,'potencia':1.23,'ventana':0,'habilidad':'Más potencia'},
        {'id':'rayo','nombre':'Rayo','icono':'⚡','precio':450,'potencia':1.32,'ventana':.06,'habilidad':'Impacto eléctrico'},
        {'id':'galaxia','nombre':'Galaxia','icono':'🌌','precio':760,'potencia':1.48,'ventana':.1,'habilidad':'Poder cósmico'},
    ],
    'pelotas': [
        {'id':'clasica','nombre':'Clásica','icono':'⚾','precio':0,'vuelo':1,'monedas':1,'habilidad':'Vuelo equilibrado'},
        {'id':'rebote','nombre':'Rebote','icono':'🔵','precio':130,'vuelo':1.17,'monedas':1,'habilidad':'Un rebote adicional'},
        {'id':'cometa','nombre':'Cometa','icono':'☄️','precio':290,'vuelo':1.34,'monedas':1,'habilidad':'Planea más lejos'},
        {'id':'oro','nombre':'Dorada','icono':'🟡','precio':440,'vuelo':1.08,'monedas':1.45,'habilidad':'Más monedas por metro'},
        {'id':'cohete','nombre':'Cohete','icono':'🚀','precio':800,'vuelo':1.6,'monedas':1.15,'habilidad':'Propulsión extra'},
    ],
}
INICIALES = {'personajes':'novato','bates':'madera','pelotas':'clasica'}
MEJORAS = {'fuerza':{'nombre':'Fuerza','maximo':10,'base':50,'paso':38},
           'monedas':{'nombre':'Multiplicador de monedas','maximo':10,'base':65,'paso':47}}


def _identidad(datos):
    pid = datos.get('pid')
    return identidad_perfil(pid[:40]) if isinstance(pid, str) and pid else None


def _progreso(p):
    return p.setdefault('beisbol', {'comprados':{k:[v] for k,v in INICIALES.items()},
                                   'equipado':dict(INICIALES),'mejoras':{'fuerza':0,'monedas':0},
                                   'bates_nivel':{},'record':0,'golpes':0})


def _item(categoria, item_id):
    return next((i for i in CATALOGO[categoria] if i['id'] == item_id), None)


def _estado(p):
    prog = _progreso(p)
    admin = es_admin()
    niveles = {k:MEJORAS[k]['maximo'] if admin else prog['mejoras'].get(k,0) for k in MEJORAS}
    return {'monedas':p['monedas'],'infinitas':admin,'record':prog['record'],'golpes':prog['golpes'],
            'catalogo':{k:[{**item,'comprado':admin or item['id'] in prog['comprados'].get(k,[]),
                            **({'nivel':5 if admin else prog['bates_nivel'].get(item['id'],0),
                                'mejora_precio':None if admin or prog['bates_nivel'].get(item['id'],0)>=5
                                else 60+prog['bates_nivel'].get(item['id'],0)*42} if k=='bates' else {})}
                           for item in items] for k,items in CATALOGO.items()},
            'equipado':prog['equipado'],
            'mejoras':{k:{'nivel':nivel,'maximo':MEJORAS[k]['maximo'],
                          'precio':None if nivel>=MEJORAS[k]['maximo'] else MEJORAS[k]['base']+nivel*MEJORAS[k]['paso'],
                          'nombre':MEJORAS[k]['nombre']} for k,nivel in niveles.items()}}


def _datos():
    datos = request.get_json(silent=True)
    return datos if isinstance(datos, dict) else None


@beisbol_bp.route('/api/beisbol/estado')
def estado():
    import perfil
    pid = _identidad(request.args)
    if not pid:
        return jsonify(error='Falta el jugador'), 400
    with perfil.candado:
        ps=perfil._leer();p=ps.setdefault(pid,perfil._nuevo());perfil._guardar(ps)
        return jsonify(_estado(p))


@beisbol_bp.route('/api/beisbol/tienda', methods=['POST'])
def tienda():
    import perfil
    d=_datos()
    if d is None:
        return jsonify(error='Datos inválidos'),400
    pid=_identidad(d)
    if not pid:
        return jsonify(error='Falta el jugador'),400
    accion=d.get('accion');categoria=d.get('categoria');item_id=d.get('item')
    if accion not in ('comprar','equipar','mejorar','mejorar_bate'):
        return jsonify(error='Acción inválida'),400
    if accion=='mejorar':
        if categoria not in MEJORAS or isinstance(d.get('nivel'),bool) or not isinstance(d.get('nivel'),int):
            return jsonify(error='Mejora inválida'),400
    elif categoria not in CATALOGO or not isinstance(item_id,str) or not _item(categoria,item_id):
        return jsonify(error='Objeto inválido'),400
    if accion=='mejorar_bate' and (categoria!='bates' or isinstance(d.get('nivel'),bool) or not isinstance(d.get('nivel'),int)):
        return jsonify(error='Bate inválido'),400
    with perfil.candado:
        ps=perfil._leer();p=ps.setdefault(pid,perfil._nuevo());prog=_progreso(p);admin=es_admin()
        if accion=='mejorar':
            nivel=prog['mejoras'].get(categoria,0)
            if admin:
                return jsonify(_estado(p))
            if nivel!=d['nivel']:
                return jsonify(error='La mejora ya cambió',**_estado(p)),409
            info=MEJORAS[categoria]
            if nivel>=info['maximo']:
                return jsonify(error='Nivel máximo'),400
            precio=info['base']+nivel*info['paso']
            if p['monedas']<precio:
                return jsonify(error='Faltan monedas',**_estado(p)),400
            p['monedas']-=precio;prog['mejoras'][categoria]=nivel+1
        elif accion=='mejorar_bate':
            if not admin and item_id not in prog['comprados'].get('bates',[]):
                return jsonify(error='Primero desbloquea este bate',**_estado(p)),400
            nivel=prog['bates_nivel'].get(item_id,0)
            if admin:return jsonify(_estado(p))
            if nivel!=d['nivel']:return jsonify(error='El bate ya cambió',**_estado(p)),409
            if nivel>=5:return jsonify(error='Nivel máximo'),400
            precio=60+nivel*42
            if p['monedas']<precio:return jsonify(error='Faltan monedas',**_estado(p)),400
            p['monedas']-=precio;prog['bates_nivel'][item_id]=nivel+1
        else:
            item=_item(categoria,item_id)
            comprados=prog['comprados'].setdefault(categoria,[INICIALES[categoria]])
            if accion=='comprar' and item_id not in comprados and not admin:
                if p['monedas']<item['precio']:
                    return jsonify(error='Faltan monedas',**_estado(p)),400
                p['monedas']-=item['precio'];comprados.append(item_id)
            if accion=='equipar':
                if not admin and item_id not in comprados:
                    return jsonify(error='Primero desbloquea este objeto',**_estado(p)),400
                prog['equipado'][categoria]=item_id
        perfil._guardar(ps)
        return jsonify(_estado(p))


@beisbol_bp.route('/api/beisbol/lanzar', methods=['POST'])
def lanzar():
    import perfil
    d=_datos()
    if d is None:
        return jsonify(error='Datos inválidos'),400
    pid=_identidad(d)
    if not pid:
        return jsonify(error='Falta el jugador'),400
    with perfil.candado:
        ps=perfil._leer();p=ps.setdefault(pid,perfil._nuevo());_progreso(p)
        token=secrets.token_urlsafe(18);sweet_ms=random.randint(1250,1650)
        p['beisbol_lanzamiento']={'token':token,'inicio':time.time(),'dulce_ms':sweet_ms}
        perfil._guardar(ps)
    return jsonify(lanzamiento=token,dulce_ms=sweet_ms)


@beisbol_bp.route('/api/beisbol/golpear', methods=['POST'])
def golpear():
    import perfil
    d=_datos()
    if d is None:
        return jsonify(error='Datos inválidos'),400
    pid=_identidad(d)
    if not pid or not isinstance(d.get('lanzamiento'),str):
        return jsonify(error='Lanzamiento inválido'),400
    with perfil.candado:
        ps=perfil._leer();p=ps.get(pid)
        pitch=p.get('beisbol_lanzamiento') if p else None
        if not pitch or pitch['token']!=d['lanzamiento']:
            return jsonify(error='El lanzamiento ya terminó'),409
        elapsed=time.time()-pitch['inicio']
        if elapsed>8:
            p.pop('beisbol_lanzamiento',None);perfil._guardar(ps)
            return jsonify(error='El lanzamiento expiró'),409
        prog=_progreso(p);admin=es_admin()
        equipped=prog['equipado'];char=_item('personajes',equipped['personajes'])
        bat=_item('bates',equipped['bates']);ball=_item('pelotas',equipped['pelotas'])
        levels={k:MEJORAS[k]['maximo'] if admin else prog['mejoras'].get(k,0) for k in MEJORAS}
        error=abs(elapsed-pitch['dulce_ms']/1000)
        window=1.0+char['ventana']+bat['ventana']
        precision=max(0,1-error/window)
        perfecto=error<.11+char['ventana']*.35+bat['ventana']*.35
        bat_level=5 if admin else prog['bates_nivel'].get(bat['id'],0)
        distancia=round((160+1150*precision**1.8)*(1+levels['fuerza']*.16)
                        *char['potencia']*bat['potencia']*(1+bat_level*.08)*ball['vuelo'])
        monedas=max(1,round(distancia/36*(1+levels['monedas']*.2)*ball['monedas']))
        p['monedas']+=monedas;prog['golpes']+=1
        prog['record']=max(prog['record'],distancia)
        p.setdefault('stats',{})['beisbol_golpes']=prog['golpes']
        if 'beisbol' not in p.setdefault('juegos',[]):p['juegos'].append('beisbol')
        p.pop('beisbol_lanzamiento',None)
        perfil._guardar(ps)
        respuesta={'distancia':distancia,'monedas_ganadas':monedas,'precision':round(precision,3),
                   'perfecto':perfecto,'estado':_estado(p)}
        nombre=(cuenta_actual() or {}).get('usuario') or p['nombre']
    # El récord usa la distancia calculada por el servidor, nunca una cifra del navegador.
    from duelo import _leer_records, _archivo_record, candado as candado_records
    from records_cuenta import nombre_guardado
    nombre=nombre_guardado(nombre)
    with candado_records:
        records=_leer_records('beisbol')
        if distancia>records.get(nombre,0):
            records[nombre]=distancia
            with open(_archivo_record('beisbol'),'w',encoding='utf-8') as f:
                for n,valor in records.items():f.write(f'{n}:{valor}\n')
    return jsonify(respuesta)
