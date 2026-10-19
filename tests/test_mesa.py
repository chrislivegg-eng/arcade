"""Juegos de sala nuevos: Papa Caliente, Blackjack, Póker, Lotería y Dominó."""
import random
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import app
import fiesta
import fiesta_mesa
import perfil


class MesaTest(unittest.TestCase):
    def setUp(self):
        app.testing = True
        self.client = app.test_client()
        fiesta.salas_fiesta.clear()
        self.reloj = [1000.0]
        self.mock = patch.object(fiesta_mesa, 'ahora', lambda: self.reloj[0])
        self.mock.start()
        random.seed(7)

    def tearDown(self):
        self.mock.stop()

    def post(self, url, **data):
        r = self.client.post(url, json=data)
        self.assertLess(r.status_code, 500)
        return r.get_json()

    def sala(self, juego, bots=2, humanos=1):
        codigo = self.post('/api/fiesta/crear', juego=juego, pid='p0', nombre='Ana')['codigo']
        for i in range(1, humanos):
            self.post('/api/fiesta/unirse', codigo=codigo, juego=juego, pid=f'p{i}', nombre=f'J{i}')
        for _ in range(bots):
            self.assertNotIn('error', self.accion(codigo, 'agregar_bot'))
        return codigo, fiesta.salas_fiesta[codigo]

    def accion(self, codigo, accion, pid='p0', **datos):
        return self.post('/api/fiesta/accion', codigo=codigo, pid=pid, accion=accion, **datos)

    def vista(self, codigo, pid='p0'):
        r = self.client.get(f'/api/fiesta/estado/{codigo}?pid={pid}')
        self.assertEqual(r.status_code, 200)
        return r.get_json()

    def avanzar(self, codigo, jugar, pasos=3000, paso=0.7):
        for _ in range(pasos):
            self.reloj[0] += paso
            v = self.vista(codigo)
            if v['fase'] == 'resultado':
                return v
            jugar(v)
        self.fail('La partida no terminó')

    def test_papa_caliente_solo_el_que_la_tiene_la_pasa_y_hay_ganador(self):
        codigo, sala = self.sala('papa', bots=3, humanos=2)
        self.accion(codigo, 'iniciar', vidas=1)
        v = self.vista(codigo)
        otro = 'p1' if v['tiene'] == 'p0' else 'p0'
        self.assertIn('error', self.accion(codigo, 'pasar', pid=otro, a=v['tiene']))
        self.assertNotIn('restante', v)  # nadie sabe cuándo explota

        def jugar(v):
            for pid in ('p0', 'p1'):
                if v.get('tiene') == pid and v['fase'] == 'jugando':
                    destino = next(p for p in v['vivos'] if p != pid)
                    self.accion(codigo, 'pasar', pid=pid, a=destino)
        final = self.avanzar(codigo, jugar)
        self.assertIn(final['ganador_ronda'], [p['id'] for p in final['jugadores']])

    def test_blackjack_paga_bien_y_conserva_turnos(self):
        codigo, sala = self.sala('blackjack', bots=2)
        self.accion(codigo, 'iniciar')
        self.assertEqual(sala['jugadores']['p0']['puntos'], 1000)
        self.accion(codigo, 'apostar', cantidad=100)
        self.assertEqual(sala['jugadores']['p0']['puntos'], 900)

        def jugar(v):
            if v['fase'] == 'jugando' and v.get('turno') == 'p0':
                self.accion(codigo, 'plantarse')
        final = self.avanzar(codigo, jugar)
        mano = next(m for m in final['manos'] if m['id'] == 'p0')
        self.assertIn(mano['pago'], (0, 100, 200, 250))
        self.assertEqual(sala['jugadores']['p0']['puntos'], 900 + mano['pago'])
        self.assertEqual(fiesta_mesa.valor_bj([{'v': 'A'}, {'v': 'K'}]), 21)
        self.assertEqual(fiesta_mesa.valor_bj([{'v': 'A'}, {'v': 'A'}, {'v': '9'}]), 21)

    def test_poker_conserva_fichas_y_evalua_manos(self):
        c = lambda t: [{'v': x[:-1], 'p': x[-1]} for x in t.split()]
        self.assertEqual(fiesta_mesa.mejor_mano(c('A♠ K♠ Q♠ J♠ 10♠ 2♥ 3♦'))[0], 8)
        self.assertEqual(fiesta_mesa.mejor_mano(c('A♠ 2♥ 3♦ 4♣ 5♠ 9♥ K♦')), (4, 5))
        self.assertEqual(fiesta_mesa.mejor_mano(c('K♠ K♥ 4♦ 4♣ 9♠ 9♥ 2♦')), (2, 13, 9, 4))
        for ronda in range(15):
            fiesta.salas_fiesta.clear()
            codigo, sala = self.sala('poker', bots=random.randint(1, 4))
            self.accion(codigo, 'iniciar')
            total = sum(j['puntos'] for j in sala['jugadores'].values()) + sum(sala['pk']['aporte'].values())
            ajeno = next(j for j in self.vista(codigo)['jugadores_mano'] if j['id'] != 'p0')
            self.assertIsNone(ajeno['cartas'])  # no se ven las cartas ajenas

            def jugar(v):
                if v['fase'] == 'jugando' and v.get('turno') == 'p0':
                    jugada = random.choice(['igualar', 'pasar', 'retirarse', 'todo'])
                    r = self.accion(codigo, jugada)
                    if r.get('error'):
                        self.accion(codigo, 'igualar' if v['debo'] else 'pasar')
            self.avanzar(codigo, jugar)
            self.assertEqual(sum(j['puntos'] for j in sala['jugadores'].values()), total)

    def test_loteria_rechaza_gritos_falsos_y_gana_un_bot(self):
        codigo, sala = self.sala('loteria', bots=2)
        self.accion(codigo, 'iniciar', intervalo=3, modo='linea')
        r = self.accion(codigo, 'loteria')
        self.assertIn('error', r)
        self.assertIn('error', self.accion(codigo, 'loteria'))  # castigado
        final = self.avanzar(codigo, lambda v: None, paso=1.5)
        self.assertTrue(final['ganador_ronda'] is None or final['ganador_ronda'].startswith('bot-'))

    def test_domino_conserva_fichas_y_valida_jugadas(self):
        codigo, sala = self.sala('domino', bots=2)
        self.accion(codigo, 'iniciar')

        def jugar(v):
            e = sala['dom']
            total = len(e['mesa']) + len(e['pozo']) + sum(len(m) for m in e['manos'].values())
            self.assertEqual(total, 28)
            for a, b in zip(e['mesa'], e['mesa'][1:]):
                self.assertEqual(a['n'][1], b['n'][0])
            if v['fase'] == 'jugando' and v.get('turno') == 'p0':
                if v['jugables']:
                    ficha, lado = v['jugables'][0]
                    self.assertNotIn('error', self.accion(codigo, 'jugar', id=ficha, lado=lado))
                else:
                    self.accion(codigo, 'robar')
        final = self.avanzar(codigo, jugar)
        self.assertIn('ganador_ronda', final)

    def test_blackjack_conserva_turno_si_sale_un_asiento_anterior(self):
        for salida in ('p0', 'p1', 'p2'):
            with self.subTest(salida=salida):
                fiesta.salas_fiesta.clear()
                codigo, sala = self.sala('blackjack', bots=0, humanos=3)
                self.accion(codigo, 'iniciar')
                for p in ('p0', 'p1', 'p2'):
                    self.accion(codigo, 'apostar', pid=p, cantidad=10)
                self.vista(codigo)
                e = sala['bj']
                sala['fase'] = 'jugando'
                e['turno'] = 1
                e['manos']['p0']['estado'] = 'plantado'
                for p in ('p1', 'p2'):
                    e['manos'][p]['estado'] = 'jugando'
                fiesta._sacar_jugador(sala, salida)
                consulta = 'p2' if salida == 'p1' else 'p1'
                self.assertEqual(self.vista(codigo, consulta)['turno'], consulta)

    def test_blackjack_salida_del_ultimo_turno_liquida_una_sola_vez(self):
        codigo, sala = self.sala('blackjack', bots=0, humanos=2)
        self.accion(codigo, 'iniciar')
        for p in ('p0', 'p1'):
            self.accion(codigo, 'apostar', pid=p, cantidad=10)
        self.vista(codigo)
        e = sala['bj']
        sala['fase'] = 'jugando'
        e['turno'] = 1
        e['manos']['p0']['estado'] = 'plantado'
        e['manos']['p1']['estado'] = 'jugando'
        fiesta._sacar_jugador(sala, 'p1')
        self.assertEqual(self.vista(codigo)['fase'], 'resultado')
        saldo = sala['jugadores']['p0']['puntos']
        self.vista(codigo)
        self.assertEqual(sala['jugadores']['p0']['puntos'], saldo)

    def test_premio_de_mesa_lo_decide_el_servidor(self):
        carpeta = tempfile.TemporaryDirectory()
        with patch.object(perfil, 'ARCHIVO_PERFILES', str(Path(carpeta.name) / 'perfiles.json')):
            codigo, sala = self.sala('domino', bots=1)
            self.accion(codigo, 'iniciar')
            fiesta_mesa.JUEGOS_EXTRA['domino']._fin(sala, 'bot-1', 'prueba')
            r = self.client.post('/api/perfil/evento', json={'pid': 'p0', 'juego': 'domino', 'tipo': 'fin',
                                                              'codigo': codigo, 'ronda': sala['ronda'], 'datos': {'gano': True}})
            self.assertEqual(r.status_code, 200)
            perfiles = perfil._leer()
            self.assertEqual(perfiles['p0']['stats'].get('victorias', 0), 0)  # el navegador dijo que ganó, pero no
        carpeta.cleanup()


if __name__ == '__main__':
    unittest.main()
