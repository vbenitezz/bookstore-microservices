output "alb_sg_id" {
  description = "ID del Security Group del ALB"
  value       = aws_security_group.alb.id
}

output "eks_cluster_sg_id" {
  description = "ID del Security Group del API server EKS"
  value       = aws_security_group.eks_cluster.id
}

output "eks_node_sg_id" {
  description = "ID del Security Group de los nodos EKS"
  value       = aws_security_group.eks_node.id
}

output "rds_sg_id" {
  description = "ID del Security Group de RDS"
  value       = aws_security_group.rds.id
}

output "redis_sg_id" {
  description = "ID del Security Group de ElastiCache Redis"
  value       = aws_security_group.redis.id
}

output "rabbitmq_sg_id" {
  description = "ID del Security Group de la EC2 con RabbitMQ"
  value       = aws_security_group.rabbitmq.id
}

output "lambda_sg_id" {
  description = "ID del Security Group de Lambda"
  value       = aws_security_group.lambda.id
}