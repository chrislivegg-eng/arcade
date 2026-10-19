"""Pruebas locales: python -m unittest discover -s tests -v."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import app
import duelo
import dardos
import fiesta
import fiesta_juegos as juegos


class GamesTest(unittest.TestCase):
    def setUp(self):
        app.testing = True
        self.client = app.test_client()
        fiesta.salas_fiesta.clear()
        duelo.salas.clear()
        dardos.salas_dardos.clear()

    def post(self, url, **data):
        response = self.client.post(url, json=data)
        self.assertLess(response.status_code, 500)
        return response.get_json()

    def room(self, game, players=3):
        code = self.post('/api/fiesta/crear', juego=game, pid='p0', nombre='Uno')['codigo']
        for i in range(1, players):
            self.post('/api/fiesta/unirse', codigo=code, juego=game, pid=f'p{i}', nombre=f'Jugador {i}')
        return code, fiesta.salas_fiesta[code]

    def action(self, code, action, pid='p0', **data):
        return self.post('/api/fiesta/accion', codigo=code, pid=pid, accion=action, **data)

    def view(self, code, pid='p0'):
        response = self.client.get(f'/api/fiesta/estado/{code}?pid={pid}')
        self.assertEqual(response.status_code, 200)
        return response.get_json()

    def expire(self, code, room):
        room['limite'] = 0
        return self.view(code)

    def test_new_pages_and_static_assets(self):
        routes = ['/secreto', '/impostor', '/mas_probable', '/verdad_reto', '/dibuja',
                  '/trivia', '/basta', '/espia', '/verdades', '/completa_frase', '/juego_dardos', '/juego_naval']
        routes += ['/juego/' + game for game in duelo.JUEGOS]
        import re
        for url in routes:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                for asset in re.findall(r'(?:src|href)=[\"\'](/static/[^\"\']+)', response.get_data(as_text=True)):
                    with self.client.get(asset) as asset_response:
                        self.assertEqual(asset_response.status_code, 200, asset)

    def test_updater_repairs_original_app_and_is_idempotent(self):
        root = Path(__file__).resolve().parents[1]
        script = (root / 'actualizar.sh').read_text(encoding='utf-8')
        python_code = script.split("python3 - <<'EOF'\n", 1)[1].split('\nEOF', 1)[0]
        old_app = 'from flask import Flask\napp = Flask(__name__)\ndef menu():\n    return dict(records_pixel_art=leer_records(ARCHIVO_PIXEL_ART)\n                victorias_dados=leer_records(ARCHIVO_DADOS))\n'
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'app.py'
            path.write_text(old_app, encoding='utf-8')
            for _ in range(2):
                result = subprocess.run([sys.executable, '-X', 'utf8', '-c', python_code], cwd=tmp, capture_output=True, text=True, encoding='utf-8')
                self.assertEqual(result.returncode, 0, result.stderr)
                updated = path.read_text(encoding='utf-8')
                compile(updated, 'app.py', 'exec')
                for bp in ['fiesta_bp', 'duelo_bp', 'dardos_bp']:
                    self.assertEqual(updated.count('register_blueprint(' + bp + ')'), 1)

    def test_deploy_manifest_keeps_naval_and_every_registered_game(self):
        root = Path(__file__).resolve().parents[1]
        files = [line.strip() for line in (root / 'archivos_nuevos.txt').read_text(encoding='utf-8').splitlines()
                 if line.strip() and not line.startswith('#')]
        self.assertEqual(len(files), len(set(files)))
        for path in files:
            self.assertTrue((root / path).is_file(), path)
        for template in duelo.JUEGOS.values():
            self.assertIn('templates/' + template, files)
        for path in ['templates/juego_naval.html', 'static/naval3d.css', 'static/js/naval3d.js']:
            self.assertIn(path, files)

    def test_duels_all_games(self):
        for game in duelo.JUEGOS:
            code = self.post('/api/duelo/crear', juego=game, pid='a')['codigo']
            self.assertEqual(self.client.get(f'/api/duelo/estado/{code}?pid=x').status_code, 403)
            self.post('/api/duelo/unirse', codigo=code, juego=game, pid='b')
            self.post('/api/duelo/evento', codigo=code, pid='a', tipo='tiro', datos={'partida': 1})
            state = self.client.get(f'/api/duelo/estado/{code}?pid=b&desde=0').get_json()
            self.assertTrue(state['listo'])
            self.assertEqual(state['yo'], 1)
            self.assertEqual(state['eventos'][0]['tipo'], 'tiro')
            self.assertEqual(self.client.get(f'/api/duelo/estado/{code}?pid=b&desde=1').get_json()['eventos'], [])
            self.post('/api/duelo/salir', codigo=code, pid='a')
            self.assertEqual(self.client.get(f'/api/duelo/estado/{code}?pid=b&desde=1').get_json()['eventos'][0]['tipo'], 'salio')

    def test_records_keep_best_and_roundtrip_names(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(duelo, '_archivo_record', side_effect=lambda j: str(Path(tmp) / (j + '.txt'))):
            for game in duelo.JUEGOS:
                url = '/api/records/' + game
                self.post(url, nombre='José', puntos=100)
                self.post(url, nombre='José', puntos=50)
                expected = 50 if game in duelo.RECORD_MENOR else 100
                self.assertEqual(self.client.get(url).get_json(), [{'nombre': 'José', 'puntos': expected}])

    def test_dardos_turn_bust_win_and_rematch(self):
        code = self.post('/api/dardos/crear', pid='a')['codigo']
        self.post('/api/dardos/unirse', codigo=code, pid='b')
        room = dardos.salas_dardos[code]
        room['turno'] = 0
        url = '/api/dardos/lanzar'
        self.assertEqual(self.client.post(url, json=dict(codigo=code, pid='b', x=0, y=0)).status_code, 400)
        self.post(url, codigo=code, pid='a', x=0, y=0)
        self.assertEqual(room['puntos'][0], 251)
        room['puntos'][0] = 10
        self.post(url, codigo=code, pid='a', x=0, y=0)
        self.assertEqual(room['puntos'][0], 301)
        self.assertEqual(room['turno'], 1)
        room['puntos'][1] = 50
        self.post(url, codigo=code, pid='b', x=0, y=0)
        self.assertEqual(room['ganador'], 1)
        self.post('/api/dardos/revancha', codigo=code, pid='a')
        self.assertEqual(room['puntos'], [301, 301])
        self.assertEqual(room['fase'], 'jugando')

    def test_trivia_full_match(self):
        code, room = self.room('trivia')
        self.action(code, 'iniciar')
        for i in range(10):
            self.assertEqual(self.view(code)['fase'], 'pregunta')
            self.assertNotIn('correcta', self.view(code))
            answer = room['preguntas'][i]['correcta']
            for pid in list(room['orden']):
                self.action(code, 'responder', pid=pid, i=answer)
            self.assertEqual(self.view(code)['fase'], 'revelar')
            self.expire(code, room)
        self.assertEqual(self.view(code)['fase'], 'final')
        self.assertTrue(all(j['puntos'] > 0 for j in room['jugadores'].values()))

    def test_dibuja_full_match(self):
        code, room = self.room('dibuja', 2)
        self.action(code, 'iniciar')
        for _ in range(4):
            drawer = room['dibujante']
            guesser = next(p for p in room['orden'] if p != drawer)
            self.assertIsNone(self.view(code, guesser)['opciones'])
            self.action(code, 'elegir', pid=drawer, i=0)
            self.assertNotEqual(self.view(code, guesser)['palabra'], room['palabra'])
            self.action(code, 'trazo', pid=drawer, id='linea', puntos=[[0.1, 0.2], [0.3, 0.4]])
            self.assertEqual(len(self.view(code, guesser)['trazos']), 1)
            self.assertTrue(self.action(code, 'adivinar', pid=guesser, texto=room['palabra'])['acerto'])
            self.assertEqual(self.view(code)['fase'], 'revelar')
            self.expire(code, room)
        self.assertEqual(self.view(code)['fase'], 'final')

    def test_frase_two_players_can_vote(self):
        code, room = self.room('frase', 2)
        self.action(code, 'iniciar')
        for _ in range(5):
            for pid in room['orden']:
                self.action(code, 'responder', pid=pid, texto='Respuesta ' + pid)
            self.assertEqual(self.view(code)['fase'], 'votando')
            for pid in room['orden']:
                self.action(code, 'votar', pid=pid, i=next(i for i,p in enumerate(room['lista']) if p != pid))
            self.assertEqual(self.view(code)['fase'], 'revelar')
            self.expire(code, room)
        self.assertEqual(self.view(code)['fase'], 'final')
        self.assertTrue(all(j['puntos'] > 0 for j in room['jugadores'].values()))

    def test_verdades_full_match(self):
        code, room = self.room('verdades')
        self.action(code, 'iniciar')
        for pid in room['orden']:
            self.action(code, 'enviar', pid=pid, frases=['Una', 'Dos', 'Tres'], mentira=2)
        self.view(code)
        for _ in range(3):
            self.assertEqual(self.view(code)['fase'], 'votando')
            correct = room['permutacion'].index(2)
            for pid in room['orden']:
                if pid != room['actual']:
                    self.action(code, 'votar', pid=pid, i=correct)
            self.assertEqual(self.view(code)['fase'], 'revelar')
            self.expire(code, room)
        self.assertEqual(self.view(code)['fase'], 'final')

    def test_basta_full_match(self):
        code, room = self.room('basta')
        self.action(code, 'iniciar')
        for _ in range(3):
            answers = {cat: room['letra'] + 'respuesta' for cat in juegos.CATEGORIAS_BASTA}
            self.action(code, 'basta', respuestas=answers)
            self.assertEqual(room['fase'], 'cuenta')
            self.expire(code, room)
            self.assertEqual(room['fase'], 'revelar')
            self.expire(code, room)
        self.assertEqual(room['fase'], 'final')

    def test_espia_secrets_voting_and_minimum(self):
        code, room = self.room('espia')
        self.action(code, 'iniciar')
        spy = room['espia']
        self.assertIsNone(self.view(code, spy)['lugar'])
        self.action(code, 'a_votar')
        for pid in room['orden']:
            self.action(code, 'votar', pid=pid, voto=spy if pid != spy else next(p for p in room['orden'] if p != spy))
        self.assertEqual(self.view(code)['resultado']['gano'], 'grupo')
        leaving = next(p for p in room['orden'] if p != 'p0')
        self.action(code, 'salir', pid=leaving)
        self.assertIn('error', self.action(code, 'iniciar'))

    def test_original_party_games(self):
        for game in ['impostor', 'probable']:
            code, room = self.room(game)
            self.action(code, 'iniciar')
            if game == 'impostor':
                self.assertIsNone(self.view(code, room['impostores'][0])['palabra'])
                self.action(code, 'a_votar')
            for pid in room['orden']:
                self.action(code, 'votar', pid=pid, voto=next(p for p in room['orden'] if p != pid))
            self.assertEqual(self.view(code)['fase'], 'resultado')

    def test_impostor_correct_guess_wins_immediately(self):
        for phase in ['jugando', 'votando']:
            with self.subTest(phase=phase):
                code, room = self.room('impostor', 5)
                self.action(code, 'iniciar', num_impostores=2)
                room['palabra'] = 'Avión'
                spy = room['impostores'][0]
                if phase == 'votando':
                    self.action(code, 'a_votar')
                    room['votos']['p0'] = spy
                self.assertTrue(self.action(code, 'adivinar', pid=spy, palabra='  AVION  ')['acerto'])
                for pid in room['orden']:
                    state = self.view(code, pid)
                    self.assertEqual(state['fase'], 'resultado')
                    self.assertEqual(state['resultado']['motivo'], 'palabra')
                    self.assertEqual(state['resultado']['palabra'], 'Avión')
                    self.assertFalse(state['resultado']['atrapado'])
                    expected = 2 if pid in room['impostores'] else 0
                    self.assertEqual(room['jugadores'][pid]['puntos'], expected)
                self.assertIn('error', self.action(code, 'adivinar', pid=spy, palabra='Avión'))
                self.assertEqual(room['jugadores'][spy]['puntos'], 2)

    def test_impostor_guess_rejects_innocents_invalid_and_wrong_words(self):
        code, room = self.room('impostor')
        self.assertIn('error', self.action(code, 'adivinar', palabra='Pizza'))
        self.action(code, 'iniciar')
        spy = room['impostores'][0]
        innocent = next(p for p in room['orden'] if p != spy)
        response = self.client.post('/api/fiesta/accion', json=dict(codigo=code, pid=innocent, accion='adivinar', palabra=room['palabra']))
        self.assertEqual(response.status_code, 403)
        for value in ['', '   ', None, 123, ['Pizza'], 'x' * 81]:
            self.assertIn('error', self.action(code, 'adivinar', pid=spy, palabra=value))
        wrong = self.action(code, 'adivinar', pid=spy, palabra='Una palabra incorrecta')
        self.assertFalse(wrong['acerto'])
        self.assertEqual(room['fase'], 'jugando')
        self.assertIsNone(self.view(code, spy)['palabra'])
        self.assertTrue(all(j['puntos'] == 0 for j in room['jugadores'].values()))
        self.assertTrue(self.action(code, 'adivinar', pid=spy, palabra=room['palabra'])['acerto'])
        self.action(code, 'iniciar')
        self.assertEqual(room['fase'], 'jugando')
        self.assertIsNone(room['resultado'])


if __name__ == '__main__':
    unittest.main()
