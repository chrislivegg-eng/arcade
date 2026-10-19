# =======================================================
# 🎉 MÁS JUEGOS DE FIESTA
# =======================================================
# Dibuja y Adivina · Dos Verdades y una Mentira · Trivia Rápida
# Completa la Frase · Basta · Espía
#
# Usan las mismas salas de fiesta.py: aquí solo está la lógica de cada juego.
# fiesta.py importa este archivo al final, así que no hay que tocar app.py.

import random
import time
import unicodedata

from flask import render_template

from fiesta import fiesta_bp, JUEGOS_EXTRA


def ahora():
    return time.time()


def normalizar(texto):
    texto = unicodedata.normalize('NFD', (texto or '').strip().lower())
    texto = ''.join(c for c in texto if unicodedata.category(c) != 'Mn')
    return ' '.join(texto.split())


def distancia(a, b):
    """Cuántas letras hay que cambiar para pasar de a a b (Levenshtein)."""
    if abs(len(a) - len(b)) > 2:
        return 99
    fila = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        nueva = [i]
        for j, cb in enumerate(b, 1):
            nueva.append(min(fila[j] + 1, nueva[j - 1] + 1, fila[j - 1] + (ca != cb)))
        fila = nueva
    return fila[-1]


def sumar(sala, pid, puntos):
    if pid in sala['jugadores']:
        sala['jugadores'][pid]['puntos'] += puntos


def nombre(sala, pid):
    j = sala['jugadores'].get(pid)
    return j['nombre'] if j else 'Alguien'


def reiniciar_puntos(sala):
    for j in sala['jugadores'].values():
        j['puntos'] = 0


def activos(sala):
    return [p for p in sala['orden'] if p in sala['jugadores']]


def restante(sala):
    return max(0, sala.get('limite', 0) - ahora())


class JuegoBase:
    minimo = 2

    def preparar(self, sala):
        pass

    def tick(self, sala):
        pass

    def vista(self, sala, pid, args):
        return {}

    def accion(self, sala, pid, accion, datos, es_host):
        return None

    def al_salir(self, sala, pid):
        pass

    def puede_iniciar(self, sala, es_host):
        if not es_host or sala['fase'] not in ('lobby', 'final'):
            return {'error': 'Solo el anfitrión puede empezar'}
        if len(sala['jugadores']) < self.minimo:
            return {'error': f'Se necesitan al menos {self.minimo} jugadores'}
        return None


# =======================================================
# 🎨 DIBUJA Y ADIVINA
# =======================================================
PALABRAS_DIBUJO = [
    "Gato", "Perro", "Casa", "Sol", "Luna", "Árbol", "Flor", "Pizza", "Helado", "Pez", "Carro", "Avión",
    "Barco", "Bicicleta", "Guitarra", "Corazón", "Estrella", "Nube", "Lluvia", "Arcoíris", "Montaña",
    "Playa", "Volcán", "Dinosaurio", "Elefante", "Jirafa", "Serpiente", "Mariposa", "Araña", "Tiburón",
    "Pulpo", "Tortuga", "Conejo", "Pollo", "Vaca", "Cerdo", "Robot", "Fantasma", "Calabaza", "Pastel",
    "Hamburguesa", "Taco", "Plátano", "Manzana", "Fresa", "Sandía", "Zapato", "Lentes", "Sombrero",
    "Reloj", "Celular", "Televisión", "Computadora", "Lápiz", "Libro", "Llave", "Puerta", "Ventana",
    "Cama", "Silla", "Mesa", "Escalera", "Paraguas", "Globo", "Regalo", "Cohete", "Planeta", "Corona",
    "Espada", "Castillo", "Dragón", "Unicornio", "Sirena", "Payaso", "Bombero", "Doctor", "Futbol",
    "Basquetbol", "Pesas", "Trofeo", "Campana", "Ancla", "Cámara", "Audífonos", "Micrófono", "Tambor",
    "Piano", "Huevo", "Pan", "Hot dog", "Palomitas", "Cactus", "Hongo", "Fuego", "Rayo", "Muñeco de nieve",
    "Pirata", "Ojo", "Mano", "Pie", "Diente", "Nariz", "Tren", "Semáforo", "Puente", "Torre Eiffel",
]


