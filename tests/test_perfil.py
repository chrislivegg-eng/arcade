"""Premios persistentes, pertenencia a salas y guardado de perfiles."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import app
import perfil
import fiesta
import fiesta_uno


class PerfilTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = Path(self.folder.name) / 'perfiles.json'
        self.mock = patch.object(perfil, 'ARCHIVO_PERFILES', str(self.path))
        self.mock.start()
        self.client = app.test_client()
        fiesta.salas_fiesta.clear()

    def tearDown(self):
        self.mock.stop()
        self.folder.cleanup()

    def start(self, game='wordle', **extra):
        r = self.client.post('/api/perfil/iniciar', json={
            'pid': 'p0', 'juego': game, 'modo': 'solo', **extra})
        self.assertEqual(r.status_code, 200)
        return r.json['partida']

    def event(self, token, game='wordle', event='fin', **data):
        return self.client.post('/api/perfil/evento', json={
            'pid': 'p0', 'juego': game, 'tipo': event, 'evento': 'evento-1',
            'partida': token, 'datos': data})

    def test_finish_is_persistent_and_one_per_game(self):
        token = self.start()
        r = self.event(token, gano=True, intentos=1)
        self.assertGreater(r.json['ganadas'], 0)
        for event_id in ['evento-1', 'otro-id']:
            r = self.client.post('/api/perfil/evento', json={
                'pid': 'p0', 'juego': 'wordle', 'tipo': 'fin', 'evento': event_id,
                'partida': token, 'datos': {'gano': True}})
            self.assertEqual(r.json['ganadas'], 0)
        # Otro cliente del servidor vuelve a leer el mismo estado de disco.
        p = self.client.get('/api/perfil?pid=p0').json
        self.assertEqual(p['stats']['partidas'], 1)
        self.assertEqual(self.event(token, game='sudoku').status_code, 400)
        self.assertEqual(self.event('inventada').status_code, 400)

    def test_stat_retry_and_validation(self):
        token = self.start('basquet', modo='bot', dificultad='normal')
        self.assertEqual(self.event(token, 'basquet', 'canasta', n=3).status_code, 200)
        self.event(token, 'basquet', 'canasta', n=3)
        self.assertEqual(self.client.get('/api/perfil?pid=p0').json['stats']['canastas'], 3)
        token2 = self.start('basquet')
        for bad in [-3, 'muchas', {}, True]:
            self.assertEqual(self.event(token2, 'basquet', 'canasta', n=bad).status_code, 400)
        self.assertEqual(self.event(token2, 'basquet', 'zombi', n=1).status_code, 400)

    def test_mode_and_difficulty_belong_to_started_game(self):
        token = self.start('penales', modo='bot', dificultad='facil')
        self.event(token, 'penales', gano=True, modo='online', dificultad='pro')
        p = self.client.get('/api/perfil?pid=p0').json
        self.assertNotIn('online_1', p['logros'])
        self.assertNotIn('bot_pro', p['logros'])

    def test_uno_result_is_authoritative_and_reload_safe(self):
        code = self.client.post('/api/fiesta/crear', json={
            'juego': 'uno', 'pid': 'p0', 'nombre': 'Ana'}).json['codigo']
        self.client.post('/api/fiesta/unirse', json={'codigo': code, 'pid': 'p1', 'nombre': 'Luis'})
        sala = fiesta.salas_fiesta[code]
        uno = fiesta.JUEGOS_EXTRA['uno']
        uno._repartir(sala)
        payload = {'pid': 'p0', 'juego': 'uno', 'tipo': 'fin', 'codigo': code,
                   'ronda': sala['ronda'], 'datos': {'gano': True}}
        self.assertEqual(self.client.post('/api/perfil/evento', json=payload).status_code, 400)
        uno._terminar(sala, 'p1')
        response = self.client.post('/api/perfil/evento', json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('uno', self.client.get('/api/perfil?pid=p0').json['logros'])
        self.assertEqual(self.client.post('/api/perfil/evento', json=payload).json['ganadas'], 0)
        payload['pid'] = 'intruso'
        self.assertEqual(self.client.post('/api/perfil/evento', json=payload).status_code, 400)

    def test_utf8_purchases_and_failed_purchase_are_atomic(self):
        self.client.get('/api/perfil?pid=p0&nombre=Ni%C3%B1a')
        r = self.client.post('/api/perfil', json={'pid': 'p0', 'avatar': '🐯', 'marco': 'oro'})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.client.get('/api/perfil?pid=p0').json['monedas'], 50)
        r = self.client.post('/api/perfil', json={'pid': 'p0', 'avatar': '🐯'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json['monedas'], 0)
        self.assertEqual(self.client.post('/api/perfil', json={'pid': 'p0', 'avatar': '🐯'}).json['monedas'], 0)
        self.assertIn('🐯', self.path.read_text(encoding='utf-8'))
        self.assertEqual(self.client.get('/api/records_generales').status_code, 200)

    def test_bad_json_and_corrupted_data(self):
        for url in ['/api/perfil', '/api/perfil/iniciar', '/api/perfil/evento']:
            self.assertEqual(self.client.post(url, json=[]).status_code, 400)
        self.path.write_text('{broken', encoding='utf-8')
        with self.assertRaises(RuntimeError):
            perfil._leer()
        self.assertEqual(self.path.read_text(encoding='utf-8'), '{broken')


if __name__ == '__main__':
    unittest.main()
