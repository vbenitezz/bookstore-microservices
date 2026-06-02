#!/bin/bash
# =============================================================================
# user_data.sh — Instalación y configuración de RabbitMQ en Amazon Linux 2023
#
# Este script se ejecuta automáticamente cuando la EC2 arranca por primera vez.
# Los placeholders ${rabbitmq_username} y ${rabbitmq_password} son reemplazados
# por Terraform usando templatefile() antes de enviarse a la instancia.
#
# Tiempo estimado de ejecución: 3-5 minutos
# Logs disponibles en: /var/log/user-data.log
# =============================================================================

set -e
exec > /var/log/user-data.log 2>&1

echo "=== Inicio instalación RabbitMQ - $(date) ==="

# --- Actualizar el sistema ---
dnf update -y

# --- Instalar Erlang (requerido por RabbitMQ) ---
# RabbitMQ requiere Erlang. Usamos el repositorio oficial de RabbitMQ
# que incluye la versión correcta de Erlang compatible.

# Importar claves GPG
rpm --import https://github.com/rabbitmq/signing-keys/releases/download/3.0/cloudsmith.rabbitmq-erlang.E495BB49CC4BBE5B.key
rpm --import https://github.com/rabbitmq/signing-keys/releases/download/3.0/cloudsmith.rabbitmq-server.9F4587F226208342.key

# Configurar repositorio de Erlang
cat > /etc/yum.repos.d/rabbitmq-erlang.repo << 'REPO'
[rabbitmq-erlang]
name=rabbitmq-erlang
baseurl=https://yum1.rabbitmq.com/erlang/el/8/$basearch
repo_gpgcheck=1
enabled=1
gpgkey=https://github.com/rabbitmq/signing-keys/releases/download/3.0/cloudsmith.rabbitmq-erlang.E495BB49CC4BBE5B.key
gpgcheck=1
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
metadata_expire=300
pkg_gpgcheck=1
autorefresh=1
type=rpm-md
REPO

# Configurar repositorio de RabbitMQ
cat > /etc/yum.repos.d/rabbitmq-server.repo << 'REPO'
[rabbitmq-server]
name=rabbitmq-server
baseurl=https://yum2.rabbitmq.com/rabbitmq/el/8/$basearch
repo_gpgcheck=1
enabled=1
gpgkey=https://github.com/rabbitmq/signing-keys/releases/download/3.0/cloudsmith.rabbitmq-server.9F4587F226208342.key
gpgcheck=1
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
metadata_expire=300
pkg_gpgcheck=1
autorefresh=1
type=rpm-md
REPO

# Instalar Erlang y RabbitMQ
dnf install -y erlang rabbitmq-server

echo "=== RabbitMQ instalado correctamente ==="

# --- Habilitar y arrancar RabbitMQ ---
systemctl enable rabbitmq-server
systemctl start rabbitmq-server

# Esperar a que RabbitMQ esté listo
sleep 15

# --- Habilitar Management Plugin ---
# Permite acceder a la UI de administración en el puerto 15672
rabbitmq-plugins enable rabbitmq_management

# --- Configurar usuario administrador ---
# Eliminar el usuario guest por defecto (seguridad)
rabbitmqctl delete_user guest || true

# Crear el usuario administrador con las credenciales del .tfvars
rabbitmqctl add_user "${rabbitmq_username}" "${rabbitmq_password}"
rabbitmqctl set_user_tags "${rabbitmq_username}" administrator
rabbitmqctl set_permissions -p "/" "${rabbitmq_username}" ".*" ".*" ".*"

echo "=== Usuario ${rabbitmq_username} creado ==="

# --- Configurar RabbitMQ ---
cat > /etc/rabbitmq/rabbitmq.conf << 'CONF'
# Escuchar en todas las interfaces
listeners.tcp.default = 5672

# Management plugin
management.tcp.port = 15672

# Logs
log.file.level = info

# Memoria — usar máximo 60% de la RAM disponible
vm_memory_high_watermark.relative = 0.6

# Disk — alertar cuando quede menos de 1 GB libre
disk_free_limit.absolute = 1GB

# Heartbeat — detectar conexiones perdidas
heartbeat = 60
CONF

# Reiniciar para aplicar la configuración
systemctl restart rabbitmq-server

sleep 10

# --- Crear exchanges que necesitan los servicios ---
# Los exchanges se crean aquí para que estén disponibles
# desde el primer momento que los servicios conecten.
rabbitmqadmin declare exchange \
  name=bookstore.orders \
  type=topic \
  durable=true \
  --username="${rabbitmq_username}" \
  --password="${rabbitmq_password}" || true

rabbitmqadmin declare exchange \
  name=bookstore.payments \
  type=topic \
  durable=true \
  --username="${rabbitmq_username}" \
  --password="${rabbitmq_password}" || true

echo "=== Exchanges creados ==="

# --- Verificar estado final ---
systemctl status rabbitmq-server
rabbitmqctl status

echo "=== Instalación completada - $(date) ==="
