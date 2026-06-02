# =============================================================================
# variables.tf — Variables globales de Terraform
#
# Los valores reales van en terraform.tfvars (nunca en este archivo).
# Este archivo solo define el tipo, descripción y valor por defecto.
# =============================================================================

variable "aws_region" {
  description = "Región de AWS donde se despliega la infraestructura"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Entorno de despliegue"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "El entorno debe ser development, staging o production."
  }
}

variable "project_name" {
  description = "Nombre del proyecto — se usa como prefijo en todos los recursos"
  type        = string
  default     = "bookstore"
}

# --- VPC ---

variable "vpc_cidr" {
  description = "Bloque CIDR de la VPC"
  type        = string
  default     = "172.16.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDRs de las subredes públicas (una por AZ)"
  type        = list(string)
  default     = ["172.16.1.0/24", "172.16.4.0/24"]
}

variable "private_eks_subnet_cidrs" {
  description = "CIDRs de las subredes privadas para nodos EKS (una por AZ)"
  type        = list(string)
  default     = ["172.16.2.0/24", "172.16.5.0/24"]
}

variable "private_data_subnet_cidrs" {
  description = "CIDRs de las subredes privadas para RDS, ElastiCache y RabbitMQ (una por AZ)"
  type        = list(string)
  default     = ["172.16.3.0/24", "172.16.6.0/24"]
}

variable "availability_zones" {
  description = "Zonas de disponibilidad a usar"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "catalog_db_password" {
  description = "Contraseña del usuario catalog_user"
  type        = string
  sensitive   = true
}

variable "order_db_password" {
  description = "Contraseña del usuario order_user"
  type        = string
  sensitive   = true
}

# --- EKS ---

variable "eks_cluster_version" {
  description = "Versión de Kubernetes para el clúster EKS"
  type        = string
  default     = "1.29"
}

variable "eks_node_instance_type" {
  description = "Tipo de instancia para los nodos del clúster"
  type        = string
  default     = "t3.medium"
}

variable "eks_node_min_size" {
  description = "Número mínimo de nodos"
  type        = number
  default     = 2
}

variable "eks_node_max_size" {
  description = "Número máximo de nodos"
  type        = number
  default     = 4
}

variable "eks_node_desired_size" {
  description = "Número deseado de nodos"
  type        = number
  default     = 2
}

# --- RDS ---

variable "db_instance_class" {
  description = "Tipo de instancia para RDS PostgreSQL"
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Nombre de la base de datos"
  type        = string
  default     = "bookstore_main"
}

variable "db_username" {
  description = "Usuario administrador de RDS"
  type        = string
  default     = "bookstore_admin"
  sensitive   = true
}

variable "db_password" {
  description = "Contraseña del administrador de RDS"
  type        = string
  sensitive   = true
  # Sin default — DEBE definirse en terraform.tfvars
}

# --- ElastiCache ---

variable "redis_node_type" {
  description = "Tipo de nodo para ElastiCache Redis"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_auth_token" {
  description = "Token de autenticación para Redis"
  type        = string
  sensitive   = true
  # Sin default — DEBE definirse en terraform.tfvars
}

# --- RabbitMQ EC2 ---

variable "rabbitmq_instance_type" {
  description = "Tipo de instancia EC2 para RabbitMQ"
  type        = string
  default     = "t3.small"
}

variable "rabbitmq_ami_id" {
  description = "AMI ID para la EC2 de RabbitMQ (Amazon Linux 2023)"
  type        = string
  default     = "ami-0c101f26f147fa7fd" # Amazon Linux 2023 en us-east-1
}

variable "rabbitmq_username" {
  description = "Usuario administrador de RabbitMQ"
  type        = string
  default     = "bookstore"
  sensitive   = true
}

variable "rabbitmq_password" {
  description = "Contraseña del administrador de RabbitMQ"
  type        = string
  sensitive   = true
  # Sin default — DEBE definirse en terraform.tfvars
}

variable "key_pair_name" {
  description = "Nombre del key pair de AWS para acceder a la EC2 de RabbitMQ"
  type        = string
  default     = ""
}
