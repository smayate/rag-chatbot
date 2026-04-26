#!/bin/bash

# Create necessary directories
mkdir -p docs 

# Check if backend directory exists
if [ ! -d "backend" ]; then
    echo "Error: backend directory not found"
    exit 1
fi

echo "Starting Course Materials RAG System..."

# Load .env if present
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "Using ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY"
else
    echo "Warning: ANTHROPIC_API_KEY is not set"
fi

# Change to backend directory and start the server
cd backend && uv run uvicorn app:app --reload --port 8000 --log-level debug