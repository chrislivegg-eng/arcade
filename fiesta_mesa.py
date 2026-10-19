# =======================================================
# 🎲 JUEGOS DE MESA Y FIESTA CON SALAS (y bots opcionales)
# =======================================================
# Papa Caliente · Blackjack · Póker Texas Hold'em · Lotería · Dominó
#
# Usan las salas de fiesta.py igual que UNO. fiesta_juegos.py importa este
# archivo al final, así que no hay que tocar app.py.
# Las fichas de Póker y Blackjack son de mentira (los "puntos" de la sala),
# no tienen nada que ver con las monedas del perfil.

import random
from itertools import combinations

from flask import render_template

from fiesta import fiesta_bp, JUEGOS_EXTRA
from fiesta_juegos import JuegoBase, ahora, activos, nombre


def es_bot(pid):
    return pid.startswith('bot-')


class MesaBase(JuegoBase):
    """Lo que comparten: agregar bots y que el anfitrión siempre sea una persona."""
    maximo = 8
    fichas_iniciales = 0

    def preparar(self, sala):
        sala.update(bots=0)

    def agregar_bot(self, sala):
        if len(sala['jugadores']) >= self.maximo:
            return {'error': f'Máximo {self.maximo} jugadores'}
        sala['bots'] = sala.get('bots', 0) + 1
        bot = f"bot-{sala['bots']}"
        sala['jugadores'][bot] = {'nombre': f"🤖 Bot {sala['bots']}", 'puntos': self.fichas_iniciales}
        sala['orden'].append(bot)
        return None

    def accion_comun(self, sala, accion, es_host):
        """Regresa (manejada, respuesta)."""
        if accion == 'agregar_bot':
            if not es_host or sala['fase'] not in ('lobby', 'resultado', 'final'):
                return True, {'error': 'Solo el anfitrión, entre partidas'}
            return True, self.agregar_bot(sala)
        if accion == 'lobby' and es_host:
            sala['fase'] = 'lobby'
            return True, None
        return False, None

    def puede_empezar(self, sala, es_host):
        if not es_host:
            return {'error': 'Solo el anfitrión puede empezar'}
        if len(sala['jugadores']) < self.minimo:
            return {'error': f'Se necesitan al menos {self.minimo} jugadores (puedes agregar bots 🤖)'}
        if len(sala['jugadores']) > self.maximo:
            return {'error': f'Máximo {self.maximo} jugadores'}
        return None

    def al_salir(self, sala, pid):
        humanos = [p for p in sala['orden'] if not es_bot(p)]
        if not humanos:
            for p in list(sala['orden']):
                sala['jugadores'].pop(p, None)
            sala['orden'].clear()
        elif es_bot(sala['host']):
            sala['host'] = humanos[0]


def _log(estado, texto):
    estado['log'] = ([texto] + estado.get('log', []))[:5]


# =======================================================
# 💣 PAPA CALIENTE
# =======================================================
class PapaCaliente(MesaBase):
    maximo = 12
    PAUSA = 3.5

    def preparar(self, sala):
        super().preparar(sala)
        sala.update(papa=None, vidas_config=2)

    def _nueva_bomba(self, sala):
        e = sala['papa']
        e['tiene'] = random.choice(e['vivos'])
        e['recibio'] = ahora()
        e['explota'] = ahora() + random.uniform(14, 32)
        e['pases'] = 0
        sala['fase'] = 'jugando'
        _log(e, f"💣 La papa empieza con {nombre(sala, e['tiene'])}")

    def tick(self, sala):
        e = sala.get('papa')
        if not e or sala['fase'] not in ('jugando', 'boom'):
            return
        e['vivos'] = [p for p in e['vivos'] if p in sala['jugadores']]
        if sala['fase'] == 'boom':
            if ahora() >= e['siguiente']:
                if len(e['vivos']) <= 1:
                    return self._ganador(sala)
                self._nueva_bomba(sala)
            return
        if len(e['vivos']) <= 1:
            return self._ganador(sala)
        if e['tiene'] not in e['vivos']:
            e['tiene'] = random.choice(e['vivos'])
            e['recibio'] = ahora()
        if ahora() >= e['explota']:
            victima = e['tiene']
            e['vidas'][victima] -= 1
            e['ultima'] = victima
            if e['vidas'][victima] <= 0:
                e['vivos'].remove(victima)
                _log(e, f"💥 ¡Explotó con {nombre(sala, victima)}! Queda fuera")
            else:
                _log(e, f"💥 ¡Explotó con {nombre(sala, victima)}! Le queda {e['vidas'][victima]} ❤️")
            sala['fase'] = 'boom'
            e['siguiente'] = ahora() + self.PAUSA
            return
        # los bots se la pasan rapidito (pero no al instante)
        if es_bot(e['tiene']) and ahora() > e['recibio'] + e.setdefault('espera_bot', random.uniform(1.2, 3.5)):
            otros = [p for p in e['vivos'] if p != e['tiene']]
            self._pasar(sala, e['tiene'], random.choice(otros))

    def _pasar(self, sala, de, a):
        e = sala['papa']
        e['tiene'] = a
        e['recibio'] = ahora()
        e['pases'] += 1
        e.pop('espera_bot', None)
        _log(e, f"{nombre(sala, de)} ➜ {nombre(sala, a)}")

    def gano(self, sala, pid):
        return (sala.get('papa') or {}).get('ganador') == pid

    def _ganador(self, sala):
        e = sala['papa']
        ganador = e['vivos'][0] if e['vivos'] else e.get('ultima')
        e['ganador'] = ganador
        if ganador in sala['jugadores']:
            sala['jugadores'][ganador]['puntos'] += 100
        sala['fase'] = 'resultado'
        _log(e, f"🏆 ¡{nombre(sala, ganador)} sobrevivió!")

    def vista(self, sala, pid, args):
        v = {'bots': [p for p in sala['orden'] if es_bot(p)], 'vidas_config': sala['vidas_config']}
        e = sala.get('papa')
        if not e or sala['fase'] == 'lobby':
            return v
        restante = e['explota'] - ahora()
        # no se dice cuándo explota: solo qué tan nerviosa está la mecha
        v.update(tiene=e['tiene'], vivos=e['vivos'], vidas=e['vidas'], log=e['log'], pases=e['pases'],
                 tension=0 if restante > 12 else 1 if restante > 5 else 2, ultima=e.get('ultima'))
        if sala['fase'] == 'resultado':
            v['ganador_ronda'] = e.get('ganador')
        return v

    def accion(self, sala, pid, accion, datos, es_host):
        hecha, r = self.accion_comun(sala, accion, es_host)
        if hecha:
            return r
        e = sala.get('papa')
        if accion == 'iniciar':
            if sala['fase'] in ('jugando', 'boom'):
                return None
            error = self.puede_empezar(sala, es_host)
            if error:
                return error
            if datos.get('vidas') in (1, 2, 3):
                sala['vidas_config'] = datos['vidas']
            jugadores = activos(sala)
            sala['papa'] = {'vivos': jugadores[:], 'vidas': {p: sala['vidas_config'] for p in jugadores}, 'log': [], 'pases': 0}
            sala['ronda'] += 1
            self._nueva_bomba(sala)
        elif accion == 'pasar' and e and sala['fase'] == 'jugando':
            a = datos.get('a')
            if pid != e['tiene']:
                return {'error': '¡Ya no la tienes!'}
            if a not in e['vivos'] or a == pid:
                return {'error': 'A esa persona no'}
            self._pasar(sala, pid, a)
        return None