class Dibuja(JuegoBase):
    TIEMPO = 80
    ELEGIR = 15
    REVELAR = 6

    def preparar(self, sala):
        sala.update(dib_turno=-1, dibujante=None, opciones=[], palabra='', trazos=[], trazos_v=0,
                    chat=[], acertaron=[], limite=0, vueltas=1, usadas=[], inicio_dibujo=0)

    def _mensaje(self, sala, texto, tipo='sistema', de=None):
        sala['chat'] = (sala['chat'] + [{'texto': texto, 'tipo': tipo, 'de': de}])[-30:]

    def _siguiente(self, sala):
        sala['dib_turno'] += 1
        jugadores = activos(sala)
        if not jugadores or sala['dib_turno'] >= len(jugadores) * sala['vueltas']:
            sala['fase'] = 'final'
            return
        sala['dibujante'] = jugadores[sala['dib_turno'] % len(jugadores)]
        libres = [p for p in PALABRAS_DIBUJO if p not in sala['usadas']] or PALABRAS_DIBUJO
        sala['opciones'] = random.sample(libres, 3)
        sala.update(fase='eligiendo', limite=ahora() + self.ELEGIR, trazos=[], acertaron=[], palabra='')
        sala['trazos_v'] += 1

    def _elegir(self, sala, i):
        sala['palabra'] = sala['opciones'][i]
        sala['usadas'].append(sala['palabra'])
        sala.update(fase='dibujando', limite=ahora() + self.TIEMPO, inicio_dibujo=ahora())
        sala['ronda'] += 1
        self._mensaje(sala, f"🎨 Dibuja {nombre(sala, sala['dibujante'])}")

    def _terminar_ronda(self, sala):
        self._mensaje(sala, f"La palabra era: {sala['palabra'] or '—'}")
        sala.update(fase='revelar', limite=ahora() + self.REVELAR)

    def tick(self, sala):
        f = sala['fase']
        if f in ('eligiendo', 'dibujando') and sala['dibujante'] not in sala['jugadores']:
            return self._terminar_ronda(sala)
        if f == 'eligiendo' and ahora() > sala['limite']:
            self._elegir(sala, random.randrange(3))
        elif f == 'dibujando':
            adivinadores = [p for p in activos(sala) if p != sala['dibujante']]
            if ahora() > sala['limite'] or (adivinadores and all(p in sala['acertaron'] for p in adivinadores)):
                self._terminar_ronda(sala)
        elif f == 'revelar' and ahora() > sala['limite']:
            self._siguiente(sala)

    def _pista(self, sala):
        palabra = sala['palabra']
        avance = 1 - restante(sala) / self.TIEMPO
        letras = [i for i, c in enumerate(palabra) if c != ' ']
        mostrar = set()
        rnd = random.Random(palabra)
        rnd.shuffle(letras)
        if avance > 0.5:
            mostrar.add(letras[0])
        if avance > 0.75 and len(letras) > 4:
            mostrar.add(letras[1])
        return ''.join(c if (c == ' ' or i in mostrar) else '_' for i, c in enumerate(palabra))

    def vista(self, sala, pid, args):
        soy = pid == sala['dibujante']
        v = {
            'dibujante': sala['dibujante'], 'soy_dibujante': soy, 'limite': sala['limite'],
            'chat': sala['chat'][-25:], 'acertaron': sala['acertaron'],
            'turno_n': sala['dib_turno'] + 1, 'turnos': len(activos(sala)) * sala['vueltas'], 'tv': sala['trazos_v'],
        }
        if sala['fase'] == 'eligiendo':
            v['opciones'] = sala['opciones'] if soy else None
        elif sala['fase'] == 'dibujando':
            v['palabra'] = sala['palabra'] if (soy or pid in sala['acertaron']) else self._pista(sala)
            v['largo'] = len(sala['palabra'])
        elif sala['fase'] in ('revelar', 'final'):
            v['palabra'] = sala['palabra']
        if args.get('tv', type=int) != sala['trazos_v']:
            v['trazos'] = sala['trazos']
        return v

    def accion(self, sala, pid, accion, datos, es_host):
        if accion == 'iniciar':
            error = self.puede_iniciar(sala, es_host)
            if error:
                return error
            reiniciar_puntos(sala)
            sala.update(dib_turno=-1, chat=[], usadas=[], vueltas=2 if len(sala['jugadores']) <= 3 else 1)
            self._mensaje(sala, '¡Empieza el juego! ✏️')
            self._siguiente(sala)
        elif accion == 'lobby' and es_host:
            sala['fase'] = 'lobby'
        elif accion == 'elegir' and pid == sala['dibujante'] and sala['fase'] == 'eligiendo':
            i = datos.get('i')
            if i in (0, 1, 2):
                self._elegir(sala, i)
        elif accion in ('trazo', 'borrar', 'deshacer') and pid == sala['dibujante'] and sala['fase'] == 'dibujando':
            if accion == 'borrar':
                sala['trazos'] = []
            elif accion == 'deshacer':
                if sala['trazos']:
                    sala['trazos'].pop()
            else:
                puntos = [[round(float(x), 3), round(float(y), 3)] for x, y in (datos.get('puntos') or [])[:400]]
                total = sum(len(t['p']) for t in sala['trazos'])
                if total + len(puntos) > 25000:
                    return {'error': 'El dibujo está muy lleno'}
                existente = next((t for t in sala['trazos'][-5:] if t['id'] == datos.get('id')), None)
                if existente:
                    existente['p'].extend(puntos)
                else:
                    sala['trazos'].append({'id': datos.get('id'), 'c': str(datos.get('color', '#222'))[:9],
                                           'g': max(1, min(40, int(datos.get('grosor', 6)))), 'p': puntos})
            sala['trazos_v'] += 1
        elif accion == 'adivinar' and sala['fase'] == 'dibujando' and pid != sala['dibujante'] and pid not in sala['acertaron']:
            texto = (datos.get('texto') or '').strip()[:40]
            if not texto:
                return None
            intento, correcta = normalizar(texto), normalizar(sala['palabra'])
            if intento == correcta:
                sala['acertaron'].append(pid)
                sumar(sala, pid, 40 + int(60 * restante(sala) / self.TIEMPO))
                sumar(sala, sala['dibujante'], 20)
                self._mensaje(sala, f"✅ {nombre(sala, pid)} adivinó", 'acierto')
                return {'acerto': True}
            if distancia(intento, correcta) <= (1 if len(correcta) <= 5 else 2):
                return {'casi': True}
            self._mensaje(sala, texto, 'intento', nombre(sala, pid))
        return None

    def al_salir(self, sala, pid):
        if pid == sala.get('dibujante') and sala['fase'] in ('eligiendo', 'dibujando'):
            self._terminar_ronda(sala)


