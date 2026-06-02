# =============================================================================
# modules/vpc/variables.tf
# =============================================================================

variable "project_name" {
  description = "Nombre del proyecto — usado como prefijo en los recursos"
  type        = string
}

variable "environment" {
  description = "Entorno de despliegue"
  type        = string
}

variable "vpc_cidr" {
  description = "Bloque CIDR de la VPC"
  type        = string
}

variable "availability_zones" {
  description = "Lista de zonas de disponibilidad"
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "CIDRs de las subredes públicas"
  type        = list(string)
}

variable "private_eks_subnet_cidrs" {
  description = "CIDRs de las subredes privadas para nodos EKS"
  type        = list(string)
}

variable "private_data_subnet_cidrs" {
  description = "CIDRs de las subredes privadas para RDS, ElastiCache y RabbitMQ"
  type        = list(string)
}

variable "aws_region" {
  description = "Región de AWS"
  type        = string
  default     = "us-east-1"
}
