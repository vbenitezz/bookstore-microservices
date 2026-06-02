variable "project_name" {
  description = "Nombre del proyecto"
  type        = string
}

variable "vpc_id" {
  description = "ID de la VPC"
  type        = string
}

variable "subnet_ids" {
  description = "Subredes para las funciones Lambda"
  type        = list(string)
}

variable "lambda_sg_id" {
  description = "Security Group para Lambda"
  type        = string
}

variable "db_host" {
  description = "Host de RDS"
  type        = string
}

variable "db_name" {
  description = "Nombre de la base de datos"
  type        = string
}

variable "db_user_catalog" {
  description = "Usuario de catalog"
  type        = string
}

variable "db_password_catalog" {
  description = "Password de catalog_user"
  type        = string
  sensitive   = true
}

variable "db_user_orders" {
  description = "Usuario de orders"
  type        = string
}

variable "db_password_orders" {
  description = "Password de order_user"
  type        = string
  sensitive   = true
}
