# CI/CD Documentation

This directory contains comprehensive CI/CD workflows and configurations for automated building, testing, and deployment of SVGER-CLI.

## 📁 Available Workflows

### 1. **GitHub Actions** (`.github/workflows/`)

#### `ci.yml` - Continuous Integration
- **Triggers**: Push to `main`/`develop`, Pull Requests
- **Jobs**:
  - **Test**: Runs on Node.js 18.x, 20.x, 22.x
    - Linting (ESLint)
    - Type checking (TypeScript)
    - Unit & integration tests with coverage
    - Codecov upload
  - **Build**: Compiles TypeScript, generates documentation
  - **Integration Test**: Tests CLI installation and integrations
  - **Security**: NPM audit and Snyk scanning

#### `release.yml` - Automated Release
- **Triggers**: Tag push (`v*.*.*`) or manual dispatch
- **Jobs**:
  - **Create Release**: Generates changelog and GitHub release
  - **Publish NPM**: Publishes to npm registry
  - **Publish Docker**: Multi-platform Docker images (amd64/arm64)
  - **Update Docs**: Deploys API docs to GitHub Pages
  - **Notify**: Slack notifications

### 2. **Jenkins** (`Jenkinsfile`)

Full-featured Jenkins pipeline with:
- Parallel linting and type checking
- Comprehensive test suites
- Security auditing
- Docker image building
- NPM and Docker registry publishing
- Slack notifications

**Parameters**:
- `BUILD_TYPE`: CI, Release, or Docker
- `VERSION`: Release version number

**Triggers**:
- SCM polling every 15 minutes
- Daily builds on main branch

### 3. **Docker** (`Dockerfile`, `docker-compose.yml`)

#### Dockerfile
Multi-stage build optimized for:
- Small image size (Alpine-based)
- Security (non-root user)
- Performance (layer caching)
- Multi-architecture support

#### Docker Compose
Multiple service profiles:
- `svger-dev`: Development with hot reload
- `svger-prod`: Production-like environment
- `svger-test`: Automated testing
- `svger-watch`: Watch mode for builds
- `svger-ci`: CI simulation locally
- `docs`: Documentation server with Nginx

## 🚀 Quick Start

### GitHub Actions

Already configured! Push to your repository:

```bash
git push origin main
```

For releases:
```bash
git tag v1.0.0
git push origin v1.0.0
```

### Jenkins

1. **Setup Jenkins**:
   ```bash
   # Add required plugins
   - Pipeline
   - Git
   - Docker Pipeline
   - NodeJS
   - Slack Notification (optional)
   ```

2. **Configure Credentials**:
   - `npm-token`: NPM authentication token
   - `docker-registry-credentials`: Docker registry credentials
   - `SLACK_WEBHOOK` (optional): Slack webhook URL

3. **Create Pipeline**:
   - New Item → Pipeline
   - Configure SCM to point to repository
   - Select `Jenkinsfile` from repository

4. **Run Build**:
   ```bash
   # CI Build
   Build with Parameters → BUILD_TYPE: CI
   
   # Release
   Build with Parameters → BUILD_TYPE: Release, VERSION: 1.0.0
   ```

### Docker Development

1. **Start development environment**:
   ```bash
   # Create workspace directories
   mkdir -p workspace/input workspace/output
   
   # Start dev container
   docker-compose up svger-dev
   ```

2. **Run tests**:
   ```bash
   docker-compose --profile test up svger-test
   ```

3. **Build production image**:
   ```bash
   docker build -t svger-cli:latest .
   ```

4. **Run production container**:
   ```bash
   # Process SVGs
   docker run -v $(pwd)/svgs:/workspace/input \
              -v $(pwd)/output:/workspace/output \
              svger-cli:latest build \
              --src /workspace/input \
              --out /workspace/output \
              --framework react \
              --typescript
   ```

5. **Start all services**:
   ```bash
   # Development + docs
   docker-compose --profile docs up
   
   # Full CI simulation
   docker-compose --profile ci up
   ```

## 🔧 Configuration

