# =============================================================================
# modules/rabbitmq-ec2/main.tf — EC2 con RabbitMQ
#
# AWS Academy no permite crear ni taggear recursos IAM.
# Usamos LabInstanceProfile que Academy pre-crea en todas las cuentas.
# No se define ningún recurso aws_iam_* en este módulo.
# =============================================================================

resource "aws_instance" "rabbitmq" {
  ami           = var.ami_id
  instance_type = var.instance_type

  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [var.security_group_id]
  associate_public_ip_address = false

  iam_instance_profile = "LabInstanceProfile"

  key_name = var.key_pair_name != "" ? var.key_pair_name : null

  user_data = templatefile("${path.module}/user_data.sh", {
    rabbitmq_username = var.rabbitmq_username
    rabbitmq_password = var.rabbitmq_password
  })

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    encrypted             = true
    delete_on_termination = true
  }

  user_data_replace_on_change = true

  tags = {
    Name = "${var.project_name}-rabbitmq"
  }
}