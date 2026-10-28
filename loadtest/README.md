# loadtest/ — Pruebas de carga y medicion

Scripts de las pruebas de volumen (VOL-01 a VOL-04) y de medicion por endpoint.

## Archivos
- carga.js: prueba de carga con k6 (rampa 20 a 50 VUs). BASE_URL y credenciales se pasan por variables de entorno.
- medidor.ps1 / medidor-prod.ps1: medicion de tiempo y peso por endpoint (p50/p95). Ruta de cookie/token configurable con -CookieFile / -TokFile; por defecto en %TEMP%\dsm-vol\.
- seed_20k_ventas.sql: semilla de 20,000 ventas para las pruebas de volumen.

## Uso rapido
k6 (desde la raiz del repo):

    docker run --rm -i -v "${PWD}:/work" -w /work -e BASE_URL=http://host.docker.internal:3001 -e K6_DUENO_CORREO=correo@uvg.edu.gt -e K6_DUENO_PASSWORD=clave grafana/k6 run /work/loadtest/carga.js

medidor (PowerShell):

    ./loadtest/medidor.ps1 -N 5 -Base http://localhost:3001

seed de 20k ventas:

    docker cp loadtest/seed_20k_ventas.sql <container_db>:/tmp/seed.sql
    docker exec -i <container_db> psql -v ON_ERROR_STOP=1 -U dsm_user -d deposito_san_miguel -f /tmp/seed.sql