# =======================================================
# 🃏 CARTAS (para Blackjack y Póker)
# =======================================================
PALOS = ['♠', '♥', '♦', '♣']
VALORES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']


def baraja(n=1):
    cartas = [{'v': v, 'p': p} for _ in range(n) for p in PALOS for v in VALORES]
    random.shuffle(cartas)
    return cartas


# =======================================================
# 🂡 BLACKJACK
# =======================================================
def valor_bj(cartas):
    total, ases = 0, 0
    for c in cartas:
        if c['v'] == 'A':
            total += 11
            ases += 1
        elif c['v'] in ('J', 'Q', 'K'):
            total += 10
        else:
            total += int(c['v'])
    while total > 21 and ases:
        total -= 10
        ases -= 1
    return total


class Blackjack(MesaBase):
    minimo = 1
    maximo = 7
    fichas_iniciales = 1000
    T_APUESTA = 25
    T_TURNO = 25

    def preparar(self, sala):
        super().preparar(sala)
        sala.update(bj=None, con_fichas=[])

    def _fichas(self, sala):
        for p in activos(sala):
            if p not in sala['con_fichas']:
                sala['con_fichas'].append(p)
                sala['jugadores'][p]['puntos'] = self.fichas_iniciales

    def _repartir_mano(self, sala):
        e = sala['bj']
        if len(e['mazo']) < 60:
            e['mazo'] = baraja(6)
        e['dealer'] = [e['mazo'].pop(), e['mazo'].pop()]
        for p in e['orden']:
            m = e['manos'][p]
            m['cartas'] = [e['mazo'].pop(), e['mazo'].pop()]
            m['estado'] = 'blackjack' if valor_bj(m['cartas']) == 21 else 'jugando'
        e['turno'] = 0
        sala['fase'] = 'jugando'
        self._avanzar(sala)

    def _avanzar(self, sala):
        e = sala['bj']
        while e['turno'] < len(e['orden']) and e['manos'][e['orden'][e['turno']]]['estado'] != 'jugando':
            e['turno'] += 1
        e['limite'] = ahora() + self.T_TURNO
        e['pausa_bot'] = ahora() + random.uniform(1, 2)
        if e['turno'] >= len(e['orden']):
            self._casa(sala)

    def gano(self, sala, pid):
        m = (sala.get('bj') or {}).get('manos', {}).get(pid)
        return bool(m) and (m.get('pago') or 0) > m['apuesta']

    def _casa(self, sala):
        e = sala['bj']
        vivos = [p for p in e['orden'] if e['manos'][p]['estado'] in ('plantado', 'blackjack')]
        if vivos:
            while valor_bj(e['dealer']) < 17:
                e['dealer'].append(e['mazo'].pop())
        casa = valor_bj(e['dealer'])
        casa_bj = casa == 21 and len(e['dealer']) == 2
        for p in e['orden']:
            m = e['manos'][p]
            yo = valor_bj(m['cartas'])
            apuesta = m['apuesta']
            if m['estado'] == 'pasado':
                m['resultado'], pago = 'Te pasaste 💥', 0
            elif m['estado'] == 'blackjack' and not casa_bj:
                m['resultado'], pago = '¡Blackjack! 🎉', apuesta + apuesta * 3 // 2
            elif casa_bj and m['estado'] != 'blackjack':
                m['resultado'], pago = 'La casa tiene Blackjack', 0
            elif casa > 21 or yo > casa:
                m['resultado'], pago = '¡Ganaste! 🏆', apuesta * 2
            elif yo == casa:
                m['resultado'], pago = 'Empate 🤝', apuesta
            else:
                m['resultado'], pago = 'Gana la casa', 0
            m['pago'] = pago
            if p in sala['jugadores']:
                sala['jugadores'][p]['puntos'] += pago
        _log(e, f"🏦 La casa: {casa}" + (" (se pasó)" if casa > 21 else ""))
        sala['fase'] = 'resultado'

    def tick(self, sala):
        e = sala.get('bj')
        if not e:
            return
        orden_anterior = e['orden']
        turno_anterior = e['turno']
        # Conservar la identidad del turno: quitar un asiento anterior no debe saltar a nadie.
        siguientes = orden_anterior[turno_anterior:]
        e['orden'] = [p for p in orden_anterior if p in sala['jugadores']]
        actual = next((p for p in siguientes if p in e['orden']), None)
        e['turno'] = e['orden'].index(actual) if actual is not None else len(e['orden'])
        anterior = orden_anterior[turno_anterior] if turno_anterior < len(orden_anterior) else None
        if sala['fase'] == 'jugando' and anterior != actual:
            self._avanzar(sala)
        if sala['fase'] == 'apuestas':
            for p in e['orden']:
                m = e['manos'][p]
                if m['apuesta'] == 0 and (es_bot(p) or ahora() > e['limite']):
                    self._apostar(sala, p, random.choice([20, 50, 100]) if es_bot(p) else 10)
            if e['orden'] and all(e['manos'][p]['apuesta'] > 0 for p in e['orden']):
                self._repartir_mano(sala)
        elif sala['fase'] == 'jugando':
            if e['turno'] >= len(e['orden']):
                return self._casa(sala)
            p = e['orden'][e['turno']]
            if es_bot(p) and ahora() > e['pausa_bot']:
                total = valor_bj(e['manos'][p]['cartas'])
                visible = valor_bj(e['dealer'][:1])
                self._jugada(sala, p, 'pedir' if total < 12 or (total < 17 and visible >= 7) else 'plantarse')
            elif not es_bot(p) and ahora() > e['limite']:
                self._jugada(sala, p, 'plantarse')

    def _apostar(self, sala, p, cantidad):
        e = sala['bj']
        fichas = sala['jugadores'][p]['puntos']
        if fichas < 10:
            sala['jugadores'][p]['puntos'] = fichas = 500
            _log(e, f"🏦 La casa le prestó 500 a {nombre(sala, p)}")
        cantidad = max(10, min(int(cantidad), fichas))
        e['manos'][p]['apuesta'] = cantidad
        sala['jugadores'][p]['puntos'] -= cantidad

    def _jugada(self, sala, p, accion):
        e = sala['bj']
        m = e['manos'][p]
        if accion == 'pedir':
            m['cartas'].append(e['mazo'].pop())
            if valor_bj(m['cartas']) > 21:
                m['estado'] = 'pasado'
            elif valor_bj(m['cartas']) == 21:
                m['estado'] = 'plantado'
        elif accion == 'doblar':
            if len(m['cartas']) != 2 or sala['jugadores'][p]['puntos'] < m['apuesta']:
                return {'error': 'No puedes doblar'}
            sala['jugadores'][p]['puntos'] -= m['apuesta']
            m['apuesta'] *= 2
            m['cartas'].append(e['mazo'].pop())
            m['estado'] = 'pasado' if valor_bj(m['cartas']) > 21 else 'plantado'
        else:
            m['estado'] = 'plantado'
        if m['estado'] != 'jugando':
            e['turno'] += 1
            self._avanzar(sala)
        else:
            e['limite'] = ahora() + self.T_TURNO
            e['pausa_bot'] = ahora() + random.uniform(0.8, 1.6)
        return None

    def vista(self, sala, pid, args):
        v = {'bots': [p for p in sala['orden'] if es_bot(p)]}
        e = sala.get('bj')
        if not e or sala['fase'] == 'lobby':
            return v
        tapar = sala['fase'] == 'jugando'
        v.update(
            dealer=[e['dealer'][0], {'v': '?', 'p': ''}] if tapar else e.get('dealer', []),
            valor_dealer=valor_bj(e['dealer'][:1]) if tapar else valor_bj(e.get('dealer', [])),
            limite=e['limite'], log=e['log'],
            turno=e['orden'][e['turno']] if sala['fase'] == 'jugando' and e['turno'] < len(e['orden']) else None,
            manos=[{'id': p, 'cartas': e['manos'][p]['cartas'], 'valor': valor_bj(e['manos'][p]['cartas']),
                    'apuesta': e['manos'][p]['apuesta'], 'estado': e['manos'][p]['estado'],
                    'resultado': e['manos'][p].get('resultado'), 'pago': e['manos'][p].get('pago')} for p in e['orden']],
        )
        return v

    def accion(self, sala, pid, accion, datos, es_host):
        hecha, r = self.accion_comun(sala, accion, es_host)
        if hecha:
            if accion == 'agregar_bot':
                self._fichas(sala)
            return r
        e = sala.get('bj')
        if accion == 'iniciar':
            if sala['fase'] in ('apuestas', 'jugando'):
                return None
            error = self.puede_empezar(sala, es_host)
            if error:
                return error
            self._fichas(sala)
            orden = activos(sala)
            sala['bj'] = {'mazo': (e or {}).get('mazo') or baraja(6), 'orden': orden, 'dealer': [], 'turno': 0, 'log': (e or {}).get('log', []),
                          'manos': {p: {'cartas': [], 'apuesta': 0, 'estado': 'apostando'} for p in orden}, 'limite': ahora() + self.T_APUESTA}
            sala['fase'] = 'apuestas'
            sala['ronda'] += 1
        elif not e or pid not in e['manos']:
            return None
        elif accion == 'apostar' and sala['fase'] == 'apuestas' and e['manos'][pid]['apuesta'] == 0:
            try:
                cantidad = int(datos.get('cantidad'))
            except (TypeError, ValueError):
                return {'error': 'Apuesta inválida'}
            self._apostar(sala, pid, cantidad)
        elif accion in ('pedir', 'plantarse', 'doblar') and sala['fase'] == 'jugando':
            if e['turno'] >= len(e['orden']) or e['orden'][e['turno']] != pid:
                return {'error': 'No es tu turno'}
            return self._jugada(sala, pid, accion)
        return None


