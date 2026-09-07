#!/usr/bin/env bash
# Reinicia el entorno de desarrollo por completo: baja los contenedores,
# borra los volúmenes (la base de datos queda vacía de nuevo) y las
# imágenes construidas localmente por este proyecto, y vuelve a levantar
# todo con --build. Reemplaza la rutina manual de "down -v" + borrar
# imágenes a mano + "up --build".
#
# ./backups NO se toca -- tus respaldos sobreviven a un reset, igual que
# sobreviven a un "docker compose down -v" suelto.
#
# Uso:
#   ./scripts/dev-reset.sh

set -euo pipefail

pause_before_close() {
  if [ -t 0 ]; then
    echo
    read -n 1 -s -r -p "Presiona una tecla para cerrar esta ventana..."
    echo
  fi
}
trap pause_before_close EXIT

echo "Esto va a hacer lo siguiente:"
echo "  1. Bajar todos los contenedores"
echo "  2. Borrar los volúmenes (postgres_data, pgadmin_data -- la base de datos queda vacía de nuevo)"
echo "  3. Borrar las imágenes construidas localmente por este proyecto"
echo "  4. Reconstruir y levantar todo de nuevo"
echo
echo "./backups NO se toca -- tus respaldos siguen ahí."
echo
read -r -p "Escribe 'si' para confirmar: " CONFIRM
if [ "$CONFIRM" != "si" ]; then
  echo "Cancelado."
  exit 0
fi

echo "Bajando contenedores, volúmenes e imágenes locales..."
docker compose down -v --rmi local

echo "Reconstruyendo y levantando de nuevo..."
docker compose up --build -d

echo
echo "Listo. Corre 'docker compose ps' para ver el estado, o 'docker compose logs -f' para ver los logs."