# =======================================================
# 🤥 DOS VERDADES Y UNA MENTIRA
# =======================================================
class Verdades(JuegoBase):
    ESCRIBIR = 180
    VOTAR = 35
    REVELAR = 7

    def preparar(self, sala):
        sala.update(frases={}, cola=[], actual=None, permutacion=[0, 1, 2], limite=0, votos={})

    def _siguiente(self, sala):
        cola = [p for p in sala['cola'] if p in sala['jugadores']]
        if not cola:
            sala['fase'] = 'final'
            return
        sala['actual'] = cola.pop(0)
        sala['cola'] = cola
        permutacion = [0, 1, 2]
        random.shuffle(permutacion)
        sala.update(permutacion=permutacion, votos={}, fase='votando', limite=ahora() + self.VOTAR)
        sala['ronda'] += 1

    def _empezar(self, sala):
        sala['cola'] = [p for p in activos(sala) if p in sala['frases']]
        if not sala['cola']:
            sala['fase'] = 'lobby'
            return
        self._siguiente(sala)

    def _mentira_mostrada(self, sala):
        return sala['permutacion'].index(sala['frases'][sala['actual']]['mentira'])

    def _revelar(self, sala):
        if sala['actual'] in sala['frases']:
            mentira = self._mentira_mostrada(sala)
            for votante, opcion in sala['votos'].items():
                if opcion == mentira:
                    sumar(sala, votante, 100)
                else:
                    sumar(sala, sala['actual'], 50)
        sala.update(fase='revelar', limite=ahora() + self.REVELAR)

    def _votantes(self, sala):
        return [p for p in activos(sala) if p != sala['actual']]

    def tick(self, sala):
        f = sala['fase']
        if f == 'escribiendo' and (ahora() > sala['limite'] or all(p in sala['frases'] for p in activos(sala))):
            self._empezar(sala)
        elif f == 'votando':
            if sala['actual'] not in sala['jugadores']:
                return self._siguiente(sala)
            if ahora() > sala['limite'] or all(p in sala['votos'] for p in self._votantes(sala)):
                self._revelar(sala)
        elif f == 'revelar' and ahora() > sala['limite']:
            self._siguiente(sala)

    def vista(self, sala, pid, args):
        v = {'limite': sala['limite'], 'enviaron': [p for p in activos(sala) if p in sala['frases']],
             'ya_envie': pid in sala['frases']}
        if sala['fase'] in ('votando', 'revelar') and sala['actual'] in sala['frases']:
            datos = sala['frases'][sala['actual']]
            v.update(autor=sala['actual'], soy_autor=pid == sala['actual'],
                     frases=[datos['frases'][k] for k in sala['permutacion']],
                     ya_vote=pid in sala['votos'], mi_voto=sala['votos'].get(pid),
                     votaron=list(sala['votos'].keys()), quedan=len(sala['cola']))
            if sala['fase'] == 'revelar':
                v['mentira'] = self._mentira_mostrada(sala)
                v['conteo'] = [list(sala['votos'].values()).count(k) for k in range(3)]
        return v

    def accion(self, sala, pid, accion, datos, es_host):
        if accion == 'iniciar':
            error = self.puede_iniciar(sala, es_host)
            if error:
                return error
            reiniciar_puntos(sala)
            sala.update(frases={}, fase='escribiendo', limite=ahora() + self.ESCRIBIR)
        elif accion == 'lobby' and es_host:
            sala['fase'] = 'lobby'
        elif accion == 'enviar' and sala['fase'] == 'escribiendo':
            frases = [str(f).strip()[:90] for f in (datos.get('frases') or [])][:3]
            mentira = datos.get('mentira')
            if len(frases) != 3 or not all(frases) or mentira not in (0, 1, 2):
                return {'error': 'Escribe las 3 frases y marca cuál es la mentira'}
            sala['frases'][pid] = {'frases': frases, 'mentira': mentira}
        elif accion == 'votar' and sala['fase'] == 'votando' and pid != sala['actual'] and pid not in sala['votos']:
            if datos.get('i') in (0, 1, 2):
                sala['votos'][pid] = datos['i']
        elif accion == 'siguiente' and es_host:
            sala['limite'] = 0
        return None


