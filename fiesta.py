# =======================================================
# 🎉 JUEGOS DE FIESTA (varios jugadores, cada quien en su cel)
# =======================================================
# Para activarlo en app.py solo se necesitan estas 2 líneas:
#     from fiesta import fiesta_bp
#     app.register_blueprint(fiesta_bp)

import random
import string
import threading
import time

from flask import Blueprint, render_template, request, jsonify

fiesta_bp = Blueprint('fiesta', __name__)

salas_fiesta = {}
candado = threading.Lock()
HORAS_VIDA_SALA = 6

# --- Palabras para El Impostor ---
PALABRAS_IMPOSTOR = {
    "Comida": ["Pizza", "Tacos", "Sushi", "Hamburguesa", "Helado", "Pozole", "Tamales", "Hot dog",
               "Palomitas", "Chocolate", "Quesadilla", "Enchiladas", "Pastel", "Elote", "Churros",
               "Ramen", "Sandía", "Mango", "Galletas", "Cereal"],
    "Animales": ["Perro", "Gato", "Elefante", "Jirafa", "Tiburón", "Pingüino", "León", "Mono",
                 "Delfín", "Ajolote", "Panda", "Cocodrilo", "Búho", "Caballo", "Tortuga",
                 "Pulpo", "Conejo", "Murciélago", "Flamenco", "Camaleón"],
    "Lugares": ["Playa", "Escuela", "Hospital", "Cine", "Aeropuerto", "Supermercado", "Gimnasio",
                "Biblioteca", "Parque de diversiones", "Estadio", "Iglesia", "Zoológico", "Museo",
                "Restaurante", "Bosque", "Desierto", "Museo de cera", "Alberca", "Centro comercial",
                "Estación del metro"],
    "Objetos": ["Celular", "Paraguas", "Mochila", "Lápiz", "Tijeras", "Reloj", "Guitarra",
                "Espejo", "Cepillo de dientes", "Almohada", "Control de la tele", "Lentes",
                "Llaves", "Vela", "Audífonos", "Escoba", "Balón", "Sartén", "Cámara", "Bicicleta"],
    "Profesiones": ["Doctor", "Bombero", "Policía", "Maestro", "Chef", "Astronauta", "Piloto",
                    "Dentista", "Youtuber", "Futbolista", "Mesero", "Mecánico", "Veterinario",
                    "Payaso", "Programador", "Cantante", "Detective", "Pintor", "Taxista", "Jardinero"],
    "Deportes": ["Fútbol", "Básquetbol", "Natación", "Tenis", "Boxeo", "Béisbol", "Voleibol",
                 "Ciclismo", "Ajedrez", "Patinaje", "Surf", "Golf", "Karate", "Atletismo",
                 "Lucha libre", "Esquí", "Ping pong", "Escalada", "Gimnasia", "Hockey"],
    "Personajes": ["Mario Bros", "Pikachu", "Spider-Man", "Batman", "Shrek", "Hello Kitty",
                   "Bob Esponja", "Goku", "Harry Potter", "Elsa", "Sonic", "Minecraft Steve",
                   "Buzz Lightyear", "Chavo del 8", "Barbie", "Stitch", "Kirby", "Homero Simpson",
                   "Darth Vader", "Mickey Mouse"],
}

