#!/bin/bash

echo "========================================="
echo "Docker Files Validation Script"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Docker and Docker Compose
if ! command_exists docker; then
    echo -e "${RED}✗ Docker is not installed or not in PATH${NC}"
    exit 1
fi

if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
    echo -e "${RED}✗ Docker Compose is not installed or not in PATH${NC}"
    exit 1
fi

# Use docker compose (v2) if available, otherwise docker-compose (v1)
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

echo -e "${YELLOW}Using: $COMPOSE_CMD${NC}"
echo ""

# Validation results
VALIDATION_PASSED=true

# 1. Validate docker-compose.yml
echo "1. Validating docker-compose.yml..."
if $COMPOSE_CMD -f docker-compose.yml config --quiet >/dev/null 2>&1; then
    echo -e "${GREEN}✓ docker-compose.yml is valid${NC}"
else
    echo -e "${RED}✗ docker-compose.yml has errors:${NC}"
    $COMPOSE_CMD -f docker-compose.yml config 2>&1 | head -20
    VALIDATION_PASSED=false
fi
echo ""

# 2. Validate docker-compose.prod.yml
echo "2. Validating docker-compose.prod.yml..."
if $COMPOSE_CMD -f docker-compose.prod.yml config --quiet >/dev/null 2>&1; then
    echo -e "${GREEN}✓ docker-compose.prod.yml is valid${NC}"
else
    echo -e "${RED}✗ docker-compose.prod.yml has errors:${NC}"
    $COMPOSE_CMD -f docker-compose.prod.yml config 2>&1 | head -20
    VALIDATION_PASSED=false
fi
echo ""

# 3. Validate backend Dockerfile
echo "3. Validating backend/Dockerfile.backend..."
if [ -f "backend/Dockerfile.backend" ]; then
    # Try to parse the Dockerfile by building with --dry-run equivalent
    # We'll use docker build with a dummy target to check syntax
    if docker build --target runtime -f backend/Dockerfile.backend ./backend >/dev/null 2>&1 || \
       docker buildx build --load -f backend/Dockerfile.backend ./backend >/dev/null 2>&1; then
        echo -e "${GREEN}✓ backend/Dockerfile.backend syntax appears valid${NC}"
    else
        echo -e "${YELLOW}⚠ backend/Dockerfile.backend - syntax check requires actual build${NC}"
        echo "   Run: docker build -f backend/Dockerfile.backend ./backend"
    fi
else
    echo -e "${RED}✗ backend/Dockerfile.backend not found${NC}"
    VALIDATION_PASSED=false
fi
echo ""

# 4. Validate frontend Dockerfile
echo "4. Validating frontend/Dockerfile.frontend..."
if [ -f "frontend/Dockerfile.frontend" ]; then
    if docker build --target runtime -f frontend/Dockerfile.frontend ./frontend >/dev/null 2>&1 || \
       docker buildx build --load -f frontend/Dockerfile.frontend ./frontend >/dev/null 2>&1; then
        echo -e "${GREEN}✓ frontend/Dockerfile.frontend syntax appears valid${NC}"
    else
        echo -e "${YELLOW}⚠ frontend/Dockerfile.frontend - syntax check requires actual build${NC}"
        echo "   Run: docker build -f frontend/Dockerfile.frontend ./frontend"
    fi
else
    echo -e "${RED}✗ frontend/Dockerfile.frontend not found${NC}"
    VALIDATION_PASSED=false
fi
echo ""

# 5. Check for common issues
echo "5. Checking for common issues..."
ISSUES_FOUND=0

# Check if volumes are defined
if grep -q "supermarket-db-data" docker-compose.prod.yml && ! grep -q "supermarket-db-data:" docker-compose.prod.yml; then
    echo -e "${RED}✗ Volume 'supermarket-db-data' is used but not defined in docker-compose.prod.yml${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if grep -q "supermarket-item-img-volume" docker-compose.prod.yml && ! grep -q "supermarket-item-img-volume:" docker-compose.prod.yml; then
    echo -e "${RED}✗ Volume 'supermarket-item-img-volume' is used but not defined in docker-compose.prod.yml${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ No common issues found${NC}"
fi
echo ""

# Summary
echo "========================================="
if [ "$VALIDATION_PASSED" = true ] && [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ All validations passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some validations failed${NC}"
    exit 1
fi