# =======================================================
# 🧠 TRIVIA RÁPIDA
# =======================================================
# (categoría, pregunta, [correcta, incorrecta, incorrecta, incorrecta])
BANCO_TRIVIA = [
    ("🌎 Geografía", "¿Cuál es el país más grande del mundo?", ["Rusia", "Canadá", "China", "Brasil"]),
    ("🌎 Geografía", "¿Cuál es la capital de Japón?", ["Tokio", "Kioto", "Osaka", "Seúl"]),
    ("🌎 Geografía", "¿En qué continente está Egipto?", ["África", "Asia", "Europa", "Oceanía"]),
    ("🌎 Geografía", "¿Cuál es el río más largo de América?", ["Amazonas", "Misisipi", "Paraná", "Bravo"]),
    ("🌎 Geografía", "¿Cuál es el océano más grande?", ["Pacífico", "Atlántico", "Índico", "Ártico"]),
    ("🌎 Geografía", "¿Cuál es la capital de Argentina?", ["Buenos Aires", "Córdoba", "Rosario", "Montevideo"]),
    ("🌎 Geografía", "¿En qué país está la Torre Eiffel?", ["Francia", "Italia", "Bélgica", "Suiza"]),
    ("🌎 Geografía", "¿Cuántos continentes hay (según la escuela en México)?", ["5", "4", "6", "7"]),
    ("🇲🇽 México", "¿Cuántos estados tiene México?", ["32", "31", "30", "33"]),
    ("🇲🇽 México", "¿Qué animal aparece en la bandera de México?", ["Águila", "Jaguar", "Serpiente sola", "Halcón"]),
    ("🇲🇽 México", "¿En qué estado está Chichén Itzá?", ["Yucatán", "Quintana Roo", "Chiapas", "Campeche"]),
    ("🇲🇽 México", "¿Qué día se celebra la Independencia de México?", ["16 de septiembre", "20 de noviembre", "5 de mayo", "2 de noviembre"]),
    ("🇲🇽 México", "¿De qué estado es el mole poblano?", ["Puebla", "Oaxaca", "Jalisco", "Veracruz"]),
    ("🇲🇽 México", "¿Cuál es el volcán más alto de México?", ["Pico de Orizaba", "Popocatépetl", "Iztaccíhuatl", "Nevado de Toluca"]),
    ("🇲🇽 México", "¿En qué estado nació el tequila?", ["Jalisco", "Michoacán", "Sonora", "Guanajuato"]),
    ("🔬 Ciencia", "¿Qué planeta es conocido como el planeta rojo?", ["Marte", "Venus", "Júpiter", "Saturno"]),
    ("🔬 Ciencia", "¿Cuál es el planeta más grande del sistema solar?", ["Júpiter", "Saturno", "Neptuno", "La Tierra"]),
    ("🔬 Ciencia", "¿Qué gas respiramos para vivir?", ["Oxígeno", "Hidrógeno", "Nitrógeno", "Helio"]),
    ("🔬 Ciencia", "¿Cuántas patas tiene una araña?", ["8", "6", "10", "12"]),
    ("🔬 Ciencia", "¿Cuál es el hueso más largo del cuerpo?", ["Fémur", "Tibia", "Húmero", "Columna"]),
    ("🔬 Ciencia", "¿A qué temperatura hierve el agua (al nivel del mar)?", ["100 °C", "90 °C", "80 °C", "120 °C"]),
    ("🔬 Ciencia", "¿Cuál es el animal terrestre más rápido?", ["Guepardo", "León", "Caballo", "Antílope"]),
    ("🔬 Ciencia", "¿Qué órgano bombea la sangre?", ["Corazón", "Pulmones", "Hígado", "Riñones"]),
    ("🔬 Ciencia", "¿Cuál es el símbolo químico del oro?", ["Au", "Ag", "Or", "Go"]),
    ("🔬 Ciencia", "¿Cuántos dientes tiene un adulto normalmente?", ["32", "28", "30", "36"]),
    ("🔬 Ciencia", "¿Qué estrella está más cerca de la Tierra?", ["El Sol", "Sirio", "Alfa Centauri", "Polaris"]),
    ("🎮 Videojuegos", "¿Cómo se llama el hermano de Mario?", ["Luigi", "Wario", "Toad", "Yoshi"]),
    ("🎮 Videojuegos", "¿De qué color es Sonic?", ["Azul", "Rojo", "Verde", "Amarillo"]),
    ("🎮 Videojuegos", "¿Qué Pokémon es el número 25 de la Pokédex?", ["Pikachu", "Charmander", "Eevee", "Bulbasaur"]),
    ("🎮 Videojuegos", "En Minecraft, ¿qué criatura explota?", ["Creeper", "Enderman", "Zombie", "Esqueleto"]),
    ("🎮 Videojuegos", "¿Cómo se llama la princesa que Mario rescata?", ["Peach", "Zelda", "Daisy", "Rosalina"]),
    ("🎮 Videojuegos", "¿Qué empresa creó PlayStation?", ["Sony", "Nintendo", "Microsoft", "Sega"]),
    ("🎮 Videojuegos", "¿Cómo se llama el héroe de The Legend of Zelda?", ["Link", "Zelda", "Ganon", "Epona"]),
    ("🎮 Videojuegos", "En Fortnite, ¿qué se construye para protegerse?", ["Paredes", "Túneles", "Barcos", "Carros"]),
    ("🎮 Videojuegos", "¿Qué fruta come Pac-Man para comerse a los fantasmas?", ["Ninguna, son pastillas de poder", "Cereza", "Fresa", "Plátano"]),
    ("🎬 Cine y TV", "¿Cómo se llama el muñeco vaquero de Toy Story?", ["Woody", "Buzz", "Jessie", "Andy"]),
    ("🎬 Cine y TV", "¿Qué superhéroe es Peter Parker?", ["Spider-Man", "Iron Man", "Batman", "Superman"]),
    ("🎬 Cine y TV", "¿En qué película aparece Elsa?", ["Frozen", "Moana", "Encanto", "Enredados"]),
    ("🎬 Cine y TV", "¿Cómo se llama el ogro verde de DreamWorks?", ["Shrek", "Fiona", "Burro", "Grinch"]),
    ("🎬 Cine y TV", "¿Qué escuela de magia aparece en Harry Potter?", ["Hogwarts", "Beauxbatons", "Durmstrang", "Narnia"]),
    ("🎬 Cine y TV", "¿Dónde vive Bob Esponja?", ["En una piña", "En una roca", "En un coco", "En un barco"]),
    ("🎬 Cine y TV", "En Coco, ¿qué instrumento toca Miguel?", ["Guitarra", "Violín", "Trompeta", "Piano"]),
    ("🎬 Cine y TV", "¿Cómo se llama la familia de Encanto?", ["Madrigal", "Rivera", "Benítez", "Gutiérrez"]),
    ("⚽ Deportes", "¿Cuántos jugadores tiene un equipo de fútbol en la cancha?", ["11", "10", "9", "12"]),
    ("⚽ Deportes", "¿Cuántos puntos vale un tiro de tres en básquet?", ["3", "2", "4", "1"]),
    ("⚽ Deportes", "¿Cada cuántos años es el Mundial de fútbol?", ["4", "2", "3", "5"]),
    ("⚽ Deportes", "¿En qué deporte se usa un shuttlecock (gallito)?", ["Bádminton", "Tenis", "Squash", "Ping pong"]),
    ("⚽ Deportes", "¿Qué país ha ganado más Mundiales de fútbol?", ["Brasil", "Alemania", "Italia", "Argentina"]),
    ("⚽ Deportes", "¿Cuántos pinos hay en el boliche?", ["10", "9", "12", "8"]),
    ("⚽ Deportes", "¿En qué deporte se hace un 'home run'?", ["Béisbol", "Fútbol americano", "Cricket", "Golf"]),
    ("🍕 Comida", "¿De qué país es originaria la pizza?", ["Italia", "Estados Unidos", "Francia", "Grecia"]),
    ("🍕 Comida", "¿Con qué se hace el guacamole?", ["Aguacate", "Chile verde", "Pepino", "Limón"]),
    ("🍕 Comida", "¿De qué planta sale el chocolate?", ["Cacao", "Café", "Vainilla", "Caña"]),
    ("🍕 Comida", "¿Qué fruta es amarilla y curva?", ["Plátano", "Mango", "Piña", "Limón"]),
    ("🍕 Comida", "¿De qué país es el sushi?", ["Japón", "China", "Corea", "Tailandia"]),
    ("🧠 Cultura", "¿Cuántos días tiene un año bisiesto?", ["366", "365", "364", "367"]),
    ("🧠 Cultura", "¿Cuántos lados tiene un hexágono?", ["6", "5", "7", "8"]),
    ("🧠 Cultura", "¿Quién pintó la Mona Lisa?", ["Leonardo da Vinci", "Picasso", "Frida Kahlo", "Van Gogh"]),
    ("🧠 Cultura", "¿Cuántos minutos tiene una hora?", ["60", "100", "30", "90"]),
    ("🧠 Cultura", "¿Cuál es el idioma más hablado del mundo (nativos)?", ["Chino mandarín", "Inglés", "Español", "Hindi"]),
    ("🧠 Cultura", "¿Cuánto es 7 x 8?", ["56", "54", "48", "64"]),
    ("🧠 Cultura", "¿Qué color se forma al mezclar azul y amarillo?", ["Verde", "Morado", "Naranja", "Café"]),
    ("🧠 Cultura", "¿Cuántas cuerdas tiene una guitarra normal?", ["6", "4", "5", "8"]),
    ("🧠 Cultura", "¿Cuál es el animal más grande del mundo?", ["Ballena azul", "Elefante", "Tiburón ballena", "Jirafa"]),
    ("🧠 Cultura", "¿En qué año llegó el ser humano a la Luna?", ["1969", "1975", "1959", "1981"]),
]


