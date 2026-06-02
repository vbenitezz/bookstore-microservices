# =============================================================================
# modules/vpc/outputs.tf
# Los outputs de este módulo son los inputs de todos los demás módulos.
# =============================================================================

output "vpc_id" {
  description = "ID de la VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block de la VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs de las subredes públicas"
  value       = aws_subnet.public[*].id
}

output "private_eks_subnet_ids" {
  description = "IDs de las subredes privadas para nodos EKS"
  value       = aws_subnet.private_eks[*].id
}

output "private_data_subnet_ids" {
  description = "IDs de las subredes privadas para RDS, ElastiCache y RabbitMQ"
  value       = aws_subnet.private_data[*].id
}

output "nat_gateway_ids" {
  description = "IDs de los NAT Gateways"
  value       = aws_nat_gateway.main[*].id
}

output "nat_gateway_ips" {
  description = "IPs públicas de los NAT Gateways"
  value       = aws_eip.nat[*].public_ip
}

output "internet_gateway_id" {
  description = "ID del Internet Gateway"
  value       = aws_internet_gateway.main.id
}

output "db_subnet_group_name" {
  description = "Nombre del subnet group para RDS"
  value       = aws_db_subnet_group.data.name
}

output "elasticache_subnet_group_name" {
  description = "Nombre del subnet group para ElastiCache"
  value       = aws_elasticache_subnet_group.data.name
}
