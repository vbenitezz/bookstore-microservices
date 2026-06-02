# =============================================================================
# modules/security-groups/variables.tf
# =============================================================================

variable "project_name" {
  description = "Nombre del proyecto"
  type        = string
}

variable "vpc_id" {
  description = "ID de la VPC donde se crean los Security Groups"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR de la VPC — usado para reglas de acceso interno"
  type        = string
}
