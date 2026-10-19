(() => {
  const $ = (id) => document.getElementById(id);
  let invitacion = new URLSearchParams(location.search).get('invitacion') || '';
  let modo = invitacion ? 'registrar' : 'entrar';
  let codigo = '';
  async function api(accion, datos) {
    const r = await fetch('/api/cuenta/' + accion, datos ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...datos,pid:Perfil.pid})} : {});
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'No se pudo completar');
    return j;
  }
  function limpiarCache() {
    localStorage.removeItem('perfil_cache');
    localStorage.removeItem('nombreUsuario');
  }
  function pintar() {
    const registro = modo === 'registrar', recuperar = modo === 'recuperar';
    $('titulo').textContent = registro ? 'Crear cuenta' : recuperar ? 'Recuperar contraseña' : 'Iniciar sesión';
    $('enviar').textContent = registro ? 'Crear cuenta' : recuperar ? 'Cambiar contraseña' : 'Entrar';
    $('password').autocomplete = modo === 'entrar' ? 'current-password' : 'new-password';
    $('password-label').textContent = recuperar ? 'Nueva contraseña' : 'Contraseña';
    $('usuario').maxLength = registro || recuperar ? 14 : 254;
    $('recuperacion-campo').hidden = !recuperar;
    $('recuperacion').required = recuperar;
    $('admin').hidden = !invitacion || recuperar;
    $('correo').required = !!invitacion && !recuperar;
    $('ayuda').textContent = registro ? 'Usuario único: 3–14 letras, números o _. Sin correo. Contraseña de al menos 10 caracteres.' : 'La contraseña debe tener al menos 10 caracteres.';
    $('error').textContent = '';
    if (invitacion && registro) $('usuario').value = 'chris';
  }
  document.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => {modo=b.dataset.modo;pintar();});
  $('formulario').onsubmit = async (e) => {
    e.preventDefault();$('enviar').disabled=true;$('error').textContent='';
    try {
      const j = await api(modo, {usuario:$('usuario').value.trim(),password:$('password').value,
        codigo:$('recuperacion').value.trim(),correo:$('correo').value.trim(),invitacion:modo === 'recuperar' ? '' : invitacion});
      limpiarCache();$('password').value='';
      if (invitacion && modo !== 'recuperar') {history.replaceState(null,'','/cuenta');invitacion='';}
      if (j.recuperacion) {
        codigo=j.recuperacion;$('codigo').textContent=codigo;$('acceso').hidden=true;$('respaldo').hidden=false;
      } else location.replace('/perfil');
    } catch (err) {$('error').textContent=err.message;}
    finally {$('enviar').disabled=false;}
  };
  $('continuar').onclick=()=>location.replace(modo === 'recuperar' ? '/cuenta' : '/perfil');
  $('descargar').onclick=()=>{
    const url=URL.createObjectURL(new Blob(['Arcade · '+$('usuario').value.trim()+'\nCódigo de recuperación: '+codigo+'\nGuárdalo en privado.'],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='arcade-recuperacion.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('salir').onclick=async()=>{try{await api('salir',{});limpiarCache();location.replace('/cuenta');}catch(e){$('error').textContent=e.message;}};
  pintar();
  api('estado').then(j=>{if(j.autenticado && !invitacion){$('acceso').hidden=true;$('sesion').hidden=false;$('identidad').textContent=j.usuario+(j.administrador?' · 👑 Administrador':'');}}).catch(e=>{$('error').textContent=e.message;});
})();
