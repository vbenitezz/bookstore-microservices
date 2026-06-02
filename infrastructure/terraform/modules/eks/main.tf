# =============================================================================
# modules/eks/main.tf — Cluster EKS
#
# AWS Academy no permite crear IAM Roles (iam:CreateRole bloqueado).
# Usamos el LabRole pre-existente de Academy para:
#   - El cluster EKS (control plane)
#   - El node group (nodos EC2)
#
# El LabRole en AWS Academy ya tiene los permisos necesarios para EKS:
#   - AmazonEKSClusterPolicy
#   - AmazonEKSWorkerNodePolicy
#   - AmazonEKS_CNI_Policy
#   - AmazonEC2ContainerRegistryReadOnly
# =============================================================================

# =============================================================================
# modules/eks/main.tf — Cluster EKS
#
# Corrección: agregar access_config con authentication_mode = "API_AND_CONFIG_MAP"
# para habilitar aws_eks_access_entry y aws_eks_access_policy_association.
# =============================================================================

data "aws_caller_identity" "current" {}

locals {
  lab_role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/LabRole"
}

# =============================================================================
# Cluster EKS
# =============================================================================

resource "aws_eks_cluster" "main" {
  name     = var.project_name
  version  = var.cluster_version
  role_arn = local.lab_role_arn

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    security_group_ids      = [var.cluster_security_group_id]
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs     = ["0.0.0.0/0"]
  }

  # Habilitar modo API para poder usar access entries
  # Sin esto, aws_eks_access_entry falla con InvalidRequestException
  access_config {
    authentication_mode                         = "API_AND_CONFIG_MAP"
    bootstrap_cluster_creator_admin_permissions = true
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator"]

  tags = {
    Name = "${var.project_name}-eks-cluster"
  }
}

# =============================================================================
# Node Group
# =============================================================================

resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.project_name}-nodes"
  node_role_arn   = local.lab_role_arn
  subnet_ids      = var.private_subnet_ids

  instance_types = [var.node_instance_type]
  capacity_type  = "ON_DEMAND"
  disk_size      = 20
  ami_type       = "AL2_x86_64"

  scaling_config {
    min_size     = var.node_min_size
    max_size     = var.node_max_size
    desired_size = var.node_desired_size
  }

  update_config {
    max_unavailable = 1
  }

  force_update_version = false

  tags = {
    Name = "${var.project_name}-eks-nodes"
    "k8s.io/cluster-autoscaler/${var.project_name}" = "owned"
    "k8s.io/cluster-autoscaler/enabled"             = "true"
  }

  depends_on = [aws_eks_cluster.main]
}

# =============================================================================
# Access Entry — permite que LabRole administre el clúster via kubectl
# Requiere authentication_mode = "API" o "API_AND_CONFIG_MAP"
# =============================================================================

resource "aws_eks_access_entry" "lab_role" {
  cluster_name  = aws_eks_cluster.main.name
  principal_arn = local.lab_role_arn
  type          = "STANDARD"

  depends_on = [aws_eks_cluster.main]
}

resource "aws_eks_access_policy_association" "lab_role_admin" {
  cluster_name  = aws_eks_cluster.main.name
  principal_arn = local.lab_role_arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }

  depends_on = [aws_eks_access_entry.lab_role]
}