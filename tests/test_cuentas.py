"""Identidad, progreso entre dispositivos y propiedad de récords históricos."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import app
import cuentas
import perfil
from records_cuenta import leer_tabla, preparar_app


class CuentasTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.patches = [patch.object(cuentas, 'ARCHIVO_CUENTAS', str(self.root/'cuentas.sqlite3')),
                        patch.object(perfil, 'ARCHIVO_PERFILES', str(self.root/'perfiles.json'))]
        for p in self.patches:
            p.start()
        app.testing = True
        self.a = app.test_client()
        self.b = app.test_client()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def registro(self, client=None, **extra):
        return (client or self.a).post('/api/cuenta/registrar', json={
            'usuario':'Miguel', 'password':'clave-segura-123', 'pid':'equipo-a', **extra})

    def admin(self):
        token = cuentas.crear_invitacion('admin@example.com')
        r = self.registro(usuario='chris', correo='admin@example.com', invitacion=token)
        self.assertEqual(r.status_code, 200, r.json)
        return token

    def test_username_unique_and_role_not_chosen_by_browser(self):
        self.assertEqual(self.registro(administrador=True, correo='admin@example.com').status_code, 200)
        self.assertFalse(self.a.get('/api/cuenta/estado').json['administrador'])
        self.assertEqual(self.registro(self.b, usuario='mIGUEL', pid='otro').status_code, 409)
        self.assertEqual(self.registro(self.b, usuario='chris').status_code, 400)
        self.assertEqual(self.registro(self.b, usuario='Chrs').status_code, 400)

    def test_profile_sync_isolation_and_guest_copy_once(self):
        self.a.post('/api/perfil', json={'pid':'equipo-a', 'nombre':'Antes', 'avatar':'🐶'})
        self.registro()
        r = self.b.post('/api/cuenta/entrar', json={'usuario':'MIGUEL','password':'clave-segura-123','pid':'equipo-b'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.b.get('/api/perfil?pid=equipo-b').json['avatar'], '🐶')
        self.b.post('/api/perfil', json={'pid':'equipo-b','avatar':'🐼','nombre':'Otro'})
        p = self.a.get('/api/perfil?pid=equipo-a').json
        self.assertEqual((p['nombre'], p['avatar']), ('Miguel','🐼'))
        self.assertEqual(self.b.get('/api/perfil?pid=equipo-a').status_code, 403)
        with cuentas.conexion() as db:
            identity = db.execute('SELECT id FROM usuarios').fetchone()[0]
        self.assertEqual(app.test_client().get('/api/perfil?pid='+identity).status_code, 401)
        self.a.post('/api/cuenta/salir', json={})
        self.registro(usuario='Miguel2')
        self.assertEqual(self.a.get('/api/perfil?pid=equipo-a').json['avatar'], '😺')

    def test_admin_invitation_email_login_unlimited_and_replay(self):
        token = self.admin()
        p = self.a.post('/api/perfil', json={'pid':'equipo-a','avatar':'🔥','marco':'oro'}).json
        self.assertTrue(p['monedas_infinitas'])
        self.assertEqual(p['monedas'],50)
        self.assertIn('💎',p['comprados'])
        r = self.b.post('/api/cuenta/entrar', json={'usuario':'admin@example.com','password':'clave-segura-123','pid':'b'})
        self.assertEqual(r.status_code,200)
        self.assertTrue(r.json['administrador'])
        replay = self.b.post('/api/cuenta/entrar', json={'usuario':'chris','password':'clave-segura-123','pid':'b',
                                                     'invitacion':token,'correo':'admin@example.com'})
        self.assertEqual(replay.status_code,400)
        self.assertEqual(self.a.get('/api/records_generales').json['monedas'],[])

    def test_recovery_revokes_sessions_rotates_code(self):
        code = self.registro().json['recuperacion']
        self.b.post('/api/cuenta/entrar',json={'usuario':'Miguel','password':'clave-segura-123','pid':'b'})
        r = self.a.post('/api/cuenta/recuperar',json={'usuario':'miguel','codigo':code,'password':'otra-segura-123'})
        self.assertEqual(r.status_code,200)
        self.assertNotEqual(r.json['recuperacion'],code)
        self.assertFalse(self.b.get('/api/cuenta/estado').json['autenticado'])
        self.assertEqual(self.a.post('/api/cuenta/recuperar',json={'usuario':'miguel','codigo':code,'password':'otra-segura-123'}).status_code,401)

    def test_game_progress_and_rewards_shared_without_duplicate_payment(self):
        self.registro()
        self.b.post('/api/cuenta/entrar',json={'usuario':'Miguel','password':'clave-segura-123','pid':'b'})
        token=self.a.post('/api/perfil/iniciar',json={'pid':'equipo-a','juego':'wordle','modo':'solo'}).json['partida']
        data={'pid':'equipo-a','juego':'wordle','tipo':'fin','partida':token,'evento':'uno','datos':{'gano':True,'intentos':2}}
        r=self.a.post('/api/perfil/evento',json=data)
        self.assertGreater(r.json['ganadas'],0)
        data.update(pid='b',evento='otro')
        self.assertEqual(self.b.post('/api/perfil/evento',json=data).json['ganadas'],0)
        p=self.b.get('/api/perfil?pid=b').json
        self.assertEqual(p['stats']['partidas'],1)
        self.assertEqual(p['stats']['victorias'],1)
        self.assertIn('wordle_2',p['logros'])
        self.assertEqual(p['monedas'],r.json['monedas'])

    def test_json_origin_and_cookie_protection(self):
        self.assertEqual(self.a.post('/api/cuenta/registrar',data={}).status_code,415)
        self.assertEqual(self.a.post('/api/cuenta/registrar',json={},headers={'Origin':'https://ajeno.example'}).status_code,403)
        r = self.registro()
        self.assertIn('HttpOnly',r.headers['Set-Cookie'])
        self.assertIn('SameSite=Lax',r.headers['Set-Cookie'])
        with cuentas.conexion() as db:
            row=db.execute('SELECT * FROM usuarios').fetchone()
            self.assertNotIn('clave-segura-123',row['password_hash'])
            db.execute('UPDATE sesiones SET expira=0')
        self.assertFalse(self.a.get('/api/cuenta/estado').json['autenticado'])

    def test_aliases_sum_wins_best_score_lowest_attempts_and_protect_writes(self):
        self.admin()
        for filename, expected in [('victorias_gato.txt',6),('record_cima.txt',5),('record_memorama.txt',1)]:
            f=self.root/filename
            original='Chris:5\nchris:1\nSara:7\n'
            f.write_text(original,encoding='utf-8')
            self.assertEqual(leer_tabla(str(f)),{'chris':expected,'Sara':7})
            self.assertEqual(f.read_text(encoding='utf-8'),original)
        f=self.root/'puntos.txt';f.write_text('Chrs:4550\nChros:8\nChristian:9999\n',encoding='utf-8')
        self.assertEqual(leer_tabla(str(f)),{'chris':4550,'Christian':9999})
        with patch('duelo._archivo_record',return_value=str(self.root/'record_prueba.txt')):
            self.assertEqual(self.b.post('/api/records/wordle',json={'nombre':'Chris','puntos':10}).status_code,401)
            self.assertEqual(self.a.post('/api/records/wordle',json={'nombre':'Sara','puntos':10}).status_code,200)
            self.assertEqual(leer_tabla(str(self.root/'record_prueba.txt')),{'chris':10})

    def test_custom_icon_admin_only_validation_and_sync(self):
        import base64, struct, zlib
        def chunk(t,d):
            return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
        png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',256,256,8,6,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+b'\xff\0\0\xff'*256)*256))+chunk(b'IEND',b'')
        imagen='data:image/png;base64,'+base64.b64encode(png).decode()
        self.assertEqual(self.b.post('/api/perfil/icono',json={'pid':'b','imagen':imagen}).status_code,403)
        self.registro(self.b,usuario='Normal',pid='b')
        self.assertEqual(self.b.post('/api/perfil/icono',json={'pid':'b','imagen':imagen}).status_code,403)
        self.admin()
        for invalida in ['data:image/svg+xml;base64,AAAA','data:image/png;base64,AAAA',imagen[:-8], 'x'*410001]:
            self.assertIn(self.a.post('/api/perfil/icono',json={'pid':'equipo-a','imagen':invalida}).status_code,[400,413])
        r=self.a.post('/api/perfil/icono',json={'pid':'equipo-a','imagen':imagen})
        self.assertEqual(r.status_code,200,r.json)
        url=r.json['avatar_url']
        self.assertEqual(self.b.get(url).data,png)
        self.assertEqual(self.b.get(url).headers['X-Content-Type-Options'],'nosniff')
        self.b.post('/api/cuenta/entrar',json={'usuario':'chris','password':'clave-segura-123','pid':'b'})
        self.assertEqual(self.b.get('/api/perfil?pid=b').json['avatar_url'],url)
        self.assertEqual(self.a.post('/api/perfil',json={'pid':'equipo-a','avatar':'🐼'}).json['avatar_url'],None)

    def test_installer_is_idempotent_and_preserves_inventory(self):
        source=Path(__file__).resolve().parents[1].joinpath('app.py').read_text(encoding='utf-8')
        self.assertEqual(preparar_app(source),source)
        self.assertIn("@app.route('/')",source)
        with self.assertRaises(ValueError):
            preparar_app('def desconocido():\n    pass\n')
