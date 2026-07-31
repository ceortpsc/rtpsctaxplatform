terraform {
  required_version = ">= 1.5.0"
}

variable "registry_port" {
  type    = number
  default = 4873
}

output "ross_infinite_registry_port" {
  value = var.registry_port
}

# Scaffold baseline — extend with cloud resources when credentials are provisioned.
