# =============================================================================
# modules/eks/outputs.tf
# =============================================================================

output "cluster_name" {
  description = "Nombre del clúster EKS"
  value       = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  description = "Endpoint del API server de EKS"
  value       = aws_eks_cluster.main.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "Certificado CA del clúster (base64)"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "cluster_version" {
  description = "Versión de Kubernetes del clúster"
  value       = aws_eks_cluster.main.version
}

output "node_group_name" {
  description = "Nombre del node group"
  value       = aws_eks_node_group.main.node_group_name
}

output "node_group_status" {
  description = "Estado del node group"
  value       = aws_eks_node_group.main.status
}
