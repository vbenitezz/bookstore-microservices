# =============================================================================
# modules/eks/variables.tf
# =============================================================================

variable "project_name" {
  description = "Nombre del proyecto"
  type        = string
}

variable "cluster_version" {
  description = "Versión de Kubernetes"
  type        = string
  default     = "1.29"
}

variable "private_subnet_ids" {
  description = "IDs de las subredes privadas EKS para los nodos"
  type        = list(string)
}

variable "cluster_security_group_id" {
  description = "ID del Security Group del API server EKS"
  type        = string
}

variable "node_security_group_id" {
  description = "ID del Security Group de los nodos EKS"
  type        = string
}

variable "node_instance_type" {
  description = "Tipo de instancia para los nodos"
  type        = string
  default     = "t3.medium"
}

variable "node_min_size" {
  description = "Número mínimo de nodos"
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Número máximo de nodos"
  type        = number
  default     = 4
}

variable "node_desired_size" {
  description = "Número deseado de nodos"
  type        = number
  default     = 2
}
