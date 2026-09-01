#!/usr/bin/env bash
# Restaura la base de datos a partir de un archivo de respaldo (.sql.gz o
# .sql.gz.enc si está cifrado), ya sea uno generado por backup-db.sh o uno
# de ./backups (los automáticos del servicio db_backup, sin cifrar, en
# ./backups/daily|weekly|monthly).
#
# Antes de tocar la base de datos, valida que el archivo sea de verdad un
# respaldo: por su extensión Y por la firma real de sus primeros bytes (no
# alcanza con renombrar cualquier archivo a .sql.gz).
#
# ADVERTENCIA: esta operación SOBRESCRIBE la base de datos actual. Pide
# confirmación antes de continuar.
#
# Uso:
#   ./scripts/restore-db.sh <ruta-al-backup.sql.gz[.enc]>

set -euo pipefail

TMP_DECRYPTED=""

# Al terminar (con éxito o con error), borra el archivo temporal
# descifrado si se llegó a crear, y espera una tecla antes de cerrar la
# ventana. Esto último es necesario porque en Git Bash / Windows, si el
# script se abre haciendo doble clic, la ventana se cierra sola apenas
# termina y no da tiempo a leer ningún mensaje.
cleanup_and_pause() {
  local status=$?
  if [ -n "$TMP_DECRYPTED" ]; then
    rm -f "$TMP_DECRYPTED"
  fi
  if [ -t 0 ]; then
    echo
    read -n 1 -s -r -p "Presiona una tecla para cerrar esta ventana..."
    echo
  fi
  exit "$status"
}
trap cleanup_and_pause EXIT

DB_SERVICE="db"
DB_USER="dsm_user"
DB_NAME="deposito_san_miguel"

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

if [ $# -ne 1 ]; then
  echo "Uso: ./scripts/restore-db.sh <ruta-al-backup.sql.gz[.enc]>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "No se encontró el archivo: $BACKUP_FILE"
  exit 1
fi

# Validar que el archivo sea de verdad un respaldo de base de datos, por
# extensión Y por la firma real de los primeros bytes, para que no alcance
# con renombrar cualquier archivo a .sql.gz.
IS_ENCRYPTED=0
case "$BACKUP_FILE" in
  *.sql.gz.enc)
    IS_ENCRYPTED=1
    MAGIC=$(head -c8 "$BACKUP_FILE" 2>/dev/null || true)
    if [ "$MAGIC" != "Salted__" ]; then
      echo "'$BACKUP_FILE' tiene extensión .sql.gz.enc pero su contenido no es un archivo cifrado con OpenSSL válido. No se va a restaurar."
      exit 1
    fi
    ;;
  *.sql.gz)
    MAGIC_HEX=$(od -An -tx1 -N2 "$BACKUP_FILE" 2>/dev/null | tr -d ' \n')
    if [ "$MAGIC_HEX" != "1f8b" ]; then
      echo "'$BACKUP_FILE' tiene extensión .sql.gz pero su contenido no es un gzip válido. No se va a restaurar."
      exit 1
    fi
    ;;
  *)
    echo "Solo se aceptan archivos .sql.gz o .sql.gz.enc -- '$BACKUP_FILE' no es uno de esos."
    exit 1
    ;;
esac

if ! docker compose ps --status running --services 2>/dev/null | grep -qx "$DB_SERVICE"; then
  echo "El servicio '$DB_SERVICE' no está corriendo. Levántalo con: docker compose up -d db"
  exit 1
fi

echo "ADVERTENCIA: esto va a SOBRESCRIBIR la base de datos '$DB_NAME' con el contenido de:"
echo "    $BACKUP_FILE"
read -r -p "Escribe 'si' para confirmar: " CONFIRM
if [ "$CONFIRM" != "si" ]; then
  echo "Cancelado."
  exit 0
fi

RESTORE_SOURCE="$BACKUP_FILE"

if [ "$IS_ENCRYPTED" -eq 1 ]; then
  if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
    echo "Este respaldo está cifrado pero no encontré BACKUP_ENCRYPTION_KEY en tu .env -- sin esa clave no se puede descifrar."
    exit 1
  fi
  if ! command -v openssl >/dev/null 2>&1; then
    echo "openssl no está disponible en este sistema; no se puede descifrar el respaldo."
    exit 1
  fi
  TMP_DECRYPTED=$(mktemp)
  echo "Descifrando..."
  if ! openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY -in "$BACKUP_FILE" -out "$TMP_DECRYPTED"; then
    echo "No se pudo descifrar el archivo -- revisa que BACKUP_ENCRYPTION_KEY sea la misma que se usó al generarlo."
    exit 1
  fi
  RESTORE_SOURCE="$TMP_DECRYPTED"
fi

echo "Restaurando..."
gunzip -c "$RESTORE_SOURCE" | docker compose exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME"

echo "Restauración completa."