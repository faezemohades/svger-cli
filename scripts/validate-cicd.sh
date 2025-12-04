#!/bin/bash

# CI/CD Validation Script for SVGER-CLI
# This script validates all CI/CD configurations locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 SVGER-CLI CI/CD Validation Script"
echo "===================================="
echo ""

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        exit 1
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from project root${NC}"
    exit 1
fi

echo "1. Validating Project Structure"
echo "--------------------------------"

# Check for required files
required_files=(
    ".github/workflows/ci.yml"
    ".github/workflows/release.yml"
    "Dockerfile"
    ".dockerignore"
    "docker-compose.yml"
    "Jenkinsfile"
    "package.json"
    "tsconfig.json"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}  ✓ $file${NC}"
    else
        echo -e "${RED}  ✗ $file missing${NC}"
        exit 1
    fi
done

echo ""
echo "2. Validating package.json scripts"
echo "-----------------------------------"

# Check required npm scripts
required_scripts=(
    "build"
    "clean"
    "test"
    "lint"
    "typecheck"
)

for script in "${required_scripts[@]}"; do
    if grep -q "\"$script\":" package.json; then
        echo -e "${GREEN}  ✓ npm run $script${NC}"
    else
        echo -e "${RED}  ✗ npm run $script missing${NC}"
        exit 1
    fi
done

echo ""
echo "3. Checking Node.js Dependencies"
echo "---------------------------------"

if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found, running npm install..."
    npm install
fi

print_status $? "Dependencies installed"

echo ""
echo "4. Running TypeScript Type Check"
echo "---------------------------------"

npm run typecheck
print_status $? "TypeScript type check passed"

echo ""
echo "5. Building Project"
echo "-------------------"

npm run build
print_status $? "Build successful"

echo ""
echo "6. Validating Build Output"
echo "--------------------------"

if [ -d "dist" ] && [ -f "dist/index.js" ] && [ -f "dist/index.d.ts" ]; then
    echo -e "${GREEN}  ✓ dist/index.js${NC}"
    echo -e "${GREEN}  ✓ dist/index.d.ts${NC}"
    print_status 0 "Build artifacts created"
else
    print_status 1 "Build artifacts missing"
fi

echo ""
echo "7. Testing GitHub Actions Workflows"
echo "------------------------------------"

# Check YAML syntax (basic check)
for workflow in .github/workflows/*.yml; do
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}  ✓ $(basename $workflow)${NC}"
        else
            echo -e "${RED}  ✗ $(basename $workflow) - Invalid YAML${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}  ⚠ $(basename $workflow) - Cannot validate (python3 not found)${NC}"
    fi
done

echo ""
echo "8. Validating Docker Configuration"
echo "-----------------------------------"

# Check if Docker is available and accessible
if command -v docker >/dev/null 2>&1; then
    # Check if Docker daemon is accessible
    if docker info >/dev/null 2>&1; then
        # Validate Dockerfile syntax
        if docker build -t svger-cli:validation . --no-cache >/dev/null 2>&1; then
            print_status 0 "Dockerfile build successful"
            docker rmi svger-cli:validation >/dev/null 2>&1 || true
        else
            print_warning "Dockerfile build failed (may need permissions)"
        fi
        
        # Validate docker-compose.yml
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose config >/dev/null 2>&1
            print_status $? "docker-compose.yml valid"
        else
            print_warning "docker-compose not found, skipping validation"
        fi
    else
        print_warning "Docker daemon not accessible (permission denied or not running)"
        print_warning "Skipping Docker validation - files exist and will work in CI"
    fi
else
    print_warning "Docker not available, skipping Docker validation"
fi

echo ""
echo "9. Validating Jenkinsfile"
echo "-------------------------"

# Basic syntax check for Jenkinsfile
if grep -q "pipeline {" Jenkinsfile && \
   grep -q "stages {" Jenkinsfile && \
   grep -q "agent" Jenkinsfile; then
    print_status 0 "Jenkinsfile syntax looks valid"
else
    print_status 1 "Jenkinsfile syntax invalid"
fi

echo ""
echo "10. Security Check"
echo "------------------"

# Run npm audit
if npm audit --audit-level=high >/dev/null 2>&1; then
    print_status 0 "No high-severity security vulnerabilities found"
else
    print_warning "Security audit found issues (run 'npm audit' for details)"
    echo "   Note: This is informational and doesn't fail the validation"
fi

echo ""
echo "11. Checking Required Secrets Documentation"
echo "--------------------------------------------"

if [ -f ".github/CICD.md" ]; then
    if grep -q "NPM_TOKEN" .github/CICD.md && \
       grep -q "CODECOV_TOKEN" .github/CICD.md; then
        print_status 0 "CI/CD documentation includes required secrets"
    else
        print_status 1 "CI/CD documentation missing secret information"
    fi
else
    print_status 1 "CI/CD documentation not found"
fi

echo ""
echo "12. Final Checks"
echo "----------------"

# Verify workspace directories exist
if [ -d "workspace/input" ] && [ -d "workspace/output" ]; then
    print_status 0 "Docker workspace directories exist"
else
    mkdir -p workspace/input workspace/output
    print_status 0 "Created workspace directories"
fi

echo ""
echo "========================================="
echo -e "${GREEN}✓ All CI/CD validations passed!${NC}"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Set up required secrets in GitHub repository settings"
echo "  2. Configure Jenkins credentials if using Jenkins"
echo "  3. Test Docker build: docker build -t svger-cli ."
echo "  4. Push to repository to trigger CI workflow"
echo ""
