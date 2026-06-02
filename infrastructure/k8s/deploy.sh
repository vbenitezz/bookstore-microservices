#!/bin/bash
# =============================================================================
# deploy.sh — Despliega todos los microservicios en EKS
#
# Uso:
#   chmod +x infrastructure/k8s/deploy.sh
#   ./infrastructure/k8s/deploy.sh
#
# Prerequisitos:
#   - kubectl configurado: aws eks update-kubeconfig --name bookstore --region us-east-1
#   - Imágenes en ECR (Fase 5 completada)
#   - .env con credenciales reales
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
K8S_DIR="${SCRIPT_DIR}"

echo "================================================"
echo "  BookStore — Deploy en EKS"
echo "================================================"

# --- Verificar conexión al clúster ---
echo ""
echo "→ Verificando conexión al clúster EKS..."
kubectl cluster-info --context=$(kubectl config current-context) > /dev/null 2>&1
echo "✓ Conectado al clúster: $(kubectl config current-context)"

# --- Paso 1: Namespace ---
echo ""
echo "→ Creando namespace..."
kubectl apply -f "${K8S_DIR}/namespaces.yaml"
echo "✓ Namespace 'bookstore' listo"

# --- Paso 2: Instalar AWS Load Balancer Controller ---
# Necesario para que el Ingress cree el ALB automáticamente
echo ""
echo "→ Verificando AWS Load Balancer Controller..."

if ! kubectl get deployment aws-load-balancer-controller \
     -n kube-system > /dev/null 2>&1; then

  echo "  Instalando AWS Load Balancer Controller..."
  AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

  # Instalar via Helm
  helm repo add eks https://aws.github.io/eks-charts
  helm repo update

  helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
    -n kube-system \
    --set clusterName=bookstore \
    --set serviceAccount.create=false \
    --set serviceAccount.name=aws-load-balancer-controller \
    --set region=us-east-1 \
    --set vpcId=$(aws ec2 describe-vpcs \
      --filters "Name=tag:Name,Values=bookstore-vpc" \
      --query 'Vpcs[0].VpcId' --output text)

  echo "✓ AWS Load Balancer Controller instalado"
else
  echo "✓ AWS Load Balancer Controller ya instalado"
fi

# --- Paso 3: Generar y aplicar Secrets ---
echo ""
echo "→ Generando secrets desde .env..."
chmod +x "${K8S_DIR}/secrets/generate-secrets.sh"
"${K8S_DIR}/secrets/generate-secrets.sh"
kubectl apply -f "${K8S_DIR}/secrets/bookstore-secrets.yaml"
echo "✓ Secrets aplicados"

# --- Paso 4: Inicializar base de datos en RDS ---
# El postgres-init.sh necesita correr contra RDS para crear
# los schemas y usuarios. Lo hacemos via un Job de Kubernetes
# que tiene acceso a la red interna del clúster.
echo ""
echo "→ Inicializando base de datos RDS..."

cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: db-init
  namespace: bookstore
