import unittest
from unittest.mock import patch
from app import app
import fiesta
from fiesta_mesa import CARTAS_LOTERIA, VERSOS, COLORES_LOTERIA, audios_loteria


class LoteriaTest(unittest.TestCase):
    def setUp(self):
        self.client=app.test_client()
        fiesta.salas_fiesta.clear()
        self.reloj=[1000.0]
        self.mock=patch('fiesta_mesa.ahora',lambda:self.reloj[0]);self.mock.start()
        self.codigo=self.post('/api/fiesta/crear',juego='loteria',pid='a',nombre='Ana')['codigo']
        self.post('/api/fiesta/unirse',juego='loteria',codigo=self.codigo,pid='b',nombre='Beto')
        self.sala=fiesta.salas_fiesta[self.codigo]

    def tearDown(self):
        self.mock.stop()

    def post(self,url,**datos):
        r=self.client.post(url,json=datos)
        self.assertLess(r.status_code,500)
        return r.json

    def accion(self,accion,pid='a',**datos):
        return self.post('/api/fiesta/accion',codigo=self.codigo,pid=pid,accion=accion,**datos)

    def configurar(self,n=3,pid='a'):
        return self.accion('configurar_tablas',pid=pid,cantidad=n,colores=['rosa','azul','verde'])

    def vista(self,pid='a'):
        return self.client.get(f'/api/fiesta/estado/{self.codigo}?pid={pid}').json

    def test_each_player_selects_private_boards_and_colors(self):
        self.configurar(3);self.configurar(2,'b');self.accion('agregar_bot');self.accion('iniciar')
        a,b=self.vista(),self.vista('b')
        self.assertEqual(len(a['mis_tablas']),3);self.assertEqual(len(b['mis_tablas']),2)
        self.assertEqual(a['mis_colores'],['rosa','azul','verde'])
        self.assertEqual(b['mis_colores'],['rosa','azul'])
        self.assertNotIn('tablas',a)
        self.assertEqual(len(self.sala['lot']['tablas_extra']['bot-1']),2)
        for v in [a,b]:
            self.assertEqual(len({frozenset(t) for t in v['mis_tablas']}),len(v['mis_tablas']))
            for t in v['mis_tablas']:
                self.assertEqual(len(t),16);self.assertEqual(len(set(t)),16)

    def test_limits_and_colors_enforced_on_server(self):
        for n in [0,-1,4,True,'3',None]:
            self.assertIn('error',self.configurar(n))
        for colores in [None,[],['rosa']*4,['rosa','azul','<script>'],[{},'azul','verde']]:
            self.assertIn('error',self.accion('configurar_tablas',cantidad=3,colores=colores))
        self.configurar(3);self.accion('iniciar')
        tablas=self.vista()['mis_tablas']
        self.assertIn('error',self.configurar(1))
        self.accion('iniciar')
        self.assertEqual(self.vista()['mis_tablas'],tablas)

    def test_second_or_third_board_can_win_and_snapshot_is_correct(self):
        self.configurar(3);self.accion('iniciar',modo='llena')
        e=self.sala['lot'];tercera=e['tablas_extra']['a'][1]
        e['cantadas']=tercera[:]
        self.assertNotIn('error',self.accion('loteria'))
        v=self.vista()
        self.assertEqual(v['ganador_ronda'],'a')
        self.assertEqual(v['numero_tabla_ganadora'],3)
        self.assertEqual(v['tabla_ganadora'],tercera)
        self.assertEqual(v['color_ganadora'],'verde')
        self.assertEqual(self.sala['jugadores']['a']['puntos'],100)
        self.accion('loteria')
        self.assertEqual(self.sala['jugadores']['a']['puntos'],100)
        self.accion('configurar_tablas',cantidad=1,colores=['rojo','morado','dorado'])
        self.assertEqual(self.vista()['color_ganadora'],'verde')
        self.accion('iniciar');self.assertEqual(len(self.vista()['mis_tablas']),1)
        self.assertEqual(self.vista()['mis_colores'],['rojo'])

    def test_cannot_combine_boards_or_select_foreign_board(self):
        self.configurar(3);self.accion('iniciar',modo='llena')
        e=self.sala['lot'];e['tablas']['a']=list(range(16));e['tablas_extra']['a']=[list(range(16,32)),list(range(32,48))]
        e['cantadas']=list(range(8))+list(range(16,24))+list(range(32,40))
        self.assertIn('error',self.accion('loteria',tabla=4))
        self.assertIn('error',self.accion('loteria',tabla=True))
        self.assertIn('error',self.accion('loteria'))
        self.assertEqual(e['castigo']['a'],1010)
        self.assertEqual(self.sala['fase'],'jugando')

    def test_line_on_second_board_and_bot_third_board(self):
        self.configurar(3);self.accion('iniciar',modo='linea')
        e=self.sala['lot'];e['cantadas']=e['tablas_extra']['a'][0][:4]
        self.assertNotIn('error',self.accion('loteria',tabla=1))
        self.assertEqual(self.vista()['numero_tabla_ganadora'],2)
        self.accion('agregar_bot');self.accion('iniciar',modo='llena')
        e=self.sala['lot'];e['cantadas']=e['tablas_extra']['bot-1'][1][:]
        self.vista();self.reloj[0]+=5;self.vista()
        self.assertEqual(e['ganador'],'bot-1');self.assertEqual(e['indice_ganadora'],2)

    def test_every_card_has_a_funny_phrase_and_only_installed_audio_is_advertised(self):
        self.assertEqual(len(CARTAS_LOTERIA),54)
        self.assertEqual(set(VERSOS),{n for n,_ in CARTAS_LOTERIA})
        for palabra,carta in [('veracruzano','El Camarón'),('primo','El Pescado'),('Caso cerrado','El Cazo'),('diablo anda suelto','El Diablito'),('Pásame la botella','La Botella')]:
            self.assertIn(palabra,VERSOS[carta])
        with patch('fiesta_mesa.Path.is_file',lambda p:p.name=='venado.mp3'):
            self.assertEqual(audios_loteria(),{44:'/static/audio/loteria/venado.mp3'})
