# =============================================================================
# modules/rabbitmq-ec2/outputs.tf
# =============================================================================

output "instance_id" {
  description = "ID de la instancia EC2 con RabbitMQ"
  value       = aws_instance.rabbitmq.id
}

output "private_ip" {
  description = "IP privada de la EC2 con RabbitMQ"
  value       = aws_instance.rabbitmq.private_ip
}

output "private_dns" {
  description = "DNS privado de la EC2 con RabbitMQ"
  value       = aws_instance.rabbitmq.private_dns
}

output "amqp_url" {
  description = "URL de conexión AMQP para los microservicios"
  value       = "amqp://${var.rabbitmq_username}:${var.rabbitmq_password}@${aws_instance.rabbitmq.private_ip}:5672/"
  sensitive   = true
}