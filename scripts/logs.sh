#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/logs.sh — ayudante de mantenimiento para los logs de Tienda San
# Miguel en Docker. Todo se resuelve dentro del contenedor `app` para no
# depender de node/paquetes en la máquina host.
#
# USO:
#   scripts/logs.sh                 # = live (sigue los logs del contenedor)
#   scripts/logs.sh live            # stdin de `docker compose logs` formateado
#   scripts/logs.sh file [n]        # últimas n líneas del archivo rotado vigente
#   scripts/logs.sh file -f         # seguir el archivo vigente en vivo
#   scripts/logs.sh all             # archivo vigente + rotados (descomprime .gz)
#   scripts/logs.sh errors          # solo error (level 50) de todos los archivos
#   scripts/logs.sh warnings        # solo warn/error (level 40/50)
#   scripts/logs.sh grep <patron>   # grep por palabra/expresión en los archivos
#   scripts/logs.sh list            # lista los archivos rotados en el volumen
#
# Los archivos viven en el volumen `logs_data` montado en /app/logs y se
# rotan por tamaño (50 MB por defecto, ver LOG_FILE_* en .env.example).
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail
cd "$(dirname "$0")/.."

APP=app
LOG_DIR=/app/logs
COMPOSE=(docker compose)

# pino-pretty es dependencia de producción, así que existe en la imagen
# dev y en la de producción (docker compose -f docker-compose.prod.yml).
PPY='node_modules/.bin/pino-pretty -c --ignore pid,hostname --translateTime SYS:HH:MM:ss'

exec_in_app() {
  "${COMPOSE[@]}" exec -T "$APP" sh -c "$1"
}

pretty_stdin() {
  exec_in_app "$PPY"
}

case "${1:-live}" in
  live)
    "${COMPOSE[@]}" logs -f --tail=100 "$APP" | pretty_stdin
    ;;

  file)
    case "${2:-}" in
      -f) exec_in_app "tail -f $LOG_DIR/server.log | $PPY" ;;
      *)  n="${2:-200}"
          [[ "$n" =~ ^[0-9]+$ ]] || { echo "n debe ser un entero no negativo" >&2; exit 1; }
          exec_in_app "tail -n $n $LOG_DIR/server.log | $PPY" ;;
    esac
    ;;

  all)
    exec_in_app "
      for f in $LOG_DIR/server.log*; do
        [ -e \"\$f\" ] || continue
        case \"\$f\" in
          *.gz) zcat \"\$f\" ;;
          *)    cat \"\$f\" ;;
        esac
      done | $PPY
    "
    ;;

  errors)
    exec_in_app "grep -h '\"level\":50' $LOG_DIR/server.log* 2>/dev/null | $PPY"
    ;;

  warnings)
    exec_in_app "grep -hE '\"level\":(50|40)' $LOG_DIR/server.log* 2>/dev/null | $PPY"
    ;;

  grep)
    [ $# -ge 2 ] || { echo "Uso: scripts/logs.sh grep <patron>" >&2; exit 1; }
    exec_in_app "grep -hE \"$2\" $LOG_DIR/server.log* 2>/dev/null | $PPY"
    ;;

  list)
    exec_in_app "ls -lh $LOG_DIR/"
    ;;

  *)
    echo "Comando desconocido: $1" >&2
    sed -n '5,16p' "$0" >&2
    exit 1
    ;;
esac