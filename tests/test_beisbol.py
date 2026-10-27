"""Bateo, recompensas, colección y economía del béisbol."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import app
import beisbol_progreso as beisbol
import duelo
import perfil


class BeisbolTest(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        root=Path(self.folder.name)
        self.patches=[patch.object(perfil,'ARCHIVO_PERFILES',str(root/'perfiles.json')),
                      patch.object(duelo,'_archivo_record',lambda juego:str(root/f'record_{juego}.txt'))]
        for item in self.patches:item.start()
        self.client=app.test_client()

    def tearDown(self):
        for item in self.patches:item.stop()
        self.folder.cleanup()

    def post(self,route,**data):
        return self.client.post('/api/beisbol/'+route,json={'pid':'beisbol-test',**data})

    def test_perfect_hit_rewards_once_and_updates_record(self):
        state=self.client.get('/api/beisbol/estado?pid=beisbol-test').json
        self.assertEqual(state['monedas'],50)
        self.assertEqual(self.client.post('/api/records/beisbol',json={'nombre':'Jugador','puntos':999999}).status_code,403)
        with patch.object(beisbol.time,'time',return_value=1000),patch.object(beisbol.random,'randint',return_value=1500):
            token=self.post('lanzar').json['lanzamiento']
        with patch.object(beisbol.time,'time',return_value=1001.5):
            result=self.post('golpear',lanzamiento=token)
        self.assertEqual(result.status_code,200)
        self.assertTrue(result.json['perfecto'])
        self.assertGreater(result.json['distancia'],1000)
        self.assertGreater(result.json['monedas_ganadas'],0)
        self.assertEqual(result.json['estado']['monedas'],50+result.json['monedas_ganadas'])
        self.assertEqual(self.post('golpear',lanzamiento=token).status_code,409)
        self.assertEqual(self.client.get('/api/beisbol/estado?pid=beisbol-test').json['golpes'],1)
        self.assertEqual(duelo._leer_records('beisbol')['Jugador'],result.json['distancia'])

    def test_shop_requires_coins_ownership_and_expected_level(self):
        self.client.get('/api/beisbol/estado?pid=beisbol-test')
        self.assertEqual(self.post('tienda',accion='equipar',categoria='personajes',item='robot').status_code,400)
        self.assertEqual(self.post('tienda',accion='comprar',categoria='personajes',item='robot').status_code,400)
        upgraded=self.post('tienda',accion='mejorar_bate',categoria='bates',item='madera',nivel=0)
        self.assertEqual(upgraded.status_code,400)
        power=self.post('tienda',accion='mejorar',categoria='fuerza',nivel=0)
        self.assertEqual(power.status_code,200)
        self.assertEqual(power.json['monedas'],0)
        self.assertEqual(self.post('tienda',accion='mejorar',categoria='fuerza',nivel=0).status_code,409)
        self.assertEqual(self.post('tienda',accion='mejorar',categoria='fuerza',nivel=True).status_code,400)

    def test_precise_hit_travels_farther_and_pays_more(self):
        with patch.object(beisbol.random,'randint',return_value=1500):
            with patch.object(beisbol.time,'time',return_value=1000):
                good=self.post('lanzar').json['lanzamiento']
            with patch.object(beisbol.time,'time',return_value=1001.5):
                accurate=self.post('golpear',lanzamiento=good).json
            with patch.object(beisbol.time,'time',return_value=1010):
                late=self.post('lanzar').json['lanzamiento']
            with patch.object(beisbol.time,'time',return_value=1012.5):
                missed=self.post('golpear',lanzamiento=late).json
        self.assertGreater(accurate['distancia'],missed['distancia'])
        self.assertGreater(accurate['monedas_ganadas'],missed['monedas_ganadas'])

    def test_admin_can_equip_all_and_has_max_upgrades(self):
        with patch.object(beisbol,'es_admin',return_value=True):
            state=self.client.get('/api/beisbol/estado?pid=beisbol-test').json
            self.assertTrue(state['infinitas'])
            self.assertTrue(all(item['comprado'] for item in state['catalogo']['pelotas']))
            equipped=self.post('tienda',accion='equipar',categoria='pelotas',item='cohete')
            self.assertEqual(equipped.json['equipado']['pelotas'],'cohete')
            self.assertEqual(equipped.json['mejoras']['fuerza']['nivel'],10)

    def test_collectibles_equip_and_bat_levels_are_independent(self):
        self.client.get('/api/beisbol/estado?pid=beisbol-test')
        with perfil.candado:
            profiles=perfil._leer();profiles['beisbol-test']['monedas']=2000;perfil._guardar(profiles)
        for category,item in [('personajes','felina'),('bates','neon'),('pelotas','cohete')]:
            bought=self.post('tienda',accion='comprar',categoria=category,item=item)
            self.assertEqual(bought.status_code,200)
            equipped=self.post('tienda',accion='equipar',categoria=category,item=item)
            self.assertEqual(equipped.json['equipado'][category],item)
        upgraded=self.post('tienda',accion='mejorar_bate',categoria='bates',item='neon',nivel=0)
        self.assertEqual(upgraded.status_code,200)
        bats={item['id']:item for item in upgraded.json['catalogo']['bates']}
        self.assertEqual(bats['neon']['nivel'],1)
        self.assertEqual(bats['madera']['nivel'],0)
        self.assertEqual(self.post('tienda',accion='mejorar_bate',categoria='bates',item='neon',nivel=0).status_code,409)
        self.assertEqual(upgraded.json['monedas'],2000-120-110-800-60)


if __name__=='__main__':unittest.main()