class Trivia(JuegoBase):
    minimo = 1
    PREGUNTA = 15
    REVELAR = 5
    TOTAL = 10

    def preparar(self, sala):
        sala.update(preguntas=[], idx=-1, respuestas={}, rachas={}, ganancias={}, limite=0)

    def _siguiente(self, sala):
        sala['idx'] += 1
        if sala['idx'] >= len(sala['preguntas']):
            sala['fase'] = 'final'
            return
        sala.update(respuestas={}, ganancias={}, fase='pregunta', limite=ahora() + self.PREGUNTA)
        sala['ronda'] += 1

    def _revelar(self, sala):
        correcta = sala['preguntas'][sala['idx']]['correcta']
        for pid in activos(sala):
            r = sala['respuestas'].get(pid)
            if r and r['i'] == correcta:
                racha = sala['rachas'].get(pid, 0)
                puntos = 500 + int(500 * r['quedaba'] / self.PREGUNTA) + 100 * min(racha, 3)
                sala['rachas'][pid] = racha + 1
                sala['ganancias'][pid] = puntos
                sumar(sala, pid, puntos)
            else:
                sala['rachas'][pid] = 0
        sala.update(fase='revelar', limite=ahora() + self.REVELAR)

    def tick(self, sala):
        if sala['fase'] == 'pregunta' and (ahora() > sala['limite'] or all(p in sala['respuestas'] for p in activos(sala))):
            self._revelar(sala)
        elif sala['fase'] == 'revelar' and ahora() > sala['limite']:
            self._siguiente(sala)

    def vista(self, sala, pid, args):
        if sala['fase'] not in ('pregunta', 'revelar'):
            return {}
        p = sala['preguntas'][sala['idx']]
        v = {'n': sala['idx'] + 1, 'total': len(sala['preguntas']), 'categoria': p['categoria'],
             'pregunta': p['pregunta'], 'opciones': p['opciones'], 'limite': sala['limite'],
             'ya_respondi': pid in sala['respuestas'],
             'mi_respuesta': (sala['respuestas'].get(pid) or {}).get('i'),
             'respondieron': list(sala['respuestas'].keys()), 'racha': sala['rachas'].get(pid, 0)}
        if sala['fase'] == 'revelar':
            v['correcta'] = p['correcta']
            v['conteo'] = [sum(1 for r in sala['respuestas'].values() if r['i'] == k) for k in range(4)]
            v['ganancias'] = sala['ganancias']
        return v

    def accion(self, sala, pid, accion, datos, es_host):
        if accion == 'iniciar':
            error = self.puede_iniciar(sala, es_host)
            if error:
                return error
            reiniciar_puntos(sala)
            preguntas = []
            for categoria, pregunta, opciones in random.sample(BANCO_TRIVIA, self.TOTAL):
                orden = list(range(4))
                random.shuffle(orden)
                preguntas.append({'categoria': categoria, 'pregunta': pregunta,
                                  'opciones': [opciones[k] for k in orden], 'correcta': orden.index(0)})
            sala.update(preguntas=preguntas, idx=-1, rachas={})
            self._siguiente(sala)
        elif accion == 'lobby' and es_host:
            sala['fase'] = 'lobby'
        elif accion == 'responder' and sala['fase'] == 'pregunta' and pid not in sala['respuestas']:
            if datos.get('i') in (0, 1, 2, 3):
                sala['respuestas'][pid] = {'i': datos['i'], 'quedaba': restante(sala)}
        return None


# =======================================================
# 😂 COMPLETA LA FRASE
# =======================================================
FRASES = [
    "Lo peor que te puedes encontrar en una hamburguesa: ___",
    "El nuevo sabor de papitas que nadie pidió: ___",
    "Mi superpoder más inútil sería ___",
    "Lo que mi perro piensa cuando me ve: ___",
    "El peor nombre para un restaurante: ___",
    "Si fuera presidente, lo primero que haría es ___",
    "La razón real por la que llegué tarde: ___",
    "Lo que nunca debes decir en una primera cita: ___",
    "El título de mi autobiografía: ___",
    "Lo que diría un gato si pudiera hablar: ___",
    "La peor materia que podrían inventar en la escuela: ___",
    "Mi mamá se enojaría muchísimo si encuentra ___ en mi cuarto",
    "El regalo más raro que me podrían dar: ___",
    "Lo que haría con un millón de pesos en 24 horas: ___",
    "El emoji que mejor me describe es ___ porque ___",
    "Lo que le pondría a un taco para hacerlo épico: ___",
    "El nombre de mi banda de rock: ___",
    "Lo primero que haría si me vuelvo invisible: ___",
    "La peor excusa para no hacer la tarea: ___",
    "Un videojuego que debería existir: ___",
    "El secreto mejor guardado de los maestros: ___",
    "Lo que encontraron los astronautas en la Luna: ___",
    "Si mi vida fuera película, se llamaría ___",
    "La regla más absurda para la casa: ___",
    "Lo que hacen los peces cuando nadie los ve: ___",
    "El peor sabor de helado: ___",
    "Mi plan para sobrevivir un apocalipsis zombie: ___",
    "Lo que diría el Wi-Fi si tuviera sentimientos: ___",
    "El mejor nombre para una mascota: ___",
    "Si los dinosaurios siguieran vivos, ___",
    "La canción que pondría en mi funeral: ___",
    "Lo que pasaría si los perros manejaran: ___",
    "Lo más raro que he visto en el metro: ___",
    "El slogan de mi propia marca de ropa: ___",
    "La profesión del futuro: ___",
    "Lo que le diría a mi yo de hace 5 años: ___",
    "El postre perfecto lleva ___",
    "El peor lugar para quedarse dormido: ___",
    "Si pudiera hablar con un animal, sería ___ y le preguntaría ___",
    "Lo que realmente hay en el Triángulo de las Bermudas: ___",
]


class Frase(JuegoBase):
    ESCRIBIR = 60
    VOTAR = 35
    REVELAR = 8
    RONDAS = 5

    def preparar(self, sala):
        sala.update(frase='', frase_n=0, frases_usadas=[], respuestas={}, lista=[], votos={}, limite=0)

    def _nueva(self, sala):
        sala['frase_n'] += 1
        if sala['frase_n'] > self.RONDAS:
            sala['fase'] = 'final'
            return
        libres = [f for f in FRASES if f not in sala['frases_usadas']] or FRASES
        sala['frase'] = random.choice(libres)
        sala['frases_usadas'].append(sala['frase'])
        sala.update(respuestas={}, votos={}, lista=[], fase='escribiendo', limite=ahora() + self.ESCRIBIR)
        sala['ronda'] += 1

    def _a_votar(self, sala):
        lista = [p for p in sala['respuestas'] if p in sala['jugadores']]
        if len(lista) < 2:
            sala.update(fase='revelar', limite=ahora() + 4, lista=lista)
            return
        random.shuffle(lista)
        sala.update(lista=lista, votos={}, fase='votando', limite=ahora() + self.VOTAR)

    def _revelar(self, sala):
        conteo = {p: 0 for p in sala['lista']}
        for opcion in sala['votos'].values():
            if 0 <= opcion < len(sala['lista']):
                conteo[sala['lista'][opcion]] += 1
        for autor, votos in conteo.items():
            sumar(sala, autor, votos * 100)
        if conteo and max(conteo.values()) > 0:
            mejor = max(conteo.values())
            for autor, votos in conteo.items():
                if votos == mejor:
                    sumar(sala, autor, 50)
        sala.update(fase='revelar', limite=ahora() + self.REVELAR)

    def tick(self, sala):
        f = sala['fase']
        if f == 'escribiendo' and (ahora() > sala['limite'] or all(p in sala['respuestas'] for p in activos(sala))):
            self._a_votar(sala)
        elif f == 'votando':
            votantes = [p for p in activos(sala)
                        if any(autor != p for autor in sala['lista'])]
            if ahora() > sala['limite'] or all(p in sala['votos'] for p in votantes):
                self._revelar(sala)
        elif f == 'revelar' and ahora() > sala['limite']:
            self._nueva(sala)

    def vista(self, sala, pid, args):
        v = {'frase': sala['frase'], 'n': sala['frase_n'], 'total': self.RONDAS, 'limite': sala['limite'],
             'ya_envie': pid in sala['respuestas'], 'enviaron': list(sala['respuestas'].keys())}
        if sala['fase'] in ('votando', 'revelar'):
            v['opciones'] = [sala['respuestas'][p] for p in sala['lista'] if p in sala['respuestas']]
            v['mia'] = sala['lista'].index(pid) if pid in sala['lista'] else None
            v['ya_vote'] = pid in sala['votos']
            v['mi_voto'] = sala['votos'].get(pid)
            v['votaron'] = list(sala['votos'].keys())
        if sala['fase'] == 'revelar':
            v['autores'] = [nombre(sala, p) for p in sala['lista']]
            v['conteo'] = [list(sala['votos'].values()).count(k) for k in range(len(sala['lista']))]
        return v

    def accion(self, sala, pid, accion, datos, es_host):
        if accion == 'iniciar':
            error = self.puede_iniciar(sala, es_host)
            if error:
                return error
            reiniciar_puntos(sala)
            sala.update(frase_n=0, frases_usadas=[])
            self._nueva(sala)
        elif accion == 'lobby' and es_host:
            sala['fase'] = 'lobby'
        elif accion == 'responder' and sala['fase'] == 'escribiendo':
            texto = (datos.get('texto') or '').strip()[:80]
            if texto:
                sala['respuestas'][pid] = texto
        elif accion == 'votar' and sala['fase'] == 'votando' and pid not in sala['votos']:
            i = datos.get('i')
            if isinstance(i, int) and 0 <= i < len(sala['lista']) and sala['lista'][i] != pid:
                sala['votos'][pid] = i
        elif accion == 'siguiente' and es_host:
            sala['limite'] = 0
        return None


# =======================================================
# 🔤 BASTA (STOP)
# =======================================================
CATEGORIAS_BASTA = ["Nombre", "Animal", "Fruta o verdura", "Color", "Cosa", "País o ciudad", "Comida"]
LETRAS_BASTA = "ABCDEFGHIJLMNOPRSTV"


