# =============================================================================
# modules/ecr/outputs.tf
# =============================================================================

output "repository_urls" {
  description = "URLs de los repositorios ECR por servicio"
  value = {
    for name, repo in aws_ecr_repository.services :
    name => repo.repository_url
  }
}

output "registry_id" {
  description = "ID del registro ECR (account ID)"
  value       = values(aws_ecr_repository.services)[0].registry_id
}