### Required Secrets (GitHub Actions)

Add these to your repository settings → Secrets and variables → Actions:

- `NPM_TOKEN`: NPM authentication token for publishing
- `CODECOV_TOKEN` (optional): Codecov upload token
- `SNYK_TOKEN` (optional): Snyk security scanning
- `SLACK_WEBHOOK_URL` (optional): Slack notifications

### Required Secrets (Jenkins)

Configure in Jenkins → Credentials:

- **npm-token** (Secret text): NPM authentication
- **docker-registry-credentials** (Username/Password): Docker registry
- **SLACK_WEBHOOK** (Secret text, optional): Slack notifications

## 📊 Workflow Details

### Test Coverage

All workflows include:
- ✅ Linting with ESLint
- ✅ TypeScript type checking
- ✅ Framework tests (React, Vue, Angular, Svelte)
- ✅ Configuration tests
- ✅ End-to-end tests
- ✅ Integration tests
- ✅ Code coverage reporting

### Security Scanning

- NPM audit for dependency vulnerabilities
- Snyk security scanning
- Docker image vulnerability scanning

### Performance Optimization

- Parallel test execution
- Docker layer caching
- NPM cache for faster installs
- Multi-stage builds for smaller images

## 🐳 Docker Commands Reference

```bash
# Development
docker-compose up svger-dev                    # Start dev environment
docker-compose exec svger-dev npm test         # Run tests in container
docker-compose logs -f svger-dev               # View logs

# Testing
docker-compose --profile test up               # Run test suite
docker-compose --profile ci up                 # Simulate CI locally

# Production
docker-compose --profile production up         # Production environment

# Watch mode
docker-compose --profile watch up              # Build with watch mode

# Documentation
docker-compose --profile docs up               # Serve docs on :8080

# Cleanup
docker-compose down -v                         # Stop and remove volumes
docker system prune -af                        # Clean everything
```

## 🔄 Release Process

### Automated Release (Recommended)

1. **Update version** in `package.json`
2. **Update** `CHANGELOG.md`
3. **Commit changes**:
   ```bash
   git add .
   git commit -m "chore: release v1.0.0"
   ```
4. **Create and push tag**:
   ```bash
   git tag v1.0.0
   git push origin main --tags
   ```
5. **GitHub Actions** automatically:
   - Creates GitHub release
   - Publishes to NPM
   - Builds and pushes Docker image
   - Updates documentation

### Manual Release

```bash
# Using npm scripts
npm run release        # Patch version (1.0.0 → 1.0.1)
npm run release:minor  # Minor version (1.0.0 → 1.1.0)
npm run release:major  # Major version (1.0.0 → 2.0.0)
```

## 📈 Monitoring & Notifications

### Build Status

- **GitHub Actions**: Check Actions tab in repository
- **Jenkins**: Jenkins dashboard
- **Docker**: `docker-compose logs`

### Notifications

Configure Slack webhooks for build notifications:
- ✅ Successful builds
- ❌ Failed builds
- 📦 New releases

## 🛠️ Troubleshooting

### Common Issues

1. **NPM publish fails**:
   - Verify `NPM_TOKEN` is set correctly
   - Check npm registry authentication
   - Ensure version doesn't exist already

2. **Docker build fails**:
   - Check Docker daemon is running
   - Verify Dockerfile syntax
   - Check available disk space

3. **Tests fail in CI but pass locally**:
   - Ensure environment variables are set
   - Check Node.js version matches
   - Review CI logs for specific errors

4. **Jenkins build stuck**:
   - Check executor availability
   - Review console output
   - Verify credentials are configured

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Jenkins Pipeline Syntax](https://www.jenkins.io/doc/book/pipeline/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [NPM Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)

## 🤝 Contributing

When adding new CI/CD features:

1. Test workflows locally using Docker Compose
2. Validate GitHub Actions with [act](https://github.com/nektos/act)
3. Update this documentation
4. Add tests for new functionality
5. Submit PR with clear description

---

For issues or questions, please open an issue on GitHub or contact the maintainers.
