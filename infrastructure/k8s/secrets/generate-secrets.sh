#!/bin/bash
# =============================================================================
# generate-secrets.sh — Genera el Secret de Kubernetes desde el .env local
#
# Uso: ./infrastructure/k8s/secrets/generate-secrets.sh
#
# Lee las variables del .env en la raíz del proyecto y genera
# el archivo bookstore-secrets.yaml con los valores en base64.
# El archivo generado NUNCA debe subirse al repositorio.
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
OUTPUT_FILE="${SCRIPT_DIR}/bookstore-secrets.yaml"

if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: No se encontró el archivo .env en ${PROJECT_ROOT}"
  exit 1
fi

# Cargar variables del .env
set -a
source "${ENV_FILE}"
set +a

# Función para codificar en base64
b64() {
  echo -n "$1" | base64 | tr -d '\n'
}

echo "Generando ${OUTPUT_FILE}..."

cat > "${OUTPUT_FILE}" << EOF
# GENERADO AUTOMÁTICAMENTE por generate-secrets.sh
# NO subir al repositorio — contiene credenciales reales
apiVersion: v1
kind: Secret
metadata:
  name: bookstore-secrets
  namespace: bookstore
type: Opaque
data:
  DB_PASSWORD: $(b64 "${POSTGRES_ROOT_PASSWORD}")
  AUTH_DB_PASSWORD: $(b64 "${AUTH_DB_PASSWORD}")
  CATALOG_DB_PASSWORD: $(b64 "${CATALOG_DB_PASSWORD}")
  ORDER_DB_PASSWORD: $(b64 "${ORDER_DB_PASSWORD}")
  REDIS_PASSWORD: $(b64 "${REDIS_PASSWORD}")
  RABBITMQ_PASSWORD: $(b64 "${RABBITMQ_PASSWORD}")
  JWT_SECRET: $(b64 "${JWT_SECRET}")
  JWT_REFRESH_SECRET: $(b64 "${JWT_REFRESH_SECRET}")
EOF

echo "✓ Secret generado en ${OUTPUT_FILE}"
echo ""
echo "Aplica con:"
echo "  kubectl apply -f infrastructure/k8s/secrets/bookstore-secrets.yaml"