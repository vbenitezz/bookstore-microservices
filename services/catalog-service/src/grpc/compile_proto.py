#!/usr/bin/env python3
"""
grpc/compile_proto.py — Compila los archivos .proto a código Python

Ejecutar UNA VEZ antes de arrancar el servicio, o cuando el .proto cambie:
  python src/grpc/compile_proto.py

Genera en src/grpc/:
  catalog_pb2.py      → clases de mensajes (BookRequest, BookResponse, etc.)
  catalog_pb2_grpc.py → clases del servidor y cliente gRPC
"""

import subprocess
import sys
from pathlib import Path

# Rutas
SERVICE_DIR = Path(__file__).parent.parent.parent  # /app
PROTO_DIR   = SERVICE_DIR / "proto"                # /app/proto (montado por Docker)
OUT_DIR     = SERVICE_DIR / "src" / "grpc"         # /app/src/grpc


def compile_proto(proto_file: str):
    proto_path = PROTO_DIR / proto_file
    if not proto_path.exists():
        print(f"ERROR: No se encontró {proto_path}")
        sys.exit(1)

    result = subprocess.run(
        [
            sys.executable, "-m", "grpc_tools.protoc",
            f"--proto_path={PROTO_DIR}",
            f"--python_out={OUT_DIR}",
            f"--grpc_python_out={OUT_DIR}",
            str(proto_path),
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"ERROR compilando {proto_file}:\n{result.stderr}")
        sys.exit(1)

    print(f"✓ Compilado: {proto_file}")


if __name__ == "__main__":
    print("Compilando archivos .proto para Catalog Service...")
    compile_proto("catalog.proto")
    print("Listo. Archivos generados en src/grpc/")