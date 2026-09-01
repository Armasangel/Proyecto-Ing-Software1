#!/usr/bin/env bash
# Genera un respaldo manual (puntual) de la base de datos, aparte de los
# respaldos automáticos del servicio db_backup. Útil antes de correr una
# migración o un cambio riesgoso, o para guardar un respaldo fuera de la
# máquina.
#
# Si BACKUP_ENCRYPTION_KEY está configurada en .env (ver .env.example), el
# respaldo queda cifrado con OpenSSL (AES-256) como .sql.gz.enc. Si no está
# configurada, se genera sin cifrar (.sql.gz) y se avisa.
#
# Uso:
#   ./scripts/backup-db.sh
#
# Requiere que el servicio "db" de docker compose esté corriendo.

set -euo pipefail

# Al terminar (con éxito o con error), esperar una tecla antes de cerrar la
# ventana. Esto es necesario porque en Git Bash / Windows, si el script se
# abre haciendo doble clic, la ventana se cierra sola apenas termina y no
# da tiempo a leer ningún mensaje.
pause_before_close() {
  if [ -t 0 ]; then
    echo
    read -n 1 -s -r -p "Presiona una tecla para cerrar esta ventana..."
    echo
  fi
}
trap pause_before_close EXIT

DB_SERVICE="db"
DB_USER="dsm_user"
DB_NAME="deposito_san_miguel"
OUT_DIR="./backups/manual"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PLAIN_FILE="${OUT_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Lee una variable puntual de .env sin ejecutar el archivo como script (a
# diferencia de `source .env`, que falla si alguna otra línea del archivo
# tiene espacios sin comillas, como GMAIL_APP_PASSWORD en .env.example).
read_env_var() {
  local var="$1" file=".env" line value
  [ -f "$file" ] || return 0
  line=$(grep -E "^${var}=" "$file" | tail -n1 || true)
  [ -z "$line" ] && return 0
  value="${line#*=}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value%\"}"; value="${value#\"}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value%\'}"; value="${value#\'}"
  fi
  printf '%s' "$value"
}

BACKUP_ENCRYPTION_KEY=$(read_env_var BACKUP_ENCRYPTION_KEY)
export BACKUP_ENCRYPTION_KEY

if ! docker compose ps --status running --services 2>/dev/null | grep -qx "$DB_SERVICE"; then
  echo "El servicio '$DB_SERVICE' no está corriendo. Levántalo con: docker compose up -d db"
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "Generando respaldo manual de '$DB_NAME' en $PLAIN_FILE ..."
docker compose exec -T "$DB_SERVICE" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists | gzip > "$PLAIN_FILE"

if [ -n "$BACKUP_ENCRYPTION_KEY" ] && [ "$BACKUP_ENCRYPTION_KEY" != "cambia_esto_por_una_frase_larga_y_aleatoria" ]; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "openssl no está disponible en este sistema; el respaldo quedó SIN cifrar en $PLAIN_FILE"
    exit 1
  fi
  ENC_FILE="${PLAIN_FILE}.enc"
  openssl enc -aes-256-cbc -salt -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY -in "$PLAIN_FILE" -out "$ENC_FILE"
  rm -f "$PLAIN_FILE"
  echo "Listo. Respaldo CIFRADO guardado en $ENC_FILE"
  echo "Para restaurarlo: ./scripts/restore-db.sh $ENC_FILE"
else
  echo "ATENCIÓN: BACKUP_ENCRYPTION_KEY no está configurada en .env -- el respaldo quedó SIN cifrar en $PLAIN_FILE"
  echo "Agrega BACKUP_ENCRYPTION_KEY a tu .env (mira .env.example) para que los próximos respaldos manuales se cifren."
  echo "Para restaurarlo: ./scripts/restore-db.sh $PLAIN_FILE"
fi