# --- Preguntas para ¿Quién es más probable? ---
PREGUNTAS_PROBABLE = [
    "...llegue tarde a su propia boda?",
    "...se haga famoso en TikTok?",
    "...se quede dormido en el cine?",
    "...se coma algo que se cayó al piso?",
    "...sobreviva a un apocalipsis zombie?",
    "...se ría en un momento serio?",
    "...gaste todo su dinero en comida?",
    "...se pierda usando el GPS?",
    "...adopte 10 gatos?",
    "...se vuelva millonario?",
    "...mande un mensaje al chat equivocado?",
    "...llore viendo una película animada?",
    "...se olvide del cumpleaños de su mejor amigo?",
    "...gane un concurso de baile?",
    "...se vaya a vivir a otro país?",
    "...diga un spoiler sin querer?",
    "...se tropiece en público?",
    "...termine siendo presidente?",
    "...se coma el último pedazo de pizza sin preguntar?",
    "...hable con su mascota como si fuera persona?",
    "...pase 12 horas seguidas jugando videojuegos?",
    "...cante en la regadera a todo volumen?",
    "...se ría de su propio chiste antes de contarlo?",
    "...se quede sin pila en el celular primero?",
    "...invente una excusa súper exagerada?",
    "...sea el primero en gritar en una película de terror?",
    "...se haga amigo de un desconocido en la fila?",
    "...escriba un libro?",
    "...pierda las llaves dentro de su casa?",
    "...se duerma primero en una pijamada?",
    "...pida comida a domicilio 3 veces en un día?",
    "...se tome 100 selfies para subir una?",
    "...gane un reality show?",
    "...le hable a una planta para que crezca?",
    "...diga 'ya voy' cuando apenas se está bañando?",
    "...se coma un chile entero por un reto?",
    "...olvide en dónde estacionó?",
    "...termine en las noticias por algo chistoso?",
    "...sea el último en entender un chiste?",
    "...se ponga a bailar sin música?",
]


def _ahora():
    return time.time()


def _limpiar_salas_viejas():
    limite = _ahora() - HORAS_VIDA_SALA * 3600
    for codigo in [c for c, s in salas_fiesta.items() if s['actualizado'] < limite]:
        del salas_fiesta[codigo]


def _nuevo_codigo():
    while True:
        codigo = ''.join(random.choices(string.ascii_uppercase.replace('O', '').replace('I', ''), k=4))
        if codigo not in salas_fiesta:
            return codigo


def _limpiar_nombre(nombre):
    nombre = (nombre or '').strip()[:16]
    return nombre or 'Jugador'


def _jugadores_publicos(sala):
    return [{'id': pid, 'nombre': sala['jugadores'][pid]['nombre'],
             'puntos': sala['jugadores'][pid]['puntos']}
            for pid in sala['orden'] if pid in sala['jugadores']]


def _contar_votos(sala):
    conteo = {}
    for voto in sala['votos'].values():
        conteo[voto] = conteo.get(voto, 0) + 1
    return conteo


def _todos_votaron(sala):
    return all(pid in sala['votos'] for pid in sala['orden'] if pid in sala['jugadores'])


# ---------------- Páginas ----------------
@fiesta_bp.route('/impostor')
def impostor():
    return render_template('impostor.html', categorias=list(PALABRAS_IMPOSTOR.keys()))


@fiesta_bp.route('/mas_probable')
def mas_probable():
    return render_template('mas_probable.html')


@fiesta_bp.route('/verdad_reto')
def verdad_reto():
    return render_template('verdad_reto.html')


# ---------------- API común ----------------
@fiesta_bp.route('/api/fiesta/crear', methods=['POST'])
def crear_sala():
    datos = request.json or {}
    juego = datos.get('juego')
    pid = datos.get('pid')
    if juego not in ('impostor', 'probable') or not pid:
        return jsonify({'error': 'Datos inválidos'}), 400
    with candado:
        _limpiar_salas_viejas()
        codigo = _nuevo_codigo()
        salas_fiesta[codigo] = {
            'juego': juego, 'host': pid, 'fase': 'lobby', 'ronda': 0,
            'jugadores': {pid: {'nombre': _limpiar_nombre(datos.get('nombre')), 'puntos': 0}},
            'orden': [pid], 'votos': {}, 'actualizado': _ahora(),
            # Impostor
            'categoria': '', 'palabra': '', 'impostores': [], 'empieza': '',
            'pista': True, 'num_impostores': 1, 'resultado': None,
            # Más probable
            'pregunta': '', 'preguntas_usadas': [],
        }
    return jsonify({'codigo': codigo})


