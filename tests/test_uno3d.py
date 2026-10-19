import unittest
from app import app
import fiesta


class UnoVisualTest(unittest.TestCase):
    def test_visual_move_metadata_is_public_and_does_not_expose_other_hands(self):
        fiesta.salas_fiesta.clear()
        c=app.test_client()
        codigo=c.post('/api/fiesta/crear',json={'juego':'uno','pid':'a','nombre':'Ana'}).json['codigo']
        c.post('/api/fiesta/unirse',json={'juego':'uno','codigo':codigo,'pid':'b','nombre':'Beto'})
        c.post('/api/fiesta/accion',json={'codigo':codigo,'pid':'a','accion':'iniciar'})
        sala=fiesta.salas_fiesta[codigo];u=sala['uno'];pid=u['orden'][u['turno']]
        carta=u['manos'][pid][0]
        if carta['c']!='negro':u['color']=carta['c']
        r=c.post('/api/fiesta/accion',json={'codigo':codigo,'pid':pid,'accion':'jugar','id':carta['id'],'color':'azul'})
        self.assertEqual(r.status_code,200)
        for jugador in ['a','b']:
            v=c.get(f'/api/fiesta/estado/{codigo}?pid={jugador}').json
            self.assertEqual(v['ultima_jugada'],{'pid':pid,'id':carta['id']})
            self.assertEqual(v['arriba']['id'],carta['id'])
            self.assertNotIn('manos',v)
            self.assertNotIn('manos_finales',v)
            self.assertEqual({x['id'] for x in v['mano']},{x['id'] for x in u['manos'][jugador]})
