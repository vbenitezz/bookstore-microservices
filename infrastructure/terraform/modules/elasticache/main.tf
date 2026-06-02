# =============================================================================
# modules/elasticache/main.tf — ElastiCache Redis
#
# Configuración:
#   - Motor: Redis 7.x
#   - Modo: cluster deshabilitado (replication group de 1 nodo)
#   - TLS: habilitado (transit encryption)
#   - Auth token: requerido para autenticación
#   - Backups: 1 día de retención
#
# Nota sobre AWS Academy:
#   Se usa un replication group de 1 nodo (sin réplicas de lectura)
#   para minimizar costos y evitar restricciones de cuota.
# =============================================================================

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.project_name}-redis"
  description          = "Redis para BookStore Cart Service"

  # Motor
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  port                 = 6379

  # Número de nodos — 1 primario, sin réplicas (AWS Academy)
  num_cache_clusters = 1

  # Red
  subnet_group_name  = var.subnet_group_name
  security_group_ids = [var.security_group_id]

  # Seguridad
  # at_rest_encryption_enabled: cifra los datos en disco
  at_rest_encryption_enabled = true
  # transit_encryption_enabled: cifra la comunicación entre cliente y Redis
  # Requerido para usar auth_token
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  # Backups
  snapshot_retention_limit = 1
  snapshot_window          = "03:00-04:00"

  # Actualizaciones automáticas
  auto_minor_version_upgrade = true
  maintenance_window         = "sun:04:00-sun:05:00"

  # Protección contra borrado (false para facilitar limpieza en Academy)
  final_snapshot_identifier = null
  apply_immediately         = true

  tags = {
    Name = "${var.project_name}-redis"
  }
}
