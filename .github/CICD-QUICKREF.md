# CI/CD Quick Reference

## 🚀 Quick Start Commands

### Local Development with Docker

```bash
# Start development environment
docker-compose up svger-dev

# Run tests
docker-compose --profile test up svger-test

# Run CI simulation locally
docker-compose --profile ci up svger-ci

# Watch mode for development
docker-compose --profile watch up svger-watch

# Serve documentation
docker-compose --profile docs up docs
# Then visit http://localhost:8080
```

### Manual Testing

```bash
# Validate all CI/CD configurations
./scripts/validate-cicd.sh

# Build the project
npm run build

# Run tests
npm test

# Type check
npm run typecheck

# Lint code
npm run lint
```

### Docker Commands

```bash
# Build production image
docker build -t svger-cli:latest .

# Run in production mode
docker run -v $(pwd)/svgs:/workspace/input \
           -v $(pwd)/output:/workspace/output \
           svger-cli:latest build \
           --src /workspace/input \
           --out /workspace/output \
           --framework react \
           --typescript

# Interactive shell
docker run -it svger-cli:latest sh
```

## 🔐 Required Secrets

### GitHub Actions

Set these in: `Repository Settings → Secrets and variables → Actions`

| Secret Name | Required | Description |
|------------|----------|-------------|
| `NPM_TOKEN` | ✅ Yes | NPM authentication token for publishing |
| `CODECOV_TOKEN` | ⚠️ Optional | Codecov upload token |
| `SNYK_TOKEN` | ⚠️ Optional | Snyk security scanning |
| `SLACK_WEBHOOK_URL` | ⚠️ Optional | Slack notifications |

### Jenkins

Configure in: `Jenkins → Credentials`

| Credential ID | Type | Required | Description |
|--------------|------|----------|-------------|
| `npm-token` | Secret text | ✅ Yes | NPM authentication |
| `docker-registry-credentials` | Username/Password | ✅ Yes | Docker registry |
| `SLACK_WEBHOOK` | Secret text | ⚠️ Optional | Slack notifications |

## 📋 Workflow Status

### GitHub Actions Workflows

#### CI Workflow (`.github/workflows/ci.yml`)
- **Trigger**: Push to main/develop, Pull Requests
- **Runs on**: Ubuntu Latest
- **Node versions**: 18.x, 20.x, 22.x
- **Jobs**:
  - ✅ Test (lint, typecheck, coverage)
  - ✅ Build (compile, docs)
  - ✅ Integration Test
  - ✅ Security Audit

#### Release Workflow (`.github/workflows/release.yml`)
- **Trigger**: Tag push (v*.*.*) or manual
- **Jobs**:
  - ✅ Create GitHub Release
  - ✅ Publish to NPM
  - ✅ Build & Push Docker Image
  - ✅ Update Documentation
  - ✅ Send Notifications

### Jenkins Pipeline

- **Trigger**: SCM poll (every 15 min), Daily on main
- **Parameters**:
  - BUILD_TYPE: CI | Release | Docker
  - VERSION: Release version
- **Stages**: Checkout → Setup → Install → Lint → Build → Test → Security → Package → Release

## 🎯 Triggering Workflows

### GitHub Actions

```bash
# Trigger CI on push
git push origin main

# Trigger release
git tag v1.0.0
git push origin v1.0.0

# Manual release dispatch
# Go to Actions tab → Release → Run workflow
```

### Jenkins

```bash
# Automatic: Push to repository
git push origin main

# Manual: Jenkins dashboard
Build with Parameters → Select BUILD_TYPE → Build
```

### Docker

```bash
# Build locally
docker build -t svger-cli:local .

# Test
docker run svger-cli:local --version

# Push to registry (after building)
docker tag svger-cli:local ghcr.io/faezemohades/svger-cli:latest
docker push ghcr.io/faezemohades/svger-cli:latest
```

## 🧪 Testing Workflows Locally

### GitHub Actions (with act)

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run CI workflow
act -j test

# Run specific job
act -j build
```

### Docker Compose Profiles

```bash
# All profiles
docker-compose --profile test --profile ci --profile docs up

# Clean up
docker-compose down -v
```

## 📊 Monitoring

### Build Status

| Platform | Status Location |
|----------|----------------|
| GitHub | `Actions` tab in repository |
| Jenkins | Jenkins dashboard |
| Docker | `docker-compose logs -f` |

### Logs

```bash
# GitHub Actions
# View in Actions tab → Select workflow run

# Jenkins
# View in build console output

# Docker
docker-compose logs -f svger-dev
docker logs svger-cli-prod
```

## 🐛 Troubleshooting

### Common Issues

**Issue**: NPM publish fails
```bash
# Check token
echo $NPM_TOKEN

# Verify authentication
npm whoami --registry https://registry.npmjs.org

# Solution: Regenerate NPM_TOKEN in npm settings
```

**Issue**: Docker build fails
```bash
# Check Docker daemon
docker info

# Clean Docker cache
docker system prune -af

# Rebuild without cache
docker build --no-cache -t svger-cli .
```

**Issue**: Tests fail in CI
```bash
# Run locally with same Node version
nvm use 18
npm ci
npm test

# Check environment variables
env | grep NODE
```

**Issue**: Jenkins build stuck
```bash
# Check Jenkins executor
# Jenkins → Manage Jenkins → System Information

# Restart Jenkins
sudo systemctl restart jenkins
```

## 📚 Related Documentation

- [Full CI/CD Guide](.github/CICD.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Development Guide](../DEVELOPMENT.md)
- [Security Policy](../SECURITY.md)

## 🔄 Release Checklist

Before creating a release:

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md`
- [ ] Run full test suite: `npm test`
- [ ] Run validation: `./scripts/validate-cicd.sh`
- [ ] Create and push tag
- [ ] Verify GitHub release created
- [ ] Verify NPM package published
- [ ] Verify Docker image pushed
- [ ] Update documentation if needed
- [ ] Announce release

## 💡 Tips

1. **Use Docker Compose for local development** - Matches production environment
2. **Run validation script before pushing** - Catches issues early
3. **Test workflows locally with act** - Debug GitHub Actions
4. **Keep secrets secure** - Never commit secrets
5. **Monitor build times** - Optimize slow steps

---

Last updated: December 4, 2025
