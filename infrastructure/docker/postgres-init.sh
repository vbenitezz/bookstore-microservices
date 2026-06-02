#!/bin/bash
# =============================================================================
# postgres-init.sh — Inicialización de PostgreSQL para BookStore
#
# Este script corre UNA SOLA VEZ cuando el contenedor de PostgreSQL
# se crea por primera vez (volumen vacío).
#
# Usa variables de entorno del .env para las contraseñas, evitando
# hardcodearlas en el código.
#
# Variables que deben estar en el .env (y en el docker-compose):
#   AUTH_DB_USER, AUTH_DB_PASSWORD
#   CATALOG_DB_USER, CATALOG_DB_PASSWORD
#   ORDER_DB_USER, ORDER_DB_PASSWORD
#   PAYMENT_DB_USER, PAYMENT_DB_PASSWORD
# =============================================================================

set -e  # Salir inmediatamente si cualquier comando falla

echo "=== BookStore: Iniciando configuración de PostgreSQL ==="

# La variable POSTGRES_DB ya creó 'bookstore_main' automáticamente.
# Nos conectamos a ella para crear schemas y usuarios.

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "bookstore_main" <<-EOSQL

  -- =========================================================================
  -- EXTENSIONES (deben crearse antes que cualquier tabla que las use)
  -- =========================================================================
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS "pg_trgm";
  CREATE EXTENSION IF NOT EXISTS "btree_gin";

  -- =========================================================================
  -- SCHEMAS
  -- =========================================================================
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE SCHEMA IF NOT EXISTS catalog;
  CREATE SCHEMA IF NOT EXISTS orders;
  CREATE SCHEMA IF NOT EXISTS payments;

  -- =========================================================================
  -- USUARIO: auth_user
  -- =========================================================================
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${AUTH_DB_USER}') THEN
      CREATE ROLE "${AUTH_DB_USER}" WITH LOGIN PASSWORD '${AUTH_DB_PASSWORD}';
      RAISE NOTICE 'Usuario ${AUTH_DB_USER} creado';
    ELSE
      ALTER ROLE "${AUTH_DB_USER}" WITH PASSWORD '${AUTH_DB_PASSWORD}';
      RAISE NOTICE 'Usuario ${AUTH_DB_USER} ya existía, contraseña actualizada';
    END IF;
  END
  \$\$;

  -- Revocar acceso a schemas de otros servicios
  REVOKE ALL ON SCHEMA public   FROM "${AUTH_DB_USER}";
  REVOKE ALL ON SCHEMA catalog  FROM "${AUTH_DB_USER}";
  REVOKE ALL ON SCHEMA orders   FROM "${AUTH_DB_USER}";
  REVOKE ALL ON SCHEMA payments FROM "${AUTH_DB_USER}";

  -- Dar acceso solo a su schema
  GRANT USAGE, CREATE ON SCHEMA auth TO "${AUTH_DB_USER}";
  GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA auth TO "${AUTH_DB_USER}";
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO "${AUTH_DB_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES    TO "${AUTH_DB_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO "${AUTH_DB_USER}";
  ALTER ROLE "${AUTH_DB_USER}" SET search_path TO auth, public;

  -- =========================================================================
  -- USUARIO: catalog_user
  -- =========================================================================
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${CATALOG_DB_USER}') THEN
      CREATE ROLE "${CATALOG_DB_USER}" WITH LOGIN PASSWORD '${CATALOG_DB_PASSWORD}';
      RAISE NOTICE 'Usuario ${CATALOG_DB_USER} creado';
    ELSE
      ALTER ROLE "${CATALOG_DB_USER}" WITH PASSWORD '${CATALOG_DB_PASSWORD}';
      RAISE NOTICE 'Usuario ${CATALOG_DB_USER} ya existía, contraseña actualizada';
    END IF;
  END
  \$\$;

  REVOKE ALL ON SCHEMA public   FROM "${CATALOG_DB_USER}";
  REVOKE ALL ON SCHEMA auth     FROM "${CATALOG_DB_USER}";
  REVOKE ALL ON SCHEMA orders   FROM "${CATALOG_DB_USER}";
  REVOKE ALL ON SCHEMA payments FROM "${CATALOG_DB_USER}";

  GRANT USAGE, CREATE ON SCHEMA catalog TO "${CATALOG_DB_USER}";
  GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA catalog TO "${CATALOG_DB_USER}";
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA catalog TO "${CATALOG_DB_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA catalog GRANT ALL ON TABLES    TO "${CATALOG_DB_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA catalog GRANT ALL ON SEQUENCES TO "${CATALOG_DB_USER}";
  ALTER ROLE "${CATALOG_DB_USER}" SET search_path TO catalog, public;

  -- =========================================================================
  -- USUARIO: order_user
  -- =========================================================================
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${ORDER_DB_USER}') THEN
      CREATE ROLE "${ORDER_DB_USER}" WITH LOGIN PASSWORD '${ORDER_DB_PASSWORD}';
      RAISE NOTICE 'Usuario ${ORDER_DB_USER} creado';
    ELSE
      ALTER ROLE "${ORDER_DB_USER}" WITH PASSWORD '${ORDER_DB_PASSWORD}';
      RAISE NOTICE 'Usuario ${ORDER_DB_USER} ya existía, contraseña actualizada';
    END IF;
  END
  \$\$;

  REVOKE ALL ON SCHEMA public   FROM "${ORDER_DB_USER}";
  REVOKE ALL ON SCHEMA auth     FROM "${ORDER_DB_USER}";
  REVOKE ALL ON SCHEMA catalog  FROM "${ORDER_DB_USER}";
  REVOKE ALL ON SCHEMA payments FROM "${ORDER_DB_USER}";

  GRANT USAGE, CREATE ON SCHEMA orders TO "${ORDER_DB_USER}";
  GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA orders TO "${ORDER_DB_USER}";
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA orders TO "${ORDER_DB_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA orders GRANT ALL ON TABLES    TO "${ORDER_DB_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA orders GRANT ALL ON SEQUENCES TO "${ORDER_DB_USER}";
  ALTER ROLE "${ORDER_DB_USER}" SET search_path TO orders, public;

  -- =========================================================================
  -- USUARIO: payment_user
  -- =========================================================================
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${PAYMENT_DB_USER}') THEN
      CREATE ROLE "${PAYMENT_DB_USER}" WITH LOGIN PASSWORD '${PAYMENT_DB_PASSWORD}';
      RAISE NOTICE 'Usuario ${PAYMENT_DB_USER} creado';
    ELSE
      ALTER ROLE "${PAYMENT_DB_USER}" WITH PASSWORD '${PAYMENT_DB_PASSWORD}';
      RAISE NOTICE 'Usuario ${PAYMENT_DB_USER} ya existía, contraseña actualizada';
    END IF;
  END
  \$\$;

  REVOKE ALL ON SCHEMA public  FROM "${PAYMENT_DB_USER}";
  REVOKE ALL ON SCHEMA auth    FROM "${PAYMENT_DB_USER}";
  REVOKE ALL ON SCHEMA catalog FROM "${PAYMENT_DB_USER}";
  REVOKE ALL ON SCHEMA orders  FROM "${PAYMENT_DB_USER}";

  GRANT USAGE, CREATE ON SCHEMA payments TO "${PAYMENT_DB_USER}";
  GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA payments TO "${PAYMENT_DB_USER}";
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA payments TO "${PAYMENT_DB_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA payments GRANT ALL ON TABLES    TO "${PAYMENT_DB_USER}";
  ALTER DEFAULT PRIVILEGES IN SCHEMA payments GRANT ALL ON SEQUENCES TO "${PAYMENT_DB_USER}";
  ALTER ROLE "${PAYMENT_DB_USER}" SET search_path TO payments, public;

  -- =========================================================================
  -- VERIFICACIÓN FINAL
  -- =========================================================================
  DO \$\$
  BEGIN
    RAISE NOTICE '=== BookStore DB Initialization Complete ===';
    RAISE NOTICE 'Schemas: auth, catalog, orders, payments';
    RAISE NOTICE 'Usuarios creados con contraseñas del entorno';
  END
  \$\$;

EOSQL

echo "=== BookStore: PostgreSQL configurado correctamente ==="