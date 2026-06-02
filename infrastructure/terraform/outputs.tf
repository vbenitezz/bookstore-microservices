# =============================================================================
# outputs.tf — Outputs del root module
#
# Estos valores se muestran al final de cada `terraform apply`.
# Son útiles para copiar endpoints y IDs que necesitan otros sistemas.
# =============================================================================

# --- VPC ---

output "vpc_id" {
  description = "ID de la VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr" {
  description = "CIDR block de la VPC"
  value       = module.vpc.vpc_cidr
}

output "public_subnet_ids" {
  description = "IDs de las subredes públicas"
  value       = module.vpc.public_subnet_ids
}

output "private_eks_subnet_ids" {
  description = "IDs de las subredes privadas para nodos EKS"
  value       = module.vpc.private_eks_subnet_ids
}

output "private_data_subnet_ids" {
  description = "IDs de las subredes privadas para RDS, ElastiCache y RabbitMQ"
  value       = module.vpc.private_data_subnet_ids
}

output "nat_gateway_ips" {
  description = "IPs públicas de los NAT Gateways"
  value       = module.vpc.nat_gateway_ips
}

# Los siguientes outputs se activarán fase por fase

# --- Security Groups (Fase 2) ---
output "alb_sg_id" {
  description = "ID del Security Group del ALB"
  value       = module.security_groups.alb_sg_id
}

output "eks_node_sg_id" {
  description = "ID del Security Group de los nodos EKS"
  value       = module.security_groups.eks_node_sg_id
}

output "rds_sg_id" {
  description = "ID del Security Group de RDS"
  value       = module.security_groups.rds_sg_id
}

output "redis_sg_id" {
  description = "ID del Security Group de Redis"
  value       = module.security_groups.redis_sg_id
}

output "rabbitmq_sg_id" {
  description = "ID del Security Group de RabbitMQ"
  value       = module.security_groups.rabbitmq_sg_id
}

# --- RDS (Fase 3) ---
output "rds_host" {
  description = "Host de RDS PostgreSQL"
  value       = module.rds.host
  sensitive   = true
}

output "rds_port" {
  description = "Puerto de RDS"
  value       = module.rds.port
}

output "rds_db_name" {
  description = "Nombre de la base de datos"
  value       = module.rds.db_name
}

# --- ElastiCache (Fase 3) ---
output "redis_endpoint" {
  description = "Endpoint de ElastiCache Redis"
  value       = module.elasticache.endpoint
  sensitive   = true
}

output "redis_port" {
  description = "Puerto de Redis"
  value       = module.elasticache.port
}

# --- RabbitMQ EC2 (Fase 3) ---
output "rabbitmq_private_ip" {
  description = "IP privada de la EC2 con RabbitMQ"
  value       = module.rabbitmq_ec2.private_ip
}

output "rabbitmq_amqp_url" {
  description = "URL AMQP para los microservicios"
  value       = module.rabbitmq_ec2.amqp_url
  sensitive   = true
}

# --- Lambda + API Gateway ---
output "api_gateway_url" {
  description = "URL base del API Gateway"
  value       = module.lambda.api_endpoint
}

output "search_books_url" {
  description = "URL para buscar libros: GET /search?q=texto"
  value       = module.lambda.search_books_url
}

output "order_summary_url" {
  description = "URL para reporte de órdenes: GET /reports/orders"
  value       = module.lambda.order_summary_url
}
output "eks_cluster_name" {
  description = "Nombre del clúster EKS"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "Endpoint del API server de EKS"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "eks_cluster_version" {
  description = "Versión de Kubernetes"
  value       = module.eks.cluster_version
}

# --- ECR (Fase 4) ---
output "ecr_repository_urls" {
  description = "URLs de los repositorios ECR"
  value       = module.ecr.repository_urls
}