spec:
  ttlSecondsAfterFinished: 300
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: db-init
          image: postgres:16-alpine
          command: ["/bin/sh", "-c"]
          args:
            - |
              echo "Inicializando schemas en RDS..."
              PGPASSWORD=\$DB_ROOT_PASSWORD psql \
                -h \$DB_HOST \
                -U \$DB_ROOT_USER \
                -d bookstore_main \
                -c "
                  CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
                  CREATE EXTENSION IF NOT EXISTS pg_trgm;

                  CREATE SCHEMA IF NOT EXISTS auth;
                  CREATE SCHEMA IF NOT EXISTS catalog;
                  CREATE SCHEMA IF NOT EXISTS orders;
                  CREATE SCHEMA IF NOT EXISTS payments;

                  DO \\\$\\\$
                  BEGIN
                    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'auth_user') THEN
                      CREATE ROLE auth_user WITH LOGIN PASSWORD '\$AUTH_DB_PASSWORD';
                    END IF;
                  END \\\$\\\$;
                  GRANT USAGE, CREATE ON SCHEMA auth TO auth_user;
                  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO auth_user;
                  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO auth_user;
                  ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO auth_user;
                  ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO auth_user;
                  ALTER ROLE auth_user SET search_path TO auth, public;

                  DO \\\$\\\$
                  BEGIN
                    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'catalog_user') THEN
                      CREATE ROLE catalog_user WITH LOGIN PASSWORD '\$CATALOG_DB_PASSWORD';
                    END IF;
                  END \\\$\\\$;
                  GRANT USAGE, CREATE ON SCHEMA catalog TO catalog_user;
                  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA catalog TO catalog_user;
                  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA catalog TO catalog_user;
                  ALTER DEFAULT PRIVILEGES IN SCHEMA catalog GRANT ALL ON TABLES TO catalog_user;
                  ALTER DEFAULT PRIVILEGES IN SCHEMA catalog GRANT ALL ON SEQUENCES TO catalog_user;
                  ALTER ROLE catalog_user SET search_path TO catalog, public;

                  DO \\\$\\\$
                  BEGIN
                    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'order_user') THEN
                      CREATE ROLE order_user WITH LOGIN PASSWORD '\$ORDER_DB_PASSWORD';
                    END IF;
                  END \\\$\\\$;
                  GRANT USAGE, CREATE ON SCHEMA orders TO order_user;
                  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA orders TO order_user;
                  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA orders TO order_user;
                  ALTER DEFAULT PRIVILEGES IN SCHEMA orders GRANT ALL ON TABLES TO order_user;
                  ALTER DEFAULT PRIVILEGES IN SCHEMA orders GRANT ALL ON SEQUENCES TO order_user;
                  ALTER ROLE order_user SET search_path TO orders, public;

                  DO \\\$\\\$
                  BEGIN
                    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'payment_user') THEN
                      CREATE ROLE payment_user WITH LOGIN PASSWORD '\$PAYMENT_DB_PASSWORD';
                    END IF;
                  END \\\$\\\$;
                  GRANT USAGE, CREATE ON SCHEMA payments TO payment_user;
                  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA payments TO payment_user;
                  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA payments TO payment_user;
                  ALTER DEFAULT PRIVILEGES IN SCHEMA payments GRANT ALL ON TABLES TO payment_user;
                  ALTER DEFAULT PRIVILEGES IN SCHEMA payments GRANT ALL ON SEQUENCES TO payment_user;
                  ALTER ROLE payment_user SET search_path TO payments, public;
                "
              echo "✓ Base de datos inicializada"
          env:
            - name: DB_HOST
              value: "bookstore-postgres.cw8htjuayjec.us-east-1.rds.amazonaws.com"
            - name: DB_ROOT_USER
              value: "bookstore_admin"
            - name: DB_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: bookstore-secrets
                  key: DB_PASSWORD
            - name: AUTH_DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: bookstore-secrets
                  key: AUTH_DB_PASSWORD
            - name: CATALOG_DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: bookstore-secrets
                  key: CATALOG_DB_PASSWORD
            - name: ORDER_DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: bookstore-secrets
                  key: ORDER_DB_PASSWORD
            - name: PAYMENT_DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: bookstore-secrets
                  key: DB_PASSWORD
EOF

echo "  Esperando a que el Job de inicialización termine..."
kubectl wait --for=condition=complete job/db-init \
  -n bookstore --timeout=120s
echo "✓ Base de datos inicializada"

# --- Paso 5: Desplegar microservicios ---
echo ""
echo "→ Desplegando microservicios..."

for SERVICE in auth-service catalog-service cart-service order-service; do
  echo "  Desplegando ${SERVICE}..."
  kubectl apply -f "${K8S_DIR}/${SERVICE}/configmap.yaml"
  kubectl apply -f "${K8S_DIR}/${SERVICE}/deployment.yaml"
  kubectl apply -f "${K8S_DIR}/${SERVICE}/service.yaml"
  echo "  ✓ ${SERVICE}"
done

# --- Paso 6: Ingress (ALB) ---
echo ""
echo "→ Aplicando Ingress (ALB)..."
kubectl apply -f "${K8S_DIR}/ingress/ingress.yaml"
echo "✓ Ingress aplicado"

# --- Paso 7: Esperar que los pods estén listos ---
echo ""
echo "→ Esperando que los pods estén listos (puede tardar 2-3 minutos)..."

for SERVICE in auth-service catalog-service cart-service order-service; do
  kubectl rollout status deployment/${SERVICE} \
    -n bookstore --timeout=300s
  echo "  ✓ ${SERVICE} listo"
done

# --- Paso 8: Mostrar estado final ---
echo ""
echo "================================================"
echo "  ✓ Despliegue completado"
echo "================================================"
echo ""
echo "Pods corriendo:"
kubectl get pods -n bookstore

echo ""
echo "Services:"
kubectl get services -n bookstore

echo ""
echo "Ingress (esperar ~3 min para que el ALB esté disponible):"
kubectl get ingress -n bookstore

echo ""
echo "URL del ALB (disponible en ~3 minutos):"
kubectl get ingress bookstore-ingress -n bookstore \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
echo ""