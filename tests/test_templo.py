"""Integración de Umbra: página, mejores tiempos y premio de expedición."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import app
import duelo
import perfil


class TemploTest(unittest.TestCase):
    def test_completion_awards_achievement_once(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(perfil, 'ARCHIVO_PERFILES', str(Path(tmp)/'perfiles.json')):
            client=app.test_client()
            token=client.post('/api/perfil/iniciar',json={'pid':'explorador','juego':'templo','modo':'solo'}).json['partida']
            payload={'pid':'explorador','juego':'templo','tipo':'fin','partida':token,'evento':'final','datos':{'gano':True}}
            self.assertEqual(client.post('/api/perfil/evento',json=payload).status_code,200)
            p=client.get('/api/perfil?pid=explorador').json
            self.assertIn('templo',p['logros'])
            self.assertEqual(p['stats']['partidas'],1)
            self.assertEqual(p['stats']['victorias'],1)
            payload['evento']='reintento'
            self.assertEqual(client.post('/api/perfil/evento',json=payload).json['ganadas'],0)

    def test_leaderboard_preserves_shortest_expedition(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(duelo,'_archivo_record',return_value=str(Path(tmp)/'record_templo.txt')):
            client=app.test_client()
            for segundos in [560,420,700]:
                self.assertEqual(client.post('/api/records/templo',json={'nombre':'Explorador','puntos':segundos}).status_code,200)
            self.assertEqual(client.get('/api/records/templo').json,[{'nombre':'Explorador','puntos':420}])


if __name__=='__main__':
    unittest.main()