@fiesta_bp.route('/api/fiesta/unirse', methods=['POST'])
def unirse_sala():
    datos = request.json or {}
    codigo = (datos.get('codigo') or '').strip().upper()
    pid = datos.get('pid')
    with candado:
        sala = salas_fiesta.get(codigo)
        if not sala or not pid:
            return jsonify({'error': 'Esa sala no existe 😿'}), 404
        if datos.get('juego') and datos.get('juego') != sala['juego']:
            return jsonify({'error': 'Ese código es de otro juego'}), 400
        if pid not in sala['jugadores']:
            if len(sala['jugadores']) >= 20:
                return jsonify({'error': 'La sala está llena'}), 400
            sala['jugadores'][pid] = {'nombre': _limpiar_nombre(datos.get('nombre')), 'puntos': 0}
            sala['orden'].append(pid)
        sala['actualizado'] = _ahora()
    return jsonify({'codigo': codigo})


@fiesta_bp.route('/api/fiesta/estado/<codigo>')
def estado_sala(codigo):
    pid = request.args.get('pid', '')
    with candado:
        sala = salas_fiesta.get(codigo.upper())
        if not sala:
            return jsonify({'error': 'La sala ya no existe'}), 404
        if pid not in sala['jugadores']:
            return jsonify({'error': 'Ya no estás en esta sala'}), 403

        estado = {
            'juego': sala['juego'], 'fase': sala['fase'], 'ronda': sala['ronda'],
            'host': sala['host'], 'soy_host': sala['host'] == pid,
            'jugadores': _jugadores_publicos(sala),
            'ya_vote': pid in sala['votos'], 'mi_voto': sala['votos'].get(pid),
            'votaron': [p for p in sala['orden'] if p in sala['votos']],
        }

        if sala['juego'] == 'impostor':
            estado['config'] = {'pista': sala['pista'], 'num_impostores': sala['num_impostores']}
            if sala['fase'] in ('jugando', 'votando'):
                soy_impostor = pid in sala['impostores']
                estado['soy_impostor'] = soy_impostor
                estado['categoria'] = sala['categoria'] if (not soy_impostor or sala['pista']) else '???'
                estado['palabra'] = None if soy_impostor else sala['palabra']
                estado['empieza'] = sala['empieza']
                estado['num_impostores'] = len(sala['impostores'])
            if sala['fase'] == 'resultado':
                estado['resultado'] = sala['resultado']
        else:
            estado['pregunta'] = sala['pregunta']
            if sala['fase'] == 'resultado':
                estado['conteo'] = _contar_votos(sala)

    return jsonify(estado)


@fiesta_bp.route('/api/fiesta/accion', methods=['POST'])
def accion_sala():
    datos = request.json or {}
    codigo = (datos.get('codigo') or '').upper()
    pid = datos.get('pid')
    accion = datos.get('accion')
    with candado:
        sala = salas_fiesta.get(codigo)
        if not sala or pid not in sala['jugadores']:
            return jsonify({'error': 'Sala no encontrada'}), 404
        sala['actualizado'] = _ahora()
        es_host = sala['host'] == pid

        if accion == 'salir':
            _sacar_jugador(sala, pid)
            if not sala['jugadores']:
                del salas_fiesta[codigo]
            return jsonify({'status': 'ok'})

        if accion == 'expulsar' and es_host:
            objetivo = datos.get('objetivo')
            if objetivo in sala['jugadores'] and objetivo != pid:
                _sacar_jugador(sala, objetivo)
            return jsonify({'status': 'ok'})

        if accion == 'votar':
            voto = datos.get('voto')
            if sala['fase'] == 'votando' and voto in sala['jugadores'] and pid not in sala['votos']:
                if sala['juego'] == 'impostor' and voto == pid:
                    return jsonify({'error': 'No puedes votar por ti'}), 400
                sala['votos'][pid] = voto
                if _todos_votaron(sala):
                    _cerrar_votacion(sala)
            return jsonify({'status': 'ok'})

        if not es_host:
            return jsonify({'error': 'Solo el anfitrión puede hacer eso'}), 403

        if sala['juego'] == 'impostor':
            return _accion_impostor(sala, accion, datos)
        return _accion_probable(sala, accion)


def _sacar_jugador(sala, pid):
    sala['jugadores'].pop(pid, None)
    sala['votos'].pop(pid, None)
    if pid in sala['orden']:
        sala['orden'].remove(pid)
    if sala['host'] == pid and sala['orden']:
        sala['host'] = sala['orden'][0]
    if sala['fase'] == 'votando' and sala['orden'] and _todos_votaron(sala):
        _cerrar_votacion(sala)


def _cerrar_votacion(sala):
    if sala['juego'] == 'impostor':
        _resultado_impostor(sala)
    else:
        conteo = _contar_votos(sala)
        if conteo:
            maximo = max(conteo.values())
            for elegido, votos in conteo.items():
                if votos == maximo and elegido in sala['jugadores']:
                    sala['jugadores'][elegido]['puntos'] += 1
    sala['fase'] = 'resultado'


# ---------------- 🕵️ El Impostor ----------------
def _accion_impostor(sala, accion, datos):
    if accion == 'iniciar' and sala['fase'] in ('lobby', 'resultado'):
        if len(sala['jugadores']) < 3:
            return jsonify({'error': 'Se necesitan al menos 3 jugadores'}), 400
        categoria = datos.get('categoria')
        if categoria not in PALABRAS_IMPOSTOR:
            categoria = random.choice(list(PALABRAS_IMPOSTOR.keys()))
        num = 2 if datos.get('num_impostores') == 2 and len(sala['jugadores']) >= 5 else 1
        sala['pista'] = bool(datos.get('pista', True))
        sala['num_impostores'] = num
        sala['categoria'] = categoria
        sala['palabra'] = random.choice(PALABRAS_IMPOSTOR[categoria])
        sala['impostores'] = random.sample(sala['orden'], num)
        sala['empieza'] = random.choice(sala['orden'])
        sala['votos'] = {}
        sala['resultado'] = None
        sala['ronda'] += 1
        sala['fase'] = 'jugando'
    elif accion == 'a_votar' and sala['fase'] == 'jugando':
        sala['votos'] = {}
        sala['fase'] = 'votando'
    elif accion == 'revelar' and sala['fase'] == 'votando':
        _cerrar_votacion(sala)
    elif accion == 'lobby':
        sala['fase'] = 'lobby'
        sala['votos'] = {}
    return jsonify({'status': 'ok'})


def _resultado_impostor(sala):
    conteo = _contar_votos(sala)
    expulsado = None
    if conteo:
        maximo = max(conteo.values())
        mas_votados = [p for p, v in conteo.items() if v == maximo]
        if len(mas_votados) == 1:
            expulsado = mas_votados[0]

    atrapado = expulsado in sala['impostores']
    impostores_vivos = [p for p in sala['impostores'] if p in sala['jugadores']]
    if atrapado:
        for pid in sala['orden']:
            if pid not in sala['impostores']:
                sala['jugadores'][pid]['puntos'] += 1
    else:
        for pid in impostores_vivos:
            sala['jugadores'][pid]['puntos'] += 2

    sala['resultado'] = {
        'expulsado': expulsado,
        'expulsado_nombre': sala['jugadores'][expulsado]['nombre'] if expulsado in sala['jugadores'] else None,
        'atrapado': atrapado,
        'impostores': [sala['jugadores'][p]['nombre'] for p in impostores_vivos],
        'palabra': sala['palabra'],
        'categoria': sala['categoria'],
        'conteo': conteo,
    }


# ---------------- 🤔 ¿Quién es más probable? ----------------
def _accion_probable(sala, accion):
    if accion in ('iniciar', 'siguiente') and sala['fase'] in ('lobby', 'resultado'):
        if len(sala['jugadores']) < 2:
            return jsonify({'error': 'Se necesitan al menos 2 jugadores'}), 400
        disponibles = [p for p in PREGUNTAS_PROBABLE if p not in sala['preguntas_usadas']]
        if not disponibles:
            sala['preguntas_usadas'] = []
            disponibles = PREGUNTAS_PROBABLE[:]
        sala['pregunta'] = random.choice(disponibles)
        sala['preguntas_usadas'].append(sala['pregunta'])
        sala['votos'] = {}
        sala['ronda'] += 1
        sala['fase'] = 'votando'
    elif accion == 'revelar' and sala['fase'] == 'votando':
        _cerrar_votacion(sala)
    elif accion == 'lobby':
        sala['fase'] = 'lobby'
        sala['votos'] = {}
    return jsonify({'status': 'ok'})
