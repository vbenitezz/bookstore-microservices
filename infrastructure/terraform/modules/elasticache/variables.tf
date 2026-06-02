# =============================================================================
# modules/elasticache/variables.tf
# =============================================================================

variable "project_name" {
  description = "Nombre del proyecto"
  type        = string
}

variable "subnet_group_name" {
  description = "Nombre del subnet group para ElastiCache (creado en módulo VPC)"
  type        = string
}

variable "security_group_id" {
  description = "ID del Security Group de Redis"
  type        = string
}

variable "redis_node_type" {
  description = "Tipo de nodo para ElastiCache Redis"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_auth_token" {
  description = "Token de autenticación para Redis (mínimo 16 caracteres)"
  type        = string
  sensitive   = true
}
