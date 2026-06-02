# =============================================================================
# modules/rds/outputs.tf
# =============================================================================

output "endpoint" {
  description = "Endpoint de conexión a RDS (host:puerto)"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "host" {
  description = "Host de RDS (sin puerto)"
  value       = aws_db_instance.postgres.address
  sensitive   = true
}

output "port" {
  description = "Puerto de RDS"
  value       = aws_db_instance.postgres.port
}

output "db_name" {
  description = "Nombre de la base de datos"
  value       = aws_db_instance.postgres.db_name
}

output "instance_id" {
  description = "Identificador de la instancia RDS"
  value       = aws_db_instance.postgres.identifier
}
