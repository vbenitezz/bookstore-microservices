# =============================================================================
# modules/vpc/main.tf — VPC BookStore
#
# Recursos que crea este módulo:
#   1. VPC principal
#   2. Internet Gateway (para que las subredes públicas salgan a internet)
#   3. Subredes públicas     (2) — us-east-1a y us-east-1b
#   4. Subredes privadas EKS (2) — nodos del clúster
#   5. Subredes privadas data(2) — RDS, ElastiCache, RabbitMQ-EC2
#   6. Elastic IPs para los NAT Gateways
#   7. NAT Gateways          (2) — uno por AZ para alta disponibilidad
#   8. Route tables + asociaciones
#   9. Subnet groups para RDS y ElastiCache
# =============================================================================

# -----------------------------------------------------------------------------
# 1. VPC
# -----------------------------------------------------------------------------

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  # enable_dns_hostnames: necesario para que EKS asigne nombres DNS a los nodos
  # enable_dns_support:   necesario para resolución DNS dentro de la VPC
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
    # Tag requerido por EKS para descubrir la VPC automáticamente
    "kubernetes.io/cluster/${var.project_name}" = "shared"
  }
}

# -----------------------------------------------------------------------------
# 2. Internet Gateway
# Permite que las subredes públicas tengan acceso a internet.
# Los NAT Gateways lo usan para dar acceso saliente a las subredes privadas.
# -----------------------------------------------------------------------------

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# -----------------------------------------------------------------------------
# 3. Subredes públicas
# Una por AZ. Aquí viven: NAT Gateways, ALB (load balancer).
# Los pods de EKS NO van aquí — van en las subredes privadas EKS.
# -----------------------------------------------------------------------------

resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]

  # map_public_ip_on_launch: los recursos en esta subred reciben IP pública automáticamente
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${var.availability_zones[count.index]}"
    # Tag requerido por EKS para descubrir subredes públicas (ALB)
    "kubernetes.io/cluster/${var.project_name}" = "shared"
    "kubernetes.io/role/elb"                    = "1"
  }
}

# -----------------------------------------------------------------------------
# 4. Subredes privadas para nodos EKS
# Una por AZ. Los pods de Kubernetes corren aquí.
# Salen a internet a través del NAT Gateway de su misma AZ.
# -----------------------------------------------------------------------------

resource "aws_subnet" "private_eks" {
  count = length(var.private_eks_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_eks_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.project_name}-private-eks-${var.availability_zones[count.index]}"
    # Tag requerido por EKS para descubrir subredes privadas (nodos)
    "kubernetes.io/cluster/${var.project_name}" = "shared"
    "kubernetes.io/role/internal-elb"           = "1"
  }
}

# -----------------------------------------------------------------------------
# 5. Subredes privadas para datos
# Una por AZ. RDS, ElastiCache y EC2-RabbitMQ viven aquí.
# Completamente aisladas — no necesitan salida a internet.
# -----------------------------------------------------------------------------

resource "aws_subnet" "private_data" {
  count = length(var.private_data_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_data_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.project_name}-private-data-${var.availability_zones[count.index]}"
  }
}

# -----------------------------------------------------------------------------
# 6. Elastic IPs para los NAT Gateways
# Las EIPs son IPs públicas fijas asignadas a los NAT Gateways.
# Son las IPs desde las que salen los pods al internet.
# -----------------------------------------------------------------------------

resource "aws_eip" "nat" {
  count  = length(var.availability_zones)
  domain = "vpc"

  # La EIP depende del IGW — debe existir antes de crear la EIP
  depends_on = [aws_internet_gateway.main]

  tags = {
    Name = "${var.project_name}-nat-eip-${var.availability_zones[count.index]}"
  }
}

# -----------------------------------------------------------------------------
# 7. NAT Gateways — uno por AZ
# Permiten que los pods en subredes privadas salgan a internet
# (para descargar imágenes, llamar APIs externas, etc.)
# sin exponer los pods directamente a internet.
# -----------------------------------------------------------------------------

resource "aws_nat_gateway" "main" {
  count = length(var.availability_zones)

  # El NAT Gateway vive en la subred PÚBLICA de su AZ
  subnet_id     = aws_subnet.public[count.index].id
  allocation_id = aws_eip.nat[count.index].id

  tags = {
    Name = "${var.project_name}-nat-${var.availability_zones[count.index]}"
  }

  depends_on = [aws_internet_gateway.main]
}

# -----------------------------------------------------------------------------
# 8. Route Tables
# -----------------------------------------------------------------------------

# --- Route table pública ---
# Una sola route table para todas las subredes públicas.
# Todo el tráfico (0.0.0.0/0) sale por el Internet Gateway.

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-rt-public"
  }
}

# Asociar cada subred pública a la route table pública
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# --- Route tables privadas para EKS ---
# Una por AZ — cada una usa el NAT Gateway de su propia AZ.
# Si el NAT de us-east-1a falla, us-east-1b sigue funcionando
# porque tiene su propia route table apuntando a su propio NAT.

resource "aws_route_table" "private_eks" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = {
    Name = "${var.project_name}-rt-private-eks-${var.availability_zones[count.index]}"
  }
}

# Asociar cada subred privada EKS a su route table
resource "aws_route_table_association" "private_eks" {
  count = length(aws_subnet.private_eks)

  subnet_id      = aws_subnet.private_eks[count.index].id
  route_table_id = aws_route_table.private_eks[count.index].id
}

# --- Route tables privadas para datos ---
# Las subredes de datos NO necesitan salida a internet.
# Solo necesitan comunicarse con los pods de EKS dentro de la VPC.
# Por eso no tienen ruta a un NAT Gateway.

resource "aws_route_table" "private_data" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id

  # Sin ruta a internet — tráfico solo dentro de la VPC (local)
  tags = {
    Name = "${var.project_name}-rt-private-data-${var.availability_zones[count.index]}"
  }
}

# Asociar cada subred de datos a su route table
resource "aws_route_table_association" "private_data" {
  count = length(aws_subnet.private_data)

  subnet_id      = aws_subnet.private_data[count.index].id
  route_table_id = aws_route_table.private_data[count.index].id
}

# -----------------------------------------------------------------------------
# 9. Subnet Groups para servicios administrados
# RDS y ElastiCache requieren un "subnet group" que les indica
# en qué subredes pueden crear sus instancias.
# -----------------------------------------------------------------------------

resource "aws_db_subnet_group" "data" {
  name        = "${var.project_name}-db-subnet-group"
  description = "Subnet group para RDS PostgreSQL en subredes privadas de datos"
  subnet_ids  = aws_subnet.private_data[*].id

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

resource "aws_elasticache_subnet_group" "data" {
  name        = "${var.project_name}-cache-subnet-group"
  description = "Subnet group para ElastiCache Redis en subredes privadas de datos"
  subnet_ids  = aws_subnet.private_data[*].id

  tags = {
    Name = "${var.project_name}-cache-subnet-group"
  }
}