# =============================================================================
# modules/rds/variables.tf
# =============================================================================

variable "project_name" {
  description = "Nombre del proyecto"
  type        = string
}

variable "db_subnet_group_name" {
  description = "Nombre del subnet group para RDS (creado en el módulo VPC)"
  type        = string
}

variable "db_security_group_id" {
  description = "ID del Security Group de RDS"
  type        = string
}

variable "db_instance_class" {
  description = "Tipo de instancia RDS"
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Nombre de la base de datos principal"
  type        = string
  default     = "bookstore_main"
}

variable "db_username" {
  description = "Usuario administrador de RDS"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Contraseña del administrador de RDS"
  type        = string
  sensitive   = true
}
