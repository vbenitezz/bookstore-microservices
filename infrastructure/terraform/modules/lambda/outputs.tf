output "api_endpoint" {
  description = "URL base del API Gateway"
  value       = "${aws_apigatewayv2_stage.prod.invoke_url}"
}

output "search_books_url" {
  description = "URL para buscar libros"
  value       = "${aws_apigatewayv2_stage.prod.invoke_url}/search"
}

output "order_summary_url" {
  description = "URL para el reporte de órdenes"
  value       = "${aws_apigatewayv2_stage.prod.invoke_url}/reports/orders"
}

output "search_books_arn" {
  value = aws_lambda_function.search_books.arn
}

output "order_summary_arn" {
  value = aws_lambda_function.order_summary.arn
}
