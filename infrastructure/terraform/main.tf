# =============================================================================
# main.tf — Punto de entrada principal de Terraform
#
# Este archivo orquesta todos los módulos en el orden correcto.
# Cada módulo recibe los outputs del módulo anterior como inputs.
#
# Orden de dependencias:
#   vpc → security-groups → rds + elasticache + rabbitmq-ec2 → eks → ecr
# =============================================================================

# --- Módulo VPC ---
# Primer módulo en ejecutarse — todos los demás dependen de él
module "vpc" {
  source = "./modules/vpc"

  project_name              = var.project_name
  environment               = var.environment
  vpc_cidr                  = var.vpc_cidr
  availability_zones        = var.availability_zones
  public_subnet_cidrs       = var.public_subnet_cidrs
  private_eks_subnet_cidrs  = var.private_eks_subnet_cidrs
  private_data_subnet_cidrs = var.private_data_subnet_cidrs
  aws_region                = var.aws_region
}

# Los siguientes módulos se activarán fase por fase.
# Están comentados para que la Fase 1 solo despliegue la VPC.

# --- Módulo Security Groups (Fase 2) ---
module "security_groups" {
  source = "./modules/security-groups"

  project_name = var.project_name
  vpc_id       = module.vpc.vpc_id
  vpc_cidr     = var.vpc_cidr
}

# --- Módulo RDS (Fase 3) ---
module "rds" {
  source = "./modules/rds"

  project_name         = var.project_name
  db_subnet_group_name = module.vpc.db_subnet_group_name
  db_security_group_id = module.security_groups.rds_sg_id
  db_instance_class    = var.db_instance_class
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = var.db_password
}

# --- Módulo ElastiCache (Fase 3) ---
module "elasticache" {
  source = "./modules/elasticache"

  project_name      = var.project_name
  subnet_group_name = module.vpc.elasticache_subnet_group_name
  security_group_id = module.security_groups.redis_sg_id
  redis_node_type   = var.redis_node_type
  redis_auth_token  = var.redis_auth_token
}

# --- Módulo RabbitMQ EC2 (Fase 3) ---
module "rabbitmq_ec2" {
  source = "./modules/rabbitmq-ec2"

  project_name      = var.project_name
  subnet_id         = module.vpc.private_data_subnet_ids[0]
  security_group_id = module.security_groups.rabbitmq_sg_id
  instance_type     = var.rabbitmq_instance_type
  ami_id            = var.rabbitmq_ami_id
  key_pair_name     = var.key_pair_name
  rabbitmq_username = var.rabbitmq_username
  rabbitmq_password = var.rabbitmq_password
}

# --- Módulo Lambda + API Gateway ---
module "lambda" {
  source = "./modules/lambda"

  project_name        = var.project_name
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_eks_subnet_ids
  lambda_sg_id        = module.security_groups.lambda_sg_id
  db_host             = module.rds.host
  db_name             = var.db_name
  db_user_catalog     = "catalog_user"
  db_password_catalog = var.catalog_db_password
  db_user_orders      = "order_user"
  db_password_orders  = var.order_db_password
}
module "eks" {
  source = "./modules/eks"

  project_name              = var.project_name
  cluster_version           = var.eks_cluster_version
  private_subnet_ids        = module.vpc.private_eks_subnet_ids
  cluster_security_group_id = module.security_groups.eks_cluster_sg_id
  node_security_group_id    = module.security_groups.eks_node_sg_id
  node_instance_type        = var.eks_node_instance_type
  node_min_size             = var.eks_node_min_size
  node_max_size             = var.eks_node_max_size
  node_desired_size         = var.eks_node_desired_size
}

# --- Módulo ECR (Fase 4) ---
module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
  services     = ["auth-service", "catalog-service", "cart-service", "order-service"]
}