# =======================================================
# ♠️ PÓKER TEXAS HOLD'EM
# =======================================================
RANGO = {v: i for i, v in enumerate(VALORES, 2)}
NOMBRES_MANO = ['Carta alta', 'Par', 'Doble par', 'Tercia', 'Escalera', 'Color', 'Full', 'Póker', 'Escalera de color']


def evaluar5(cartas):
    rangos = sorted((RANGO[c['v']] for c in cartas), reverse=True)
    color = len({c['p'] for c in cartas}) == 1
    unicos = sorted(set(rangos), reverse=True)
    escalera = None
    if len(unicos) == 5 and unicos[0] - unicos[4] == 4:
        escalera = unicos[0]
    elif unicos == [14, 5, 4, 3, 2]:
        escalera = 5
    cuenta = sorted(((rangos.count(r), r) for r in unicos), reverse=True)
    if escalera and color:
        return (8, escalera)
    if cuenta[0][0] == 4:
        return (7, cuenta[0][1], cuenta[1][1])
    if cuenta[0][0] == 3 and cuenta[1][0] == 2:
        return (6, cuenta[0][1], cuenta[1][1])
    if color:
        return (5, *rangos)
    if escalera:
        return (4, escalera)
    if cuenta[0][0] == 3:
        return (3, cuenta[0][1], *[r for c, r in cuenta[1:]])
    if cuenta[0][0] == 2 and cuenta[1][0] == 2:
        return (2, cuenta[0][1], cuenta[1][1], cuenta[2][1])
    if cuenta[0][0] == 2:
        return (1, cuenta[0][1], *[r for c, r in cuenta[1:]])
    return (0, *rangos)


