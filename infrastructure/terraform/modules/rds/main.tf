# =============================================================================
# modules/rds/main.tf — RDS PostgreSQL
#
# Configuración:
#   - Motor: PostgreSQL 16
#   - Multi-AZ: false (AWS Academy tiene restricciones de cuota)
#   - Storage: 20 GB gp2 con autoescalado hasta 100 GB
#   - Backups: 7 días de retención
#   - Cifrado: habilitado
#   - Deletion protection: false (facilita limpieza en Academy)
#
# Nota sobre los schemas:
#   RDS crea la base de datos 'bookstore_main'.
#   Los schemas (auth, catalog, orders, payments) y usuarios por schema
#   se crean via el script postgres-init.sh que se ejecuta desde
#   un Job de Kubernetes después del despliegue — no desde Terraform,
#   porque Terraform no tiene acceso directo a la DB desde fuera de la VPC.
# =============================================================================

# Grupo de parámetros personalizado para PostgreSQL
# Permite configurar parámetros del motor que no están disponibles
# en el grupo de parámetros por defecto.

resource "aws_db_parameter_group" "postgres" {
  name        = "${var.project_name}-postgres16"
  family      = "postgres16"
  description = "Parametros para BookStore PostgreSQL 16"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = {
    Name = "${var.project_name}-postgres16-params"
  }
}

resource "aws_db_instance" "postgres" {
  identifier = "${var.project_name}-postgres"

  engine         = "postgres"
  # Solo el major version — AWS selecciona el minor más reciente disponible
  engine_version = "16"
  instance_class = var.db_instance_class

  parameter_group_name = aws_db_parameter_group.postgres.name

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp2"
  storage_encrypted     = true

  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = [var.db_security_group_id]
  publicly_accessible    = false

  multi_az = false

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  auto_minor_version_upgrade = true
  deletion_protection        = false
  skip_final_snapshot        = true

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Name = "${var.project_name}-postgres"
  }
}