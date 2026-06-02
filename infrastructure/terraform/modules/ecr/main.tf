# =============================================================================
# modules/ecr/main.tf — Elastic Container Registry
#
# Crea un repositorio ECR por cada microservicio.
# Las imágenes Docker se suben aquí antes del despliegue en EKS.
# =============================================================================

resource "aws_ecr_repository" "services" {
  for_each = toset(var.services)

  name                 = "${var.project_name}/${each.key}"
  image_tag_mutability = "MUTABLE"

  # Escaneo de vulnerabilidades automático al subir imágenes
  image_scanning_configuration {
    scan_on_push = true
  }

  # Cifrado de imágenes en reposo
  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name    = "${var.project_name}-${each.key}"
    Service = each.key
  }
}

# Política de ciclo de vida — mantener solo las últimas 5 imágenes
# para controlar el uso de almacenamiento en ECR
resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Mantener solo las ultimas 5 imagenes"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = {
        type = "expire"
      }
    }]
  })
}