def mejor_mano(cartas):
    return max(evaluar5(list(c)) for c in combinations(cartas, 5))


class Poker(MesaBase):
    minimo = 2
    maximo = 8
    fichas_iniciales = 1000
    CHICA, GRANDE = 10, 20
    T_TURNO = 30
    T_RESULTADO = 9

    def preparar(self, sala):
        super().preparar(sala)
        sala.update(pk=None, con_fichas=[], boton=-1)

    def _fichas(self, sala):
        for p in activos(sala):
            if p not in sala['con_fichas']:
                sala['con_fichas'].append(p)
                sala['jugadores'][p]['puntos'] = self.fichas_iniciales

    def _nueva_mano(self, sala):
        self._fichas(sala)
        for p in activos(sala):
            if sala['jugadores'][p]['puntos'] <= 0:
                sala['jugadores'][p]['puntos'] = self.fichas_iniciales  # recarga automática
        orden = activos(sala)
        sala['boton'] = (sala['boton'] + 1) % len(orden)
        orden = orden[sala['boton']:] + orden[:sala['boton']]  # el botón al final
        orden = orden[1:] + orden[:1]
        mazo = baraja()
        e = {'mazo': mazo, 'orden': orden, 'mesa': [], 'manos': {p: [mazo.pop(), mazo.pop()] for p in orden},
             'ronda': {p: 0 for p in orden}, 'aporte': {p: 0 for p in orden}, 'fuera': [], 'allin': [],
             'etapa': 'preflop', 'log': (sala.get('pk') or {}).get('log', []), 'ganadores': None}
        sala['pk'] = e
        sala['fase'] = 'jugando'
        sala['ronda'] += 1
        # ciegas: los dos primeros después del botón (con 2 jugadores, el botón pone la chica)
        if len(orden) == 2:
            chica, grande = orden[1], orden[0]
        else:
            chica, grande = orden[0], orden[1]
        self._poner(sala, chica, self.CHICA)
        self._poner(sala, grande, self.GRANDE)
        e['apuesta'] = self.GRANDE
        e['min_subida'] = self.GRANDE
        e['pendientes'] = [p for p in orden if p not in e['allin']]
        # empieza el que sigue de la grande
        i = (orden.index(grande) + 1) % len(orden)
        e['pendientes'] = e['pendientes'][e['pendientes'].index(orden[i]):] + e['pendientes'][:e['pendientes'].index(orden[i])] if orden[i] in e['pendientes'] else e['pendientes']
        self._siguiente_turno(sala)

    def gano(self, sala, pid):
        return ((sala.get('pk') or {}).get('ganancias') or {}).get(pid, 0) > 0

    def _poner(self, sala, p, cantidad):
        e = sala['pk']
        cantidad = min(cantidad, sala['jugadores'][p]['puntos'])
        sala['jugadores'][p]['puntos'] -= cantidad
        e['ronda'][p] += cantidad
        e['aporte'][p] += cantidad
        if sala['jugadores'][p]['puntos'] == 0 and p not in e['allin']:
            e['allin'].append(p)

    def _vivos(self, e):
        return [p for p in e['orden'] if p not in e['fuera']]

    def _siguiente_turno(self, sala):
        e = sala['pk']
        e['pendientes'] = [p for p in e['pendientes'] if p not in e['fuera'] and p not in e['allin'] and p in sala['jugadores']]
        vivos = self._vivos(e)
        if len(vivos) == 1:
            return self._repartir_bote(sala, {vivos[0]: (99,)})
        if not e['pendientes']:
            return self._siguiente_etapa(sala)
        e['turno'] = e['pendientes'][0]
        e['limite'] = ahora() + self.T_TURNO
        e['pausa_bot'] = ahora() + random.uniform(1.0, 2.2)

    def _siguiente_etapa(self, sala):
        e = sala['pk']
        for p in e['ronda']:
            e['ronda'][p] = 0
        e['apuesta'] = 0
        e['min_subida'] = self.GRANDE
        actuan = [p for p in self._vivos(e) if p not in e['allin']]
        if e['etapa'] == 'river' or len(actuan) <= 1:
            # se reparten las que falten y a enseñar cartas
            while len(e['mesa']) < 5:
                e['mesa'].append(e['mazo'].pop())
            return self._enseñar(sala)
        e['etapa'], cartas = {'preflop': ('flop', 3), 'flop': ('turn', 1), 'turn': ('river', 1)}[e['etapa']]
        for _ in range(cartas):
            e['mesa'].append(e['mazo'].pop())
        e['pendientes'] = actuan
        self._siguiente_turno(sala)

    def _enseñar(self, sala):
        e = sala['pk']
        manos = {p: mejor_mano(e['manos'][p] + e['mesa']) for p in self._vivos(e)}
        e['enseñar'] = True
        self._repartir_bote(sala, manos)

    def _repartir_bote(self, sala, manos):
        e = sala['pk']
        # botes laterales: por niveles de lo que aportó cada quien
        aportes = dict(e['aporte'])
        ganancias = {}
        while any(v > 0 for v in aportes.values()):
            nivel = min(v for v in aportes.values() if v > 0)
            participantes = [p for p, v in aportes.items() if v > 0]
            bote = nivel * len(participantes)
            for p in participantes:
                aportes[p] -= nivel
            candidatos = [p for p in participantes if p in manos]
            if not candidatos:
                candidatos = list(manos)
            mejor = max(manos[p] for p in candidatos)
            ganadores = [p for p in candidatos if manos[p] == mejor]
            for i, p in enumerate(ganadores):
                ganancias[p] = ganancias.get(p, 0) + bote // len(ganadores) + (1 if i < bote % len(ganadores) else 0)
        for p, g in ganancias.items():
            if p in sala['jugadores']:
                sala['jugadores'][p]['puntos'] += g
        e['ganancias'] = ganancias
        e['manos_finales'] = {p: NOMBRES_MANO[m[0]] if m[0] < 9 else '' for p, m in manos.items()}
        principal = max(ganancias, key=ganancias.get)
        e['ganador'] = principal
        texto = NOMBRES_MANO[manos[principal][0]] if manos[principal][0] < 9 else 'todos se retiraron'
        _log(e, f"🏆 {nombre(sala, principal)} gana {ganancias[principal]} con {texto}")
        e['siguiente'] = ahora() + self.T_RESULTADO
        sala['fase'] = 'resultado'

    def _jugada(self, sala, p, accion, cantidad=0):
        e = sala['pk']
        fichas = sala['jugadores'][p]['puntos']
        debe = e['apuesta'] - e['ronda'][p]
        if accion == 'retirarse':
            e['fuera'].append(p)
            _log(e, f"{nombre(sala, p)} se retira")
        elif accion == 'pasar':
            if debe > 0:
                return {'error': 'Tienes que igualar o retirarte'}
            _log(e, f"{nombre(sala, p)} pasa")
        elif accion == 'igualar':
            self._poner(sala, p, debe)
            _log(e, f"{nombre(sala, p)} iguala")
        elif accion in ('subir', 'todo'):
            total = fichas + e['ronda'][p] if accion == 'todo' else int(cantidad)
            minimo = e['apuesta'] + e['min_subida']
            if accion == 'subir' and (total < minimo or total - e['ronda'][p] > fichas):
                return {'error': f'La subida mínima es a {minimo}'}
            subida = total - e['apuesta']
            self._poner(sala, p, total - e['ronda'][p])
            if subida > 0:
                if subida >= e['min_subida']:
                    e['min_subida'] = subida
                e['apuesta'] = max(e['apuesta'], e['ronda'][p])
                # todos los demás vuelven a hablar
                orden = e['orden']
                i = orden.index(p)
                e['pendientes'] = [q for q in orden[i + 1:] + orden[:i] if q not in e['fuera'] and q not in e['allin']]
                _log(e, f"{nombre(sala, p)} sube a {e['apuesta']}" + (" (¡todo!)" if p in e['allin'] else ""))
            else:
                _log(e, f"{nombre(sala, p)} va con todo")
        else:
            return {'error': 'Jugada inválida'}
        if p in e['pendientes']:
            e['pendientes'].remove(p)
        self._siguiente_turno(sala)
        return None

    def _bot(self, sala, p):
        e = sala['pk']
        debe = e['apuesta'] - e['ronda'][p]
        fichas = sala['jugadores'][p]['puntos']
        cartas = e['manos'][p]
        if e['mesa']:
            fuerza = mejor_mano(cartas + e['mesa'])[0] / 4 + random.uniform(-0.15, 0.25)
        else:
            a, b = sorted((RANGO[c['v']] for c in cartas), reverse=True)
            fuerza = (0.55 if a == b else 0) + (a + b) / 40 + (0.08 if cartas[0]['p'] == cartas[1]['p'] else 0) + random.uniform(-0.1, 0.15)
        if fuerza > 0.85 and random.random() < 0.6 and fichas > debe:
            return self._jugada(sala, p, 'subir', min(fichas + e['ronda'][p], e['apuesta'] + max(e['min_subida'], self.GRANDE * random.randint(1, 4))))
        if debe == 0:
            return self._jugada(sala, p, 'pasar')
        if fuerza > 0.45 or debe <= self.GRANDE and fuerza > 0.25:
            return self._jugada(sala, p, 'igualar')
        return self._jugada(sala, p, 'retirarse')

    def tick(self, sala):
        e = sala.get('pk')
        if not e:
            return
        if sala['fase'] == 'resultado' and ahora() > e.get('siguiente', 0) and len(activos(sala)) >= 2 and e.get('auto', True):
            return self._nueva_mano(sala)
        if sala['fase'] != 'jugando':
            return
        for p in list(e['orden']):
            if p not in sala['jugadores'] and p not in e['fuera']:
                e['fuera'].append(p)
        if e['turno'] not in sala['jugadores'] or e['turno'] in e['fuera']:
            return self._siguiente_turno(sala)
        if es_bot(e['turno']):
            if ahora() > e['pausa_bot']:
                self._bot(sala, e['turno'])
        elif ahora() > e['limite']:
            debe = e['apuesta'] - e['ronda'][e['turno']]
            self._jugada(sala, e['turno'], 'pasar' if debe == 0 else 'retirarse')

    def vista(self, sala, pid, args):
        v = {'bots': [p for p in sala['orden'] if es_bot(p)], 'ciegas': [self.CHICA, self.GRANDE]}
        e = sala.get('pk')
        if not e or sala['fase'] == 'lobby':
            return v
        enseñar = sala['fase'] == 'resultado' and e.get('enseñar')
        v.update(mesa=e['mesa'], etapa=e['etapa'], log=e['log'], bote=sum(e['aporte'].values()), apuesta=e['apuesta'],
                 min_subida=e['min_subida'], turno=e.get('turno') if sala['fase'] == 'jugando' else None, limite=e.get('limite', 0),
                 jugadores_mano=[{'id': p, 'ronda': e['ronda'][p], 'fuera': p in e['fuera'], 'allin': p in e['allin'],
                                  'cartas': e['manos'][p] if (p == pid or (enseñar and p not in e['fuera'])) else None,
                                  'mano': e.get('manos_finales', {}).get(p) if sala['fase'] == 'resultado' else None,
                                  'gano': e.get('ganancias', {}).get(p)} for p in e['orden']],
                 mis_cartas=e['manos'].get(pid), siguiente=e.get('siguiente'))
        if pid in e['manos'] and pid in sala['jugadores']:
            v['debo'] = e['apuesta'] - e['ronda'][pid]
            v['mis_fichas'] = sala['jugadores'][pid]['puntos']
        if sala['fase'] == 'resultado':
            v['ganador_ronda'] = e.get('ganador')
        return v

    def accion(self, sala, pid, accion, datos, es_host):
        hecha, r = self.accion_comun(sala, accion, es_host)
        if hecha:
            if accion == 'agregar_bot':
                self._fichas(sala)
            return r
        e = sala.get('pk')
        if accion == 'iniciar':
            if sala['fase'] == 'jugando':
                return None
            error = self.puede_empezar(sala, es_host)
            if error:
                return error
            self._nueva_mano(sala)
        elif accion in ('retirarse', 'pasar', 'igualar', 'subir', 'todo') and e and sala['fase'] == 'jugando':
            if e.get('turno') != pid:
                return {'error': 'No es tu turno'}
            try:
                cantidad = int(datos.get('cantidad') or 0)
            except (TypeError, ValueError):
                return {'error': 'Cantidad inválida'}
            return self._jugada(sala, pid, accion, cantidad)
        return None


