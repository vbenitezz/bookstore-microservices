# =============================================================================
# modules/lambda/main.tf
# Dos funciones Lambda + API Gateway HTTP API
# psycopg2 incluido directamente en el ZIP (no layer externo)
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
}

# =============================================================================
# Lambda 1 — search-books
# =============================================================================

resource "aws_lambda_function" "search_books" {
  function_name = "${var.project_name}-search-books"
  description   = "Búsqueda de libros en el catálogo BookStore"
  role          = "arn:aws:iam::${local.account_id}:role/LabRole"

  filename         = "${path.root}/../../lambda/search-books/function.zip"
  source_code_hash = filebase64sha256("${path.root}/../../lambda/search-books/function.zip")
  runtime          = "python3.11"
  handler          = "handler.lambda_handler"
  timeout          = 30
  memory_size      = 256

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.lambda_sg_id]
  }

  environment {
    variables = {
      DB_HOST     = var.db_host
      DB_PORT     = "5432"
      DB_NAME     = var.db_name
      DB_USER     = var.db_user_catalog
      DB_PASSWORD = var.db_password_catalog
      DB_SSL      = "true"
    }
  }

  tags = { Name = "${var.project_name}-search-books" }
}

# =============================================================================
# Lambda 2 — order-summary
# =============================================================================

resource "aws_lambda_function" "order_summary" {
  function_name = "${var.project_name}-order-summary"
  description   = "Resumen estadístico de órdenes BookStore"
  role          = "arn:aws:iam::${local.account_id}:role/LabRole"

  filename         = "${path.root}/../../lambda/order-summary/function.zip"
  source_code_hash = filebase64sha256("${path.root}/../../lambda/order-summary/function.zip")
  runtime          = "python3.11"
  handler          = "handler.lambda_handler"
  timeout          = 30
  memory_size      = 256

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.lambda_sg_id]
  }

  environment {
    variables = {
      DB_HOST     = var.db_host
      DB_PORT     = "5432"
      DB_NAME     = var.db_name
      DB_USER     = var.db_user_orders
      DB_PASSWORD = var.db_password_orders
      DB_SSL      = "true"
    }
  }

  tags = { Name = "${var.project_name}-order-summary" }
}

# =============================================================================
# API Gateway HTTP API
# =============================================================================

resource "aws_apigatewayv2_api" "bookstore" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"
  description   = "BookStore Serverless API"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
  }

  tags = { Name = "${var.project_name}-api" }
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.bookstore.id
  name        = "prod"
  auto_deploy = true

  tags = { Name = "${var.project_name}-api-prod" }
}

resource "aws_apigatewayv2_integration" "search_books" {
  api_id                 = aws_apigatewayv2_api.bookstore.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.search_books.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "order_summary" {
  api_id                 = aws_apigatewayv2_api.bookstore.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.order_summary.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "search_books" {
  api_id    = aws_apigatewayv2_api.bookstore.id
  route_key = "GET /search"
  target    = "integrations/${aws_apigatewayv2_integration.search_books.id}"
}

resource "aws_apigatewayv2_route" "order_summary" {
  api_id    = aws_apigatewayv2_api.bookstore.id
  route_key = "GET /reports/orders"
  target    = "integrations/${aws_apigatewayv2_integration.order_summary.id}"
}

resource "aws_lambda_permission" "search_books" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.search_books.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.bookstore.execution_arn}/*/*"
}

resource "aws_lambda_permission" "order_summary" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.order_summary.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.bookstore.execution_arn}/*/*"
}