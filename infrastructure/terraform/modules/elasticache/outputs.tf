# =============================================================================
# modules/elasticache/outputs.tf
# =============================================================================

output "endpoint" {
  description = "Endpoint primario de Redis"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "port" {
  description = "Puerto de Redis"
  value       = aws_elasticache_replication_group.redis.port
}

output "replication_group_id" {
  description = "ID del replication group"
  value       = aws_elasticache_replication_group.redis.replication_group_id
}