# =======================================================
# 🎯 LOTERÍA MEXICANA
# =======================================================
CARTAS_LOTERIA = [
    ('El Gallo', '🐓'), ('El Diablito', '😈'), ('La Dama', '👸'), ('El Catrín', '🎩'), ('El Paraguas', '☂️'),
    ('La Sirena', '🧜‍♀️'), ('La Escalera', '🪜'), ('La Botella', '🍾'), ('El Barril', '🛢️'), ('El Árbol', '🌳'),
    ('El Melón', '🍈'), ('El Valiente', '🗡️'), ('El Gorrito', '🧢'), ('La Muerte', '💀'), ('La Pera', '🍐'),
    ('La Bandera', '🇲🇽'), ('El Bandolón', '🎸'), ('El Violoncello', '🎻'), ('La Garza', '🦩'), ('El Pájaro', '🐦'),
    ('La Mano', '✋'), ('La Bota', '👢'), ('La Luna', '🌙'), ('El Cotorro', '🦜'), ('El Borracho', '🥴'),
    ('El Negrito', '🕺'), ('El Corazón', '❤️'), ('La Sandía', '🍉'), ('El Tambor', '🥁'), ('El Camarón', '🦐'),
    ('Las Jaras', '🏹'), ('El Músico', '🎺'), ('La Araña', '🕷️'), ('El Soldado', '💂'), ('La Estrella', '⭐'),
    ('El Cazo', '🍲'), ('El Mundo', '🌎'), ('El Apache', '🪶'), ('El Nopal', '🌵'), ('El Alacrán', '🦂'),
    ('La Rosa', '🌹'), ('La Calavera', '☠️'), ('La Campana', '🔔'), ('El Cantarito', '🏺'), ('El Venado', '🦌'),
    ('El Sol', '☀️'), ('La Corona', '👑'), ('La Chalupa', '🛶'), ('El Pino', '🌲'), ('El Pescado', '🐟'),
    ('La Palma', '🌴'), ('La Maceta', '🪴'), ('El Arpa', '🪕'), ('La Rana', '🐸'),
]
VERSOS = {
    'El Gallo': 'El que le cantó a San Pedro', 'El Diablito': 'Pórtate bien, cuatito', 'La Dama': 'Puliendo el paso',
    'El Catrín': 'Don Ferruco en la alameda', 'La Sirena': 'Con los cantos de sirena', 'La Escalera': 'Súbeme paso a pasito',
    'La Muerte': 'La muerte tilica y flaca', 'La Luna': 'El farol de los enamorados', 'El Corazón': 'No me extrañes, corazón',
    'La Sandía': 'La barriga que todo come', 'El Borracho': 'A qué borracho tan necio', 'La Rana': 'Al ver a la verde rana',
    'El Nopal': 'Al nopal lo van a ver nomás cuando tiene tunas', 'El Sol': 'La cobija de los pobres', 'La Mano': 'La mano de un criminal',
}


class Loteria(MesaBase):
    maximo = 20

    def preparar(self, sala):
        super().preparar(sala)
        sala.update(lot=None, intervalo=5, modo_lot='llena')

    def _tabla(self):
        return random.sample(range(len(CARTAS_LOTERIA)), 16)

    def _completa(self, tabla, cantadas, modo):
        marcadas = [c in cantadas for c in tabla]
        if modo == 'llena':
            return all(marcadas)
        lineas = [range(r * 4, r * 4 + 4) for r in range(4)] + [range(c, 16, 4) for c in range(4)] + [(0, 5, 10, 15), (3, 6, 9, 12)]
        return any(all(marcadas[i] for i in l) for l in lineas) or all(marcadas[i] for i in (0, 3, 12, 15))

    def tick(self, sala):
        e = sala.get('lot')
        if not e or sala['fase'] != 'jugando':
            return
        if ahora() >= e['siguiente'] and e['mazo']:
            e['cantadas'].append(e['mazo'].pop())
            e['siguiente'] = ahora() + sala['intervalo']
        # los bots gritan ¡Lotería! un ratito después de completar
        for p, t in e['tablas'].items():
            if es_bot(p) and p in sala['jugadores'] and self._completa(t, e['cantadas'], sala['modo_lot']):
                e.setdefault('bot_listo', {}).setdefault(p, ahora() + random.uniform(1.5, 4))
                if ahora() > e['bot_listo'][p]:
                    return self._gana(sala, p)
        if not e['mazo'] and ahora() > e['siguiente'] + 10:
            e['ganador'] = None
            sala['fase'] = 'resultado'

    def gano(self, sala, pid):
        return (sala.get('lot') or {}).get('ganador') == pid

    def _gana(self, sala, p):
        e = sala['lot']
        e['ganador'] = p
        sala['jugadores'][p]['puntos'] += 100
        sala['fase'] = 'resultado'

    def vista(self, sala, pid, args):
        v = {'bots': [p for p in sala['orden'] if es_bot(p)], 'intervalo': sala['intervalo'], 'modo_lot': sala['modo_lot'],
             'cartas': CARTAS_LOTERIA}
        e = sala.get('lot')
        if not e or sala['fase'] == 'lobby':
            return v
        actual = e['cantadas'][-1] if e['cantadas'] else None
        v.update(cantadas=e['cantadas'], actual=actual, verso=VERSOS.get(CARTAS_LOTERIA[actual][0]) if actual is not None else None,
                 mi_tabla=e['tablas'].get(pid), siguiente=e['siguiente'], quedan=len(e['mazo']), castigo=e['castigo'].get(pid, 0))
        if sala['fase'] == 'resultado':
            v['ganador_ronda'] = e.get('ganador')
            if e.get('ganador'):
                v['tabla_ganadora'] = e['tablas'][e['ganador']]
        return v

    def accion(self, sala, pid, accion, datos, es_host):
        hecha, r = self.accion_comun(sala, accion, es_host)
        if hecha:
            return r
        e = sala.get('lot')
        if accion == 'iniciar':
            if sala['fase'] == 'jugando':
                return None
            error = self.puede_empezar(sala, es_host)
            if error:
                return error
            if datos.get('intervalo') in (3, 5, 8):
                sala['intervalo'] = datos['intervalo']
            if datos.get('modo') in ('llena', 'linea'):
                sala['modo_lot'] = datos['modo']
            mazo = list(range(len(CARTAS_LOTERIA)))
            random.shuffle(mazo)
            sala['lot'] = {'mazo': mazo, 'cantadas': [], 'tablas': {p: self._tabla() for p in activos(sala)},
                           'siguiente': ahora() + 3, 'castigo': {}}
            sala['fase'] = 'jugando'
            sala['ronda'] += 1
        elif accion == 'loteria' and e and sala['fase'] == 'jugando' and pid in e['tablas']:
            if e['castigo'].get(pid, 0) > ahora():
                return {'error': 'Espera tu castigo ⏳'}
            if self._completa(e['tablas'][pid], e['cantadas'], sala['modo_lot']):
                self._gana(sala, pid)
            else:
                e['castigo'][pid] = ahora() + 10
                return {'error': '¡Todavía no! 😅 Castigo de 10 segundos'}
        return None


