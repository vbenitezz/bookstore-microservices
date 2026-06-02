# =============================================================================
# modules/rabbitmq-ec2/variables.tf
# =============================================================================

variable "project_name" {
  description = "Nombre del proyecto"
  type        = string
}

variable "subnet_id" {
  description = "ID de la subred privada de datos donde se despliega la EC2"
  type        = string
}

variable "security_group_id" {
  description = "ID del Security Group de RabbitMQ"
  type        = string
}

variable "instance_type" {
  description = "Tipo de instancia EC2"
  type        = string
  default     = "t3.small"
}

variable "ami_id" {
  description = "Amazon Linux 2"
  type        = string
  default     = "ami-046b36f55e189564a"
}

variable "key_pair_name" {
  description = "Nombre del key pair para acceso SSH (puede estar vacío)"
  type        = string
  default     = ""
}

variable "rabbitmq_username" {
  description = "Usuario administrador de RabbitMQ"
  type        = string
  sensitive   = true
}

variable "rabbitmq_password" {
  description = "Contraseña del administrador de RabbitMQ"
  type        = string
  sensitive   = true
}
