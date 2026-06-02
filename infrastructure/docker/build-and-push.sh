#!/bin/bash
# =============================================================================
# build-and-push.sh — Construir imágenes Docker y subirlas a ECR
#
# Uso:
#   chmod +x infrastructure/docker/build-and-push.sh
#   ./infrastructure/docker/build-and-push.sh              # todos los servicios
#   ./infrastructure/docker/build-and-push.sh auth-service # un solo servicio
# =============================================================================

set -e

AWS_REGION="us-east-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
PROJECT_NAME="bookstore"
IMAGE_TAG="latest"

ALL_SERVICES=("auth-service" "catalog-service" "cart-service" "order-service")

if [ $# -eq 1 ]; then
  SERVICES=("$1")
else
  SERVICES=("${ALL_SERVICES[@]}")
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "================================================"
echo "  BookStore — Build & Push to ECR"
echo "  Account: ${AWS_ACCOUNT_ID}"
echo "  Registry: ${ECR_REGISTRY}"
echo "  Servicios: ${SERVICES[*]}"
echo "================================================"

# Login a ECR
echo ""
echo "→ Autenticando en ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | \
  docker login --username AWS --password-stdin "${ECR_REGISTRY}"
echo "✓ Login exitoso"

for SERVICE in "${SERVICES[@]}"; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Procesando: ${SERVICE}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  SERVICE_DIR="${PROJECT_ROOT}/services/${SERVICE}"
  IMAGE_NAME="${ECR_REGISTRY}/${PROJECT_NAME}/${SERVICE}:${IMAGE_TAG}"

  if [ ! -d "${SERVICE_DIR}" ]; then
    echo "✗ ERROR: No se encontró ${SERVICE_DIR}"
    exit 1
  fi

  # Copiar proto/ dentro del directorio del servicio antes del build
  # Esto permite que el Dockerfile acceda a los .proto con COPY proto/ ./proto/
  echo "→ Copiando archivos .proto al contexto del servicio..."
  cp -r "${PROJECT_ROOT}/proto" "${SERVICE_DIR}/proto"

  # Determinar Dockerfile
  if [ "${SERVICE}" = "catalog-service" ]; then
    DOCKERFILE="${PROJECT_ROOT}/infrastructure/docker/Dockerfile.python"
  else
    DOCKERFILE="${PROJECT_ROOT}/infrastructure/docker/Dockerfile.node"
  fi

  echo "→ Construyendo imagen (stage: production)..."

  docker build \
    --target production \
    --file "${DOCKERFILE}" \
    --tag "${IMAGE_NAME}" \
    "${SERVICE_DIR}"

  # Limpiar proto/ copiado — no debe quedar en el repo
  rm -rf "${SERVICE_DIR}/proto"

  echo "✓ Imagen construida: ${IMAGE_NAME}"

  echo "→ Subiendo a ECR..."
  docker push "${IMAGE_NAME}"
  echo "✓ Push completado"

done

echo ""
echo "================================================"
echo "  ✓ Todas las imágenes subidas exitosamente"
echo ""
echo "  Verifica en ECR:"
echo "  aws ecr list-images --repository-name ${PROJECT_NAME}/auth-service"
echo "================================================"