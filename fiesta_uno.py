# =======================================================
# 🃏 UNO (de 2 a 10 jugadores, con bots opcionales)
# =======================================================
# Usa las salas de fiesta.py. fiesta_juegos.py importa este archivo al final.

import random

from flask import render_template

from fiesta import fiesta_bp, JUEGOS_EXTRA
from fiesta_juegos import JuegoBase, ahora, activos, nombre

COLORES = ['rojo', 'amarillo', 'verde', 'azul']
ESPECIALES = ['salta', 'reversa', '+2']
MAX_JUGADORES = 10


def _mazo():
    cartas = []
    for color in COLORES:
        cartas.append({'c': color, 'v': '0'})
        for v in [str(n) for n in range(1, 10)] + ESPECIALES:
            cartas += [{'c': color, 'v': v}, {'c': color, 'v': v}]
    for _ in range(4):
        cartas += [{'c': 'negro', 'v': 'comodin'}, {'c': 'negro', 'v': '+4'}]
    for i, carta in enumerate(cartas):
        carta['id'] = i
    random.shuffle(cartas)
    return cartas


def _valor(carta):
    if carta['c'] == 'negro':
        return 50
    if carta['v'] in ESPECIALES:
        return 20
    return int(carta['v'])


def _es_bot(pid):
    return pid.startswith('bot-')


class Uno(JuegoBase):
    TURNO = 30          # segundos para jugar antes de que robe solo
    PAUSA_BOT = 1.3     # lo que "piensa" un bot

    def preparar(self, sala):
        sala.update(uno=None, bots=0)

    # ---------- utilidades ----------
    def _robar(self, u, n=1):
        robadas = []
        for _ in range(n):
            if not u['mazo']:
                # se revuelve la pila (menos la de arriba)
                arriba = u['pila'].pop()
                u['mazo'] = u['pila']
                random.shuffle(u['mazo'])
                u['pila'] = [arriba]
                if not u['mazo']:
                    break
            robadas.append(u['mazo'].pop())
        return robadas

    def _arriba(self, u):
        return u['pila'][-1]

    def _jugable(self, u, carta):
        arriba = self._arriba(u)
        return carta['c'] == 'negro' or carta['c'] == u['color'] or carta['v'] == arriba['v']

    def _actual(self, u):
        return u['orden'][u['turno']]

    def _siguiente(self, u, saltos=1):
        n = len(u['orden'])
        u['turno'] = (u['turno'] + u['sentido'] * saltos) % n
        u['robo'] = None
        u['inicio_turno'] = ahora()
        u['limite'] = ahora() + self.TURNO

    def _log(self, u, texto):
        u['log'] = ([texto] + u['log'])[:4]

    # ---------- partida ----------
    def _repartir(self, sala):
        jugadores = activos(sala)
        random.shuffle(jugadores)
        u = {'mazo': _mazo(), 'pila': [], 'manos': {}, 'orden': jugadores, 'turno': 0, 'sentido': 1,
             'color': '', 'robo': None, 'dijo_uno': [], 'log': [], 'ganador': None,
             'inicio_turno': ahora(), 'limite': ahora() + self.TURNO}
        for p in jugadores:
            u['manos'][p] = self._robar(u, 7)
        # la primera carta siempre es un número
        while True:
            carta = self._robar(u)[0]
            if carta['v'].isdigit():
                break
            u['mazo'].insert(0, carta)
        u['pila'].append(carta)
        u['color'] = carta['c']
        self._log(u, f"Empieza {nombre(sala, jugadores[0])}")
        sala['uno'] = u
        sala['fase'] = 'jugando'
        sala['ronda'] += 1

    def _jugar(self, sala, pid, carta, color):
        u = sala['uno']
        mano = u['manos'][pid]
        mano.remove(carta)
        u['pila'].append(carta)
        u['ultima_jugada'] = {'pid': pid, 'id': carta['id']}
        u['color'] = color if carta['c'] == 'negro' else carta['c']
        quien = nombre(sala, pid)
        texto = {'salta': '⊘ Salta', 'reversa': '⇄ Reversa', 'comodin': '🌈 Comodín', '+4': '+4', '+2': '+2'}.get(carta['v'], carta['v'])
        self._log(u, f"{quien} tiró {texto}" + (f" ({u['color']})" if carta['c'] == 'negro' else ""))

        if len(mano) == 1:
            if pid in u['dijo_uno']:
                self._log(u, f"📣 ¡{quien} dijo UNO!")
            else:
                mano.extend(self._robar(u, 2))
                self._log(u, f"😬 {quien} no dijo UNO: +2")
        if pid in u['dijo_uno']:
            u['dijo_uno'].remove(pid)

        if not mano:
            return self._terminar(sala, pid)

        n = len(u['orden'])
        if carta['v'] == 'reversa':
            u['sentido'] *= -1
            self._siguiente(u, 2 if n == 2 else 1)
        elif carta['v'] == 'salta':
            self._siguiente(u, 2)
        elif carta['v'] in ('+2', '+4'):
            self._siguiente(u)
            victima = self._actual(u)
            cuantas = int(carta['v'][1])
            u['manos'][victima].extend(self._robar(u, cuantas))
            self._log(u, f"{nombre(sala, victima)} roba {cuantas} y pierde turno")
            self._siguiente(u)
        else:
            self._siguiente(u)

    def _terminar(self, sala, ganador):
        u = sala['uno']
        puntos = sum(_valor(c) for p, mano in u['manos'].items() if p != ganador for c in mano)
        if ganador in sala['jugadores']:
            sala['jugadores'][ganador]['puntos'] += puntos
        u['ganador'] = ganador
        u['puntos_ronda'] = puntos
        self._log(u, f"🏆 ¡{nombre(sala, ganador)} ganó la ronda! +{puntos}")
        sala['fase'] = 'resultado'

    def _robar_turno(self, sala, pid):
        u = sala['uno']
        carta = self._robar(u)
        if not carta:
            return self._siguiente(u)
        u['manos'][pid].extend(carta)
        if self._jugable(u, carta[0]):
            u['robo'] = carta[0]['id']
            u['limite'] = ahora() + 12
        else:
            self._log(u, f"{nombre(sala, pid)} robó y pasó")
            self._siguiente(u)

    # ---------- bots ----------
    def _turno_bot(self, sala, pid):
        u = sala['uno']
        mano = u['manos'][pid]
        if u['robo'] is not None:
            opciones = [c for c in mano if c['id'] == u['robo']]
        else:
            opciones = [c for c in mano if self._jugable(u, c)]
        if not opciones:
            if u['robo'] is not None:
                self._log(u, f"{nombre(sala, pid)} pasó")
                return self._siguiente(u)
            return self._robar_turno(sala, pid)
        siguiente = u['orden'][(u['turno'] + u['sentido']) % len(u['orden'])]
        amenaza = len(u['manos'][siguiente]) <= 2

        def prioridad(c):
            if c['c'] == 'negro':
                return 0 if not amenaza else 3
            if c['v'] in ESPECIALES:
                return 2 if amenaza else 1
            return 1.5
        carta = max(opciones, key=lambda c: (prioridad(c), random.random()))
        cuenta = {col: 0 for col in COLORES}
        for c in mano:
            if c['c'] in cuenta and c is not carta:
                cuenta[c['c']] += 1
        color = max(cuenta, key=lambda k: (cuenta[k], random.random()))
        if len(mano) == 2 and random.random() < 0.9:
            u['dijo_uno'].append(pid)
        self._jugar(sala, pid, carta, color)

    # ---------- motor ----------
    def tick(self, sala):
        u = sala.get('uno')
        if sala['fase'] != 'jugando' or not u:
            return
        # alguien se fue: se saca de la ronda
        idos = [p for p in u['orden'] if p not in sala['jugadores']]
        if idos:
            actual, pos = u['orden'][u['turno']], u['turno']
            u['orden'] = [p for p in u['orden'] if p in sala['jugadores']]
            for p in idos:
                u['manos'].pop(p, None)
            if actual in u['orden']:
                u['turno'] = u['orden'].index(actual)
            elif u['orden']:
                u['turno'] = pos % len(u['orden'])
                u['robo'] = None
                u['inicio_turno'], u['limite'] = ahora(), ahora() + self.TURNO
        if len(u['orden']) < 2:
            if u['orden']:
                return self._terminar(sala, u['orden'][0])
            sala['fase'] = 'lobby'
            return
        actual = self._actual(u)
        if _es_bot(actual):
            if ahora() > u['inicio_turno'] + self.PAUSA_BOT:
                self._turno_bot(sala, actual)
                u['inicio_turno'] = max(u['inicio_turno'], ahora())
        elif ahora() > u['limite']:
            if u['robo'] is not None:
                self._log(u, f"⏰ {nombre(sala, actual)} pasó")
                self._siguiente(u)
            else:
                self._log(u, f"⏰ A {nombre(sala, actual)} se le acabó el tiempo")
                self._robar_turno(sala, actual)
                if u['robo'] is not None:
                    self._siguiente(u)

    def vista(self, sala, pid, args):
        u = sala.get('uno')
        v = {'bots': [p for p in sala['orden'] if _es_bot(p)], 'max_jugadores': MAX_JUGADORES}
        if not u or sala['fase'] == 'lobby':
            return v
        orden_visible = u['orden']
        v.update(
            arriba=self._arriba(u), color=u['color'], turno=self._actual(u), sentido=u['sentido'],
            limite=u['limite'], log=u['log'], mazo=len(u['mazo']), robo=u['robo'] if self._actual(u) == pid else None,
            cuentas=[{'id': p, 'n': len(u['manos'].get(p, []))} for p in orden_visible],
            dije_uno=pid in u['dijo_uno'], ultima_jugada=u.get('ultima_jugada'),
        )
        mano = u['manos'].get(pid)
        if mano is not None:
            orden_color = {c: i for i, c in enumerate(COLORES + ['negro'])}
            v['mano'] = sorted(mano, key=lambda c: (orden_color[c['c']], c['v']))
            if self._actual(u) == pid and sala['fase'] == 'jugando':
                v['jugables'] = [c['id'] for c in mano if (u['robo'] is None or c['id'] == u['robo']) and self._jugable(u, c)]
        if sala['fase'] == 'resultado':
            v['ganador_ronda'] = u['ganador']
            v['puntos_ronda'] = u.get('puntos_ronda', 0)
            v['manos_finales'] = [{'id': p, 'cartas': u['manos'].get(p, [])} for p in u['orden'] if p != u['ganador']]
        return v

    def accion(self, sala, pid, accion, datos, es_host):
        u = sala.get('uno')
        if accion == 'agregar_bot' and es_host and sala['fase'] in ('lobby', 'resultado'):
            if len(sala['jugadores']) >= MAX_JUGADORES:
                return {'error': f'Máximo {MAX_JUGADORES} jugadores'}
            sala['bots'] += 1
            bot = f"bot-{sala['bots']}"
            sala['jugadores'][bot] = {'nombre': f"🤖 Bot {sala['bots']}", 'puntos': 0}
            sala['orden'].append(bot)
        elif accion == 'iniciar':
            if not es_host:
                return {'error': 'Solo el anfitrión puede empezar'}
            if sala['fase'] == 'jugando':
                return None
            if len(sala['jugadores']) < 2:
                return {'error': 'Se necesitan al menos 2 jugadores (puedes agregar bots 🤖)'}
            if len(sala['jugadores']) > MAX_JUGADORES:
                return {'error': f'Máximo {MAX_JUGADORES} jugadores'}
            self._repartir(sala)
        elif accion == 'lobby' and es_host:
            sala['fase'] = 'lobby'
        elif not u or sala['fase'] != 'jugando':
            return None
        elif accion == 'uno':
            mano = u['manos'].get(pid, [])
            if len(mano) <= 2 and pid not in u['dijo_uno']:
                u['dijo_uno'].append(pid)
        elif self._actual(u) != pid:
            return {'error': 'No es tu turno'}
        elif accion == 'jugar':
            carta = next((c for c in u['manos'][pid] if c['id'] == datos.get('id')), None)
            if not carta or not self._jugable(u, carta) or (u['robo'] is not None and carta['id'] != u['robo']):
                return {'error': 'Esa carta no se puede tirar'}
            color = datos.get('color')
            if carta['c'] == 'negro' and color not in COLORES:
                return {'error': 'Elige un color'}
            self._jugar(sala, pid, carta, color)
        elif accion == 'robar' and u['robo'] is None:
            self._robar_turno(sala, pid)
        elif accion == 'pasar' and u['robo'] is not None:
            self._log(u, f"{nombre(sala, pid)} pasó")
            self._siguiente(u)
        return None

    def al_salir(self, sala, pid):
        # el anfitrión nunca es un bot; si ya no queda ninguna persona, se van los bots
        humanos = [p for p in sala['orden'] if not _es_bot(p)]
        if not humanos:
            for p in list(sala['orden']):
                sala['jugadores'].pop(p, None)
            sala['orden'].clear()
        elif _es_bot(sala['host']):
            sala['host'] = humanos[0]


JUEGOS_EXTRA['uno'] = Uno()


@fiesta_bp.route('/uno')
def uno():
    return render_template('uno.html')