# =======================================================
# 🁫 DOMINÓ
# =======================================================
class Domino(MesaBase):
    minimo = 2
    maximo = 4
    T_TURNO = 30

    def preparar(self, sala):
        super().preparar(sala)
        sala.update(dom=None)

    def _jugables(self, e, mano):
        if not e['mesa']:
            return [(f, 'der') for f in mano]
        izq, der = e['puntas']
        r = []
        for f in mano:
            if izq in f['n']:
                r.append((f, 'izq'))
            if der in f['n'] and not (izq == der and izq in f['n']):
                r.append((f, 'der'))
        return r

    def _poner(self, sala, p, ficha, lado):
        e = sala['dom']
        a, b = ficha['n']
        if not e['mesa']:
            e['mesa'].append({'n': [a, b], 'id': ficha['id']})
            e['puntas'] = [a, b]
        elif lado == 'izq':
            punta = e['puntas'][0]
            pieza = [b, a] if b == punta else [a, b]
            pieza = pieza if pieza[1] == punta else pieza[::-1]
            e['mesa'].insert(0, {'n': pieza, 'id': ficha['id']})
            e['puntas'][0] = pieza[0]
        else:
            punta = e['puntas'][1]
            pieza = [a, b] if a == punta else [b, a]
            e['mesa'].append({'n': pieza, 'id': ficha['id']})
            e['puntas'][1] = pieza[1]
        e['manos'][p].remove(ficha)
        e['pasos'] = 0
        _log(e, f"{nombre(sala, p)} puso [{a}|{b}]")
        if not e['manos'][p]:
            return self._fin(sala, p, 'se quedó sin fichas')
        self._siguiente(sala)

    def _siguiente(self, sala):
        e = sala['dom']
        e['turno'] = (e['turno'] + 1) % len(e['orden'])
        e['limite'] = ahora() + self.T_TURNO
        e['pausa_bot'] = ahora() + random.uniform(1, 2)

    def _sin_jugada(self, sala, p):
        e = sala['dom']
        # roba del pozo hasta que pueda (si hay pozo)
        while not self._jugables(e, e['manos'][p]) and e['pozo']:
            e['manos'][p].append(e['pozo'].pop())
            e['robadas'] = e.get('robadas', 0) + 1
        if self._jugables(e, e['manos'][p]):
            _log(e, f"{nombre(sala, p)} robó del pozo")
            return False
        e['pasos'] += 1
        _log(e, f"{nombre(sala, p)} pasa")
        if e['pasos'] >= len(e['orden']):
            # tranque: gana el que tenga menos puntos en la mano
            menor = min(e['orden'], key=lambda q: sum(sum(f['n']) for f in e['manos'][q]))
            return self._fin(sala, menor, 'tranque (menos puntos en la mano)') or True
        self._siguiente(sala)
        return True

    def gano(self, sala, pid):
        return (sala.get('dom') or {}).get('ganador') == pid

    def _fin(self, sala, ganador, como):
        e = sala['dom']
        puntos = sum(sum(f['n']) for q in e['orden'] if q != ganador for f in e['manos'][q])
        if ganador in sala['jugadores']:
            sala['jugadores'][ganador]['puntos'] += puntos
        e['ganador'] = ganador
        e['como'] = como
        e['puntos_ronda'] = puntos
        _log(e, f"🏆 {nombre(sala, ganador)} gana +{puntos} ({como})")
        sala['fase'] = 'resultado'

    def tick(self, sala):
        e = sala.get('dom')
        if not e or sala['fase'] != 'jugando':
            return
        if any(p not in sala['jugadores'] for p in e['orden']):
            presentes = [p for p in e['orden'] if p in sala['jugadores']]
            if len(presentes) < 2:
                return self._fin(sala, presentes[0], 'los demás se fueron') if presentes else None
            actual = e['orden'][e['turno']]
            e['orden'] = presentes
            e['turno'] = e['orden'].index(actual) if actual in presentes else e['turno'] % len(presentes)
        p = e['orden'][e['turno']]
        if es_bot(p):
            if ahora() < e['pausa_bot']:
                return
            opciones = self._jugables(e, e['manos'][p])
            if not opciones:
                if self._sin_jugada(sala, p) is False:
                    e['pausa_bot'] = ahora() + 0.8
                return
            ficha, lado = max(opciones, key=lambda x: (sum(x[0]['n']), x[0]['n'][0] == x[0]['n'][1]))
            self._poner(sala, p, ficha, lado)
        elif ahora() > e['limite']:
            opciones = self._jugables(e, e['manos'][p])
            if opciones:
                self._poner(sala, p, *opciones[0])
            else:
                self._sin_jugada(sala, p)

    def vista(self, sala, pid, args):
        v = {'bots': [p for p in sala['orden'] if es_bot(p)]}
        e = sala.get('dom')
        if not e or sala['fase'] == 'lobby':
            return v
        turno = e['orden'][e['turno']]
        v.update(mesa=e['mesa'], puntas=e.get('puntas'), turno=turno if sala['fase'] == 'jugando' else None, log=e['log'],
                 limite=e['limite'], pozo=len(e['pozo']), cuentas=[{'id': p, 'n': len(e['manos'][p])} for p in e['orden']],
                 mano=e['manos'].get(pid))
        if turno == pid and sala['fase'] == 'jugando':
            v['jugables'] = [[f['id'], lado] for f, lado in self._jugables(e, e['manos'][pid])]
        if sala['fase'] == 'resultado':
            v.update(ganador_ronda=e['ganador'], como=e['como'], puntos_ronda=e['puntos_ronda'],
                     manos_finales=[{'id': p, 'fichas': e['manos'][p]} for p in e['orden']])
        return v

    def accion(self, sala, pid, accion, datos, es_host):
        hecha, r = self.accion_comun(sala, accion, es_host)
        if hecha:
            return r
        e = sala.get('dom')
        if accion == 'iniciar':
            if sala['fase'] == 'jugando':
                return None
            error = self.puede_empezar(sala, es_host)
            if error:
                return error
            fichas = [{'n': [a, b], 'id': a * 7 + b} for a in range(7) for b in range(a, 7)]
            random.shuffle(fichas)
            orden = activos(sala)
            manos = {p: [fichas.pop() for _ in range(7)] for p in orden}
            # empieza quien tenga la mula más alta
            def mula(p):
                mulas = [f['n'][0] for f in manos[p] if f['n'][0] == f['n'][1]]
                return max(mulas) if mulas else -1
            primero = max(orden, key=mula)
            sala['dom'] = {'mesa': [], 'puntas': None, 'manos': manos, 'pozo': fichas if len(orden) < 4 else [],
                           'orden': orden, 'turno': orden.index(primero), 'pasos': 0, 'log': [], 'limite': ahora() + self.T_TURNO,
                           'pausa_bot': ahora() + 1.5}
            _log(sala['dom'], f"Empieza {nombre(sala, primero)}")
            sala['fase'] = 'jugando'
            sala['ronda'] += 1
        elif not e or sala['fase'] != 'jugando' or e['orden'][e['turno']] != pid:
            return {'error': 'No es tu turno'} if accion in ('jugar', 'robar') else None
        elif accion == 'jugar':
            ficha = next((f for f in e['manos'][pid] if f['id'] == datos.get('id')), None)
            lado = datos.get('lado')
            if not ficha or (ficha, lado) not in [(f, l) for f, l in self._jugables(e, e['manos'][pid])]:
                return {'error': 'Esa ficha no cabe ahí'}
            self._poner(sala, pid, ficha, lado)
        elif accion == 'robar':
            if self._jugables(e, e['manos'][pid]):
                return {'error': 'Tienes fichas que sí puedes poner'}
            self._sin_jugada(sala, pid)
        return None


JUEGOS_EXTRA.update({
    'papa': PapaCaliente(),
    'blackjack': Blackjack(),
    'poker': Poker(),
    'loteria': Loteria(),
    'domino': Domino(),
})


@fiesta_bp.route('/papa_caliente')
def papa_caliente():
    return render_template('papa.html')


@fiesta_bp.route('/blackjack')
def blackjack():
    return render_template('blackjack.html')


@fiesta_bp.route('/poker')
def poker():
    return render_template('poker.html')


@fiesta_bp.route('/loteria')
def loteria():
    return render_template('loteria.html')


@fiesta_bp.route('/domino')
def domino():
    return render_template('domino.html')
