# =============================================================================
# versions.tf — Versiones de Terraform y providers
#
# Siempre fijar versiones exactas en producción para evitar que una
# actualización automática rompa la infraestructura.
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.30"
    }
  }

  # Backend S3 para guardar el estado de Terraform de forma remota.
  # Descomenta esto en Fase 4 cuando tengas el bucket S3 creado.
  # El estado remoto permite que múltiples personas trabajen en la
  # misma infraestructura sin conflictos.
  #
  # backend "s3" {
  #   bucket         = "bookstore-terraform-state"
  #   key            = "bookstore/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  # Tags que se aplican automáticamente a TODOS los recursos creados.
  # Facilita el filtrado y control de costos en la consola de AWS.
  default_tags {
    tags = {
      Project     = "bookstore"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