class Basta(JuegoBase):
    CUENTA = 5
    REVELAR = 12
    RONDAS = 3
    MAXIMO = 180

    def preparar(self, sala):
        sala.update(letra='', letras_usadas=[], respuestas={}, basta_por=None, basta_n=0,
                    resultados={}, puntos_ronda={}, limite=0)

    def _nueva(self, sala):
        sala['basta_n'] += 1
        if sala['basta_n'] > self.RONDAS:
            sala['fase'] = 'final'
            return
        libres = [l for l in LETRAS_BASTA if l not in sala['letras_usadas']]
        sala['letra'] = random.choice(libres)
        sala['letras_usadas'].append(sala['letra'])
        sala.update(respuestas={}, basta_por=None, resultados={}, puntos_ronda={},
                    fase='escribiendo', limite=ahora() + self.MAXIMO)
        sala['ronda'] += 1

    def _calificar(self, sala):
        letra = normalizar(sala['letra'])
        resultados = {}
        puntos_ronda = {p: 0 for p in activos(sala)}
        for cat in CATEGORIAS_BASTA:
            respuestas = {p: (sala['respuestas'].get(p) or {}).get(cat, '').strip() for p in activos(sala)}
            normales = {p: normalizar(r) for p, r in respuestas.items()}
            fila = {}
            for p, r in respuestas.items():
                n = normales[p]
                if len(n) < 2 or not n.startswith(letra):
                    puntos = 0
                else:
                    repetida = sum(1 for q, m in normales.items() if q != p and m == n)
                    puntos = 50 if repetida else 100
                fila[p] = [r, puntos]
                puntos_ronda[p] += puntos
            resultados[cat] = fila
        if sala['basta_por'] in puntos_ronda:
            puntos_ronda[sala['basta_por']] += 50
        for p, pts in puntos_ronda.items():
            sumar(sala, p, pts)
        sala.update(resultados=resultados, puntos_ronda=puntos_ronda, fase='revelar', limite=ahora() + self.REVELAR)

    def tick(self, sala):
        f = sala['fase']
        if f in ('escribiendo', 'cuenta') and ahora() > sala['limite']:
            self._calificar(sala)
        elif f == 'revelar' and ahora() > sala['limite']:
            self._nueva(sala)

    def vista(self, sala, pid, args):
        v = {'letra': sala['letra'], 'categorias': CATEGORIAS_BASTA, 'n': sala['basta_n'], 'total': self.RONDAS,
             'limite': sala['limite'], 'mis_respuestas': sala['respuestas'].get(pid, {}),
             'basta_por': nombre(sala, sala['basta_por']) if sala['basta_por'] else None}
        if sala['fase'] == 'revelar':
            v['resultados'] = {cat: [[nombre(sala, p), r, pts] for p, (r, pts) in fila.items()]
                               for cat, fila in sala['resultados'].items()}
            v['puntos_ronda'] = [[nombre(sala, p), pts] for p, pts in sorted(sala['puntos_ronda'].items(), key=lambda x: -x[1])]
        return v

    def accion(self, sala, pid, accion, datos, es_host):
        if accion == 'iniciar':
            error = self.puede_iniciar(sala, es_host)
            if error:
                return error
            reiniciar_puntos(sala)
            sala.update(basta_n=0, letras_usadas=[])
            self._nueva(sala)
        elif accion == 'lobby' and es_host:
            sala['fase'] = 'lobby'
        elif accion == 'respuestas' and sala['fase'] in ('escribiendo', 'cuenta'):
            nuevas = datos.get('respuestas') or {}
            sala['respuestas'][pid] = {c: str(nuevas.get(c, ''))[:30] for c in CATEGORIAS_BASTA}
        elif accion == 'basta' and sala['fase'] == 'escribiendo':
            nuevas = datos.get('respuestas') or {}
            sala['respuestas'][pid] = {c: str(nuevas.get(c, ''))[:30] for c in CATEGORIAS_BASTA}
            if not all(v.strip() for v in sala['respuestas'][pid].values()):
                return {'error': 'Llena todas las categorías antes de gritar ¡BASTA!'}
            sala.update(fase='cuenta', basta_por=pid, limite=ahora() + self.CUENTA)
        elif accion == 'siguiente' and es_host and sala['fase'] == 'revelar':
            sala['limite'] = 0
        return None


# =======================================================
# 🕵️‍♂️ ESPÍA
# =======================================================
LUGARES_ESPIA = {
    "Playa": ["Salvavidas", "Surfista", "Vendedor de cocos", "Turista quemado", "Niño haciendo castillos", "Pescador"],
    "Hospital": ["Doctora", "Enfermero", "Paciente", "Cirujana", "Visitante", "Recepcionista"],
    "Escuela": ["Maestra", "Director", "Alumno", "Conserje", "Prefecto", "Alumna nueva"],
    "Avión": ["Piloto", "Azafata", "Pasajero nervioso", "Bebé llorando", "Copiloto", "Turista"],
    "Restaurante": ["Chef", "Mesero", "Cliente", "Crítico de comida", "Lavaplatos", "Gerente"],
    "Circo": ["Payaso", "Malabarista", "Domador", "Trapecista", "Mago", "Espectador"],
    "Estadio de fútbol": ["Portero", "Árbitro", "Aficionado", "Entrenador", "Vendedor de refrescos", "Comentarista"],
    "Cine": ["Taquillero", "Espectador", "Vendedor de palomitas", "Proyeccionista", "Pareja en cita", "Niño con miedo"],
    "Supermercado": ["Cajera", "Cliente", "Acomodador", "Guardia", "Panadero", "Niño perdido"],
    "Estación espacial": ["Astronauta", "Comandante", "Científica", "Ingeniero", "Alien escondido", "Turista espacial"],
    "Zoológico": ["Veterinaria", "Cuidador", "Visitante", "Fotógrafo", "Niño", "Vendedor de globos"],
    "Barco pirata": ["Capitán", "Grumete", "Cocinero", "Vigía", "Prisionero", "Loro"],
    "Fiesta de cumpleaños": ["Cumpleañero", "Mamá", "Payaso contratado", "Invitado", "Primo latoso", "DJ"],
    "Gimnasio": ["Entrenador", "Fisicoculturista", "Principiante", "Recepcionista", "Influencer", "Señora en caminadora"],
    "Banco": ["Cajero", "Gerente", "Cliente", "Guardia", "Ladrón", "Asesor"],
    "Parque de diversiones": ["Operador de montaña rusa", "Niño", "Vendedor de algodón", "Botarga", "Papá cansado", "Adolescente"],
    "Museo": ["Guía", "Guardia", "Turista", "Restauradora", "Estudiante", "Artista"],
    "Estación de policía": ["Detective", "Policía", "Sospechoso", "Testigo", "Abogada", "Comandante"],
}


