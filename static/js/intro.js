(() => {
  'use strict';
  const modal = document.getElementById('arcade-intro');
  if (!modal) return;
  const video = document.getElementById('intro-video');
  const sonido = document.getElementById('intro-sonido');
  const pausa = document.getElementById('intro-pausa');
  const estado = document.getElementById('intro-estado');
  const progreso = document.getElementById('intro-progreso');
  const repetir = document.getElementById('intro-repetir');
  const CLAVE_INTRO_VISTA = 'arcade_intro_vista_v1';
  let espera, generacion = 0, visibleAntes = false;

  // Asegura que el diálogo inicie cerrado hasta verificar si ya se vio antes.
  modal.removeAttribute('open');
  if (typeof modal.showModal !== 'function') return;
  if (repetir) repetir.hidden = false;

  function yaVioIntro() {
    if (new URLSearchParams(location.search).get('intro') === '1') return false;
    try {
      return (
        localStorage.getItem(CLAVE_INTRO_VISTA) === '1' ||
        sessionStorage.getItem(CLAVE_INTRO_VISTA) === '1'
      );
    } catch (_) {
      return false;
    }
  }

  function marcarIntroVista() {
    try {
      localStorage.setItem(CLAVE_INTRO_VISTA, '1');
      sessionStorage.setItem(CLAVE_INTRO_VISTA, '1');
    } catch (_) {}
  }

  function cerrar() {
    marcarIntroVista();
    if (modal.open) modal.close();
  }

  function botones() {
    sonido.textContent = video.muted ? 'Activar música' : 'Silenciar música';
    sonido.setAttribute('aria-pressed', String(!video.muted));
    pausa.textContent = video.paused ? 'Continuar' : 'Pausar';
  }

  async function reproducir(conSonido = false) {
    const turno = generacion;
    if (!modal.open) return;
    if (conSonido) video.muted = false;
    clearTimeout(espera);
    espera = setTimeout(cerrar, 10000);
    try {
      await video.play();
      if (turno !== generacion || !modal.open) return;
      clearTimeout(espera);
      pausa.hidden = false;
      botones();
    } catch (_) {
      if (turno !== generacion || !modal.open) return;
      clearTimeout(espera);
      video.muted = true;
      estado.textContent = 'La presentación está lista. Tú decides cuándo empezar.';
      sonido.textContent = 'Reproducir con música';
      sonido.setAttribute('aria-pressed', 'false');
      pausa.hidden = true;
    }
  }

  function abrir() {
    if (modal.open) return;
    marcarIntroVista();
    generacion++;
    visibleAntes = false;
    video.muted = true;
    progreso.value = 0;
    pausa.hidden = true;
    modal.classList.remove('intro-reproduciendo');
    const movil = matchMedia('(max-width: 700px), (pointer: coarse) and (orientation: portrait)').matches;
    video.src = movil ? modal.dataset.movil : modal.dataset.pc;
    video.preload = 'none';
    modal.showModal();
    botones();
    const tranquilo = matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData;
    estado.textContent = tranquilo ? 'Dale play para ver la presentación.' : 'Gameplay real · 24 segundos';
    if (tranquilo) sonido.textContent = 'Reproducir con música';
    else reproducir();
  }

  modal.addEventListener('close', () => {
    marcarIntroVista();
    generacion++;
    clearTimeout(espera);
    visibleAntes = false;
    video.pause();
    video.removeAttribute('src');
    video.load();
    modal.classList.remove('intro-reproduciendo');
    const selector = document.querySelector('#selector-modo:not(.oculto) button');
    (selector || document.getElementById('texto-modo'))?.focus({ preventScroll: true });
  });

  video.addEventListener('playing', () => {
    if (!modal.open) { video.pause(); return; }
    clearTimeout(espera);
    modal.classList.add('intro-reproduciendo');
    estado.textContent = 'Gameplay real · 24 segundos';
    pausa.hidden = false;
    botones();
  });
  video.addEventListener('pause', botones);
  video.addEventListener('ended', cerrar);
  video.addEventListener('error', () => { if (video.hasAttribute('src')) cerrar(); });
  video.addEventListener('waiting', () => {
    if (modal.open && !video.paused) { clearTimeout(espera); espera = setTimeout(cerrar, 10000); }
  });
  video.addEventListener('timeupdate', () => {
    if (Number.isFinite(video.duration) && video.duration > 0) progreso.value = video.currentTime / video.duration;
  });
  sonido.addEventListener('click', () => {
    if (!modal.classList.contains('intro-reproduciendo')) reproducir(true);
    else { video.muted = !video.muted; botones(); }
  });
  pausa.addEventListener('click', () => {
    if (video.paused) reproducir();
    else { clearTimeout(espera); video.pause(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (!modal.open) return;
    if (document.hidden) {
      visibleAntes = !video.paused;
      clearTimeout(espera);
      video.pause();
    } else if (visibleAntes) { visibleAntes = false; reproducir(); }
  });
  if (repetir) repetir.addEventListener('click', abrir);

  // Solo abre automáticamente el tráiler la primera vez; al recargar o volver de un juego no molesta.
  if (!yaVioIntro()) {
    abrir();
  }
})();
