# =============================================================================
# modules/ecr/variables.tf
# =============================================================================

variable "project_name" {
  description = "Nombre del proyecto"
  type        = string
}

variable "services" {
  description = "Lista de microservicios que necesitan repositorio ECR"
  type        = list(string)
  default     = ["auth-service", "catalog-service", "cart-service", "order-service"]
}