class Espia(JuegoBase):
    minimo = 3
    VOTAR = 45

    def preparar(self, sala):
        sala.update(lugar='', roles={}, espia=None, empieza=None, limite=0, minutos=6, resultado=None, votos={})

    def _terminar(self, sala, gano, como, acusado=None):
        espia = sala['espia']
        if gano == 'espia':
            sumar(sala, espia, 300)
        else:
            for p in activos(sala):
                if p != espia:
                    sumar(sala, p, 100)
        sala['resultado'] = {'gano': gano, 'como': como, 'espia': nombre(sala, espia), 'lugar': sala['lugar'],
                             'acusado': nombre(sala, acusado) if acusado else None}
        sala['fase'] = 'resultado'

    def _resolver_votos(self, sala):
        conteo = {}
        for v in sala['votos'].values():
            conteo[v] = conteo.get(v, 0) + 1
        acusado = None
        if conteo:
            mayor = max(conteo.values())
            empatados = [p for p, n in conteo.items() if n == mayor]
            if len(empatados) == 1:
                acusado = empatados[0]
        if acusado == sala['espia']:
            self._terminar(sala, 'grupo', 'votacion', acusado)
        else:
            self._terminar(sala, 'espia', 'votacion', acusado)

    def tick(self, sala):
        if sala['fase'] in ('jugando', 'votando') and sala['espia'] not in sala['jugadores']:
            return self._terminar(sala, 'grupo', 'salio')
        if sala['fase'] == 'jugando' and ahora() > sala['limite']:
            sala.update(fase='votando', votos={}, limite=ahora() + self.VOTAR)
        elif sala['fase'] == 'votando':
            votantes = activos(sala)
            if ahora() > sala['limite'] or all(p in sala['votos'] for p in votantes):
                self._resolver_votos(sala)

    def vista(self, sala, pid, args):
        v = {'minutos': sala['minutos'], 'lugares': sorted(LUGARES_ESPIA.keys())}
        if sala['fase'] in ('jugando', 'votando'):
            soy = pid == sala['espia']
            v.update(soy_espia=soy, lugar=None if soy else sala['lugar'], rol=None if soy else sala['roles'].get(pid),
                     empieza=sala['empieza'], limite=sala['limite'], ya_vote=pid in sala['votos'],
                     mi_voto=sala['votos'].get(pid), votaron=list(sala['votos'].keys()))
        if sala['fase'] == 'resultado':
            v['resultado'] = sala['resultado']
        return v

    def accion(self, sala, pid, accion, datos, es_host):
        if accion == 'iniciar':
            error = self.puede_iniciar(sala, es_host) if sala['fase'] != 'resultado' else (None if es_host else {'error': 'Solo el anfitrión'})
            if error:
                return error
            if len(sala['jugadores']) < self.minimo:
                return {'error': f'Se necesitan al menos {self.minimo} jugadores'}
            if datos.get('minutos') in (4, 6, 8):
                sala['minutos'] = datos['minutos']
            jugadores = activos(sala)
            sala['lugar'] = random.choice(list(LUGARES_ESPIA.keys()))
            roles = LUGARES_ESPIA[sala['lugar']][:]
            random.shuffle(roles)
            sala['espia'] = random.choice(jugadores)
            sala['roles'] = {p: roles[i % len(roles)] for i, p in enumerate(p for p in jugadores if p != sala['espia'])}
            sala.update(empieza=random.choice(jugadores), limite=ahora() + sala['minutos'] * 60,
                        votos={}, resultado=None, fase='jugando')
            sala['ronda'] += 1
        elif accion == 'lobby' and es_host:
            sala['fase'] = 'lobby'
        elif accion == 'a_votar' and es_host and sala['fase'] == 'jugando':
            sala.update(fase='votando', votos={}, limite=ahora() + self.VOTAR)
        elif accion == 'votar' and sala['fase'] == 'votando' and pid not in sala['votos']:
            voto = datos.get('voto')
            if voto in sala['jugadores'] and voto != pid:
                sala['votos'][pid] = voto
        elif accion == 'adivinar' and pid == sala['espia'] and sala['fase'] in ('jugando', 'votando'):
            lugar = datos.get('lugar')
            if lugar == sala['lugar']:
                self._terminar(sala, 'espia', 'adivino')
            else:
                self._terminar(sala, 'grupo', 'fallo')
                sala['resultado']['intento'] = lugar
        return None


JUEGOS_EXTRA.update({
    'dibuja': Dibuja(),
    'verdades': Verdades(),
    'trivia': Trivia(),
    'frase': Frase(),
    'basta': Basta(),
    'espia': Espia(),
})


# ---------------- Páginas ----------------
@fiesta_bp.route('/dibuja')
def dibuja():
    return render_template('dibuja.html')


@fiesta_bp.route('/verdades')
def verdades():
    return render_template('verdades.html')


@fiesta_bp.route('/trivia')
def trivia():
    return render_template('trivia.html')


@fiesta_bp.route('/completa_frase')
def completa_frase():
    return render_template('completa_frase.html')


@fiesta_bp.route('/basta')
def basta():
    return render_template('basta.html')


@fiesta_bp.route('/espia')
def espia():
    return render_template('espia.html')


# 🃏 UNO vive en su propio archivo
import fiesta_uno  # noqa: E402,F401
