variable "environment" {
  type = string
}

variable "service_name" {
  type = string
}

resource "null_resource" "platform_service" {
  triggers = {
    environment  = var.environment
    service_name = var.service_name
  }
}
