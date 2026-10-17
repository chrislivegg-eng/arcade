#!/bin/bash
# =======================================================
# 🔄 Actualiza el arcade en PythonAnywhere desde GitHub
# =======================================================
# Úsalo desde una consola Bash de PythonAnywhere:
#   bash <(curl -fsSL https://raw.githubusercontent.com/chrislivegg-eng/arcade/claude/sweet-cray-umwhon/actualizar.sh)

set -e

RAMA="${RAMA:-claude/sweet-cray-umwhon}"
BASE="https://raw.githubusercontent.com/chrislivegg-eng/arcade/$RAMA"
CARPETA="${CARPETA:-$HOME}"
RESPALDO="$CARPETA/respaldo_$(date +%Y%m%d_%H%M%S)"

ARCHIVOS=(
  fiesta.py
  dardos.py
  static/js/three.min.js
  templates/juego_dardos.html
  static/fiesta.css
  static/js/fiesta.js
  templates/fiesta_base.html
  templates/impostor.html
  templates/mas_probable.html
  templates/verdad_reto.html
  templates/secreto.html
)

cd "$CARPETA"
echo "📦 Respaldando archivos actuales en $RESPALDO"
mkdir -p "$RESPALDO"
cp -f app.py "$RESPALDO/" 2>/dev/null || true
cp -f templates/secreto.html "$RESPALDO/" 2>/dev/null || true

echo "⬇️  Descargando archivos nuevos..."
for archivo in "${ARCHIVOS[@]}"; do
  mkdir -p "$(dirname "$archivo")"
  curl -fsSL "$BASE/$archivo" -o "$archivo.nuevo"
  mv "$archivo.nuevo" "$archivo"
  echo "   ✅ $archivo"
done

echo "🔧 Conectando los juegos nuevos en app.py..."
python3 - <<'EOF'
import re

with open("app.py") as f:
    codigo = f.read()

cambios = False
for modulo, bp in [("fiesta", "fiesta_bp"), ("dardos", "dardos_bp")]:
    if f"register_blueprint({bp})" in codigo:
        continue
    codigo = re.sub(r"^(from flask import .*)$", rf"\1\nfrom {modulo} import {bp}", codigo, count=1, flags=re.M)
    codigo = re.sub(r"^(app = Flask\(__name__\))$", rf"\1\napp.register_blueprint({bp})", codigo, count=1, flags=re.M)
    if f"register_blueprint({bp})" not in codigo:
        raise SystemExit("❌ No encontré 'app = Flask(__name__)' en app.py. No cambié nada.")
    cambios = True

if cambios:
    with open("app.py", "w") as f:
        f.write(codigo)
    print("   ✅ app.py actualizado")
else:
    print("   ✅ app.py ya estaba listo")
EOF

python3 -m py_compile app.py fiesta.py dardos.py
echo "   ✅ app.py no tiene errores"

echo "🔄 Recargando la página..."
WSGI=$(ls /var/www/*_pythonanywhere_com_wsgi.py 2>/dev/null | head -1)
if [ -n "$WSGI" ]; then
  touch "$WSGI"
  echo "   ✅ Listo"
else
  echo "   ⚠️  Ve a la pestaña Web y pulsa Reload"
fi

echo ""
echo "🎉 ¡Actualizado! Abre: https://$(whoami).pythonanywhere.com/secreto"
echo "   (Si algo sale mal, tus archivos viejos están en $RESPALDO)"
