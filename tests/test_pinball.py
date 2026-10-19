import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from app import app
import duelo
import perfil


class PinballTest(unittest.TestCase):
    def test_page_and_highest_score(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(duelo, '_archivo_record', return_value=str(Path(tmp)/'record_pinball.txt')):
            c = app.test_client()
            self.assertEqual(c.get('/juego/pinball').status_code, 200)
            for score in (300, 2400, 900):
                self.assertEqual(c.post('/api/records/pinball', json={'nombre': 'NovaQA', 'puntos': score}).status_code, 200)
            self.assertEqual(c.get('/api/records/pinball').json, [{'nombre': 'Novaqa', 'puntos': 2400}])
            self.assertTrue(any(t[0] == 'record_pinball.txt' for t in perfil.TABLAS))

    def test_profile_completion_is_counted_once(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(perfil, 'ARCHIVO_PERFILES', str(Path(tmp)/'perfiles.json')):
            c = app.test_client()
            token = c.post('/api/perfil/iniciar', json={'pid': 'nova-qa', 'juego': 'pinball', 'modo': 'solo'}).json['partida']
            payload = {'pid': 'nova-qa', 'juego': 'pinball', 'tipo': 'fin', 'partida': token, 'evento': 'final', 'datos': {'gano': False}}
            self.assertEqual(c.post('/api/perfil/evento', json=payload).status_code, 200)
            payload['evento'] = 'reintento'
            c.post('/api/perfil/evento', json=payload)
            p = c.get('/api/perfil?pid=nova-qa').json
            self.assertEqual(p['stats']['partidas'], 1)
            self.assertIn('pinball', p['juegos'])

