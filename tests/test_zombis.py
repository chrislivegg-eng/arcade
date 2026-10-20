"""Zombies rewards, retries, purchases and account continuity."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from app import app
import perfil
import cuentas


class ZombisTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.patches = [patch.object(perfil, 'ARCHIVO_PERFILES', str(root/'perfiles.json')),
                        patch.object(cuentas, 'ARCHIVO_CUENTAS', str(root/'cuentas.sqlite3'))]
        for p in self.patches:
            p.start()
        self.client = app.test_client()
        self.pid = 'test-z'

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def post(self, route, **data):
        return self.client.post('/api/zombis/'+route, json={'pid': self.pid, **data})

    def start(self):
        return self.client.post('/api/perfil/iniciar', json={'pid':self.pid,'juego':'zombis','modo':'solo'}).json['partida']

    def test_bajas_are_once_and_wave_progress_is_checked(self):
        token = self.start()
        r = self.post('oleada', partida=token, oleada=1)
        self.assertEqual(r.status_code, 200)
        enemies = r.json['enemigos']
        self.assertEqual(len(enemies), 7)
        self.assertEqual(self.post('oleada', partida=token, oleada=1).json['enemigos'], enemies)
        self.assertEqual(self.post('oleada', partida=token, oleada=2).status_code, 409)
        self.assertEqual(self.post('baja', partida=token, enemigo='inventado').status_code, 400)
        for e in enemies:
            r = self.post('baja', partida=token, enemigo=e['id'])
            self.assertEqual(r.json['ganadas'], 3)
            self.assertEqual(self.post('baja', partida=token, enemigo=e['id']).json['ganadas'], 0)
        self.assertEqual(self.client.get('/api/perfil?pid='+self.pid).json['stats']['zombis'], 7)
        self.assertEqual(self.post('oleada', partida=token, oleada=2).status_code, 200)
        self.assertEqual(self.post('baja', partida='otro', enemigo=enemies[0]['id']).status_code, 400)
        self.client.post('/api/perfil/evento', json={'pid':self.pid,'juego':'zombis','partida':token,'tipo':'fin','evento':'fin1','datos':{}})
        self.assertEqual(self.post('oleada', partida=token, oleada=3).status_code, 400)

    def test_purchase_atomic_retry_insufficient_funds_and_bad_input(self):
        self.start()
        first = self.post('arsenal', mejora='danio', nivel=0)
        self.assertEqual(first.json['monedas'],20)
        self.assertEqual(first.json['arma']['danio'],1.4)
        retry = self.post('arsenal', mejora='danio', nivel=0)
        self.assertEqual(retry.status_code,409)
        self.assertEqual(retry.json['monedas'],20)
        self.assertEqual(self.post('arsenal', mejora='danio', nivel=1).status_code,400)
        for value in [[],{},None,True,'incorrecta']:
            self.assertEqual(self.post('arsenal',mejora=value,nivel=0).status_code,400)
        for value in [True,-1,0,201,{},'1']:
            self.assertEqual(self.post('oleada',partida='x',oleada=value).status_code,400)

    def test_account_arsenal_follows_login_and_admin_is_max(self):
        self.client.post('/api/cuenta/registrar',json={'usuario':'ZombieTester','password':'prueba-segura-123','pid':self.pid})
        self.post('arsenal',mejora='cargador',nivel=0)
        other=app.test_client()
        other.post('/api/cuenta/entrar',json={'usuario':'ZombieTester','password':'prueba-segura-123','pid':'device2'})
        self.assertEqual(other.get('/api/zombis/arsenal?pid=device2').json['arma']['cargador'],10)
        self.assertEqual(app.test_client().get('/api/zombis/arsenal?pid=device2').json['arma']['cargador'],8)
        admin=app.test_client(); invitation=cuentas.crear_invitacion('admin@example.com')
        admin.post('/api/cuenta/registrar',json={'usuario':'chris','correo':'admin@example.com','password':'prueba-segura-123','pid':'admin1','invitacion':invitation})
        data=admin.get('/api/zombis/arsenal?pid=admin1').json
        self.assertTrue(data['infinitas'])
        self.assertTrue(all(v==5 for v in data['niveles'].values()))

    def test_mansion_completion_achievement_and_assets(self):
        for url in ['/juego/mansion','/static/js/mansion.js','/static/mansion.css','/static/js/zombis.js']:
            with self.client.get(url) as response:
                self.assertEqual(response.status_code,200)
        token=self.client.post('/api/perfil/iniciar',json={'pid':self.pid,'juego':'mansion','modo':'solo'}).json['partida']
        r=self.client.post('/api/perfil/evento',json={'pid':self.pid,'partida':token,'juego':'mansion','tipo':'fin','evento':'m1','datos':{'gano':True}})
        self.assertEqual(r.status_code,200)
        self.assertIn('mansion',[l['id'] for l in r.json['logros']])
