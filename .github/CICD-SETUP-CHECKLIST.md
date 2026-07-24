# CI/CD Setup Checklist

Use this checklist to set up CI/CD for SVGER-CLI in your environment.

## ☐ Prerequisites

- [ ] GitHub repository created and accessible
- [ ] NPM account with publishing rights
- [ ] Docker installed (for local testing)
- [ ] Node.js 18+ installed
- [ ] Git installed and configured

## ☐ GitHub Setup

### Repository Configuration
- [ ] Repository is public or has GitHub Actions enabled
- [ ] Branch protection rules set for `main` branch
  - [ ] Require pull request reviews
  - [ ] Require status checks to pass
  - [ ] Include CI workflow as required check

### Secrets Configuration
Navigate to: `Repository Settings → Secrets and variables → Actions → New repository secret`

NPM publishing uses npm Trusted Publishing with GitHub Actions OIDC. Do not configure a long-lived
`NPM_TOKEN` for production publishing.

Optional (but recommended):
- [ ] `CODECOV_TOKEN` - For code coverage reporting
  - Get from: https://codecov.io/
- [ ] `SNYK_TOKEN` - For security scanning
  - Get from: https://snyk.io/
- [ ] `SLACK_WEBHOOK_URL` - For Slack notifications
  - Get from: Slack App settings

### GitHub Pages (for docs)
- [ ] Enable GitHub Pages in repository settings
- [ ] Source: `gh-pages` branch
- [ ] Folder: `/` (root)

## ☐ NPM Setup

- [ ] NPM account created
- [ ] Email verified
- [ ] Two-factor authentication enabled (recommended)
- [ ] Trusted Publisher configured for this package on npmjs.com:
  - Provider: GitHub Actions
  - Organization or user: `faezemohades`
  - Repository: `svger-cli`
  - Workflow filename: `release.yml`
  - Allowed action: `npm publish`
- [ ] Package name available on NPM
  ```bash
  npm search svger-cli  # Should show your package or be available
  ```

## ☐ Docker Setup

### Local Testing
- [ ] Docker installed and running
  ```bash
  docker --version  # Should show version
  docker info       # Should show system info
  ```
- [ ] Docker Compose installed
  ```bash
  docker-compose --version
  ```
- [ ] User added to docker group (Linux only)
  ```bash
  sudo usermod -aG docker $USER
  # Log out and back in
  ```

### Container Registry
- [ ] GitHub Container Registry enabled
  - Automatic with GitHub Actions
- [ ] Alternative: Docker Hub account (optional)
  ```bash
  docker login
  ```

## ☐ Jenkins Setup (Optional)

Only needed if using Jenkins:

### Jenkins Server
- [ ] Jenkins installed and running
- [ ] Required plugins installed:
  - [ ] Pipeline
  - [ ] Git
  - [ ] NodeJS
  - [ ] Docker Pipeline
  - [ ] Slack Notification (optional)

### Jenkins Configuration
- [ ] NodeJS configured in Global Tool Configuration
  - Name: `Node 18.x`
  - Version: 18.x or higher
- [ ] Credentials added:
  - [ ] `npm-token` (Secret text)
  - [ ] `docker-registry-credentials` (Username/Password)
  - [ ] `SLACK_WEBHOOK` (Secret text, optional)

### Pipeline Job
- [ ] New Pipeline job created
- [ ] SCM configured (Git)
  - Repository URL: `https://github.com/faezemohades/svger-cli.git`
  - Credentials: Your GitHub credentials
  - Branch: `*/main`
- [ ] Build triggers configured:
  - [ ] Poll SCM: `H/15 * * * *`
  - [ ] GitHub hook trigger (optional)
- [ ] Pipeline script from SCM selected
  - Script Path: `Jenkinsfile`

## ☐ Local Validation

- [ ] Clone repository
  ```bash
  git clone https://github.com/faezemohades/svger-cli.git
  cd svger-cli
  ```
- [ ] Install dependencies
  ```bash
  npm install
  ```
- [ ] Run validation script
  ```bash
  chmod +x scripts/validate-cicd.sh
  ./scripts/validate-cicd.sh
  ```
- [ ] All checks pass ✅

## ☐ Test CI/CD Workflows

### GitHub Actions CI
- [ ] Create a test branch
  ```bash
  git checkout -b test-ci
  echo "# Test" >> README.md
  git add README.md
  git commit -m "test: CI workflow"
  git push origin test-ci
  ```
- [ ] Create pull request
- [ ] Verify CI workflow runs
- [ ] Check all jobs pass
- [ ] Merge PR
- [ ] Verify CI runs on main branch

### Docker Build
- [ ] Build Docker image locally
  ```bash
  docker build -t svger-cli:test .
  ```
- [ ] Test Docker image
  ```bash
  docker run svger-cli:test --version
  docker run svger-cli:test --help
  ```
- [ ] Test with mounted volumes
  ```bash
  mkdir -p test-input test-output
  # Add a test SVG to test-input/
  docker run -v $(pwd)/test-input:/workspace/input \
             -v $(pwd)/test-output:/workspace/output \
             svger-cli:test build \
             --src /workspace/input \
             --out /workspace/output \
             --framework react
  ```
- [ ] Clean up
  ```bash
  docker rmi svger-cli:test
  rm -rf test-input test-output
  ```

### Docker Compose
- [ ] Test development environment
  ```bash
  docker-compose up svger-dev
  # Ctrl+C to stop
  ```
- [ ] Test CI simulation
  ```bash
  docker-compose --profile ci up
  ```
- [ ] Clean up
  ```bash
  docker-compose down -v
  ```

### Release Workflow
- [ ] Update version in package.json (test version)
  ```json
  "version": "3.0.1-test"
  ```
- [ ] Commit changes
  ```bash
  git add package.json
  git commit -m "chore: test release workflow"
  ```
- [ ] Create test tag
  ```bash
  git tag v3.0.1-test
  git push origin main --tags
  ```
- [ ] Monitor GitHub Actions
  - [ ] Release workflow starts
  - [ ] All jobs complete successfully
  - [ ] GitHub release created
  - [ ] NPM package published (or would be)
  - [ ] Docker image built and pushed
- [ ] Delete test release/tag
  ```bash
  git tag -d v3.0.1-test
  git push origin :refs/tags/v3.0.1-test
  # Delete release from GitHub web interface
  ```

## ☐ Jenkins Testing (if using)

- [ ] Trigger manual build
  - Build with Parameters
  - BUILD_TYPE: `CI`
  - Build Now
- [ ] Monitor console output
- [ ] Verify all stages pass
- [ ] Check artifacts created
- [ ] Review test results
- [ ] Verify coverage report

## ☐ Production Release

Ready for first production release when:

- [ ] All tests passing ✅
- [ ] Documentation complete ✅
- [ ] Secrets configured ✅
- [ ] CI/CD validated ✅
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] All changes committed

Execute release:
```bash
# Update version
npm version patch  # or minor, or major

# Push changes and tags
git push origin main --tags

# GitHub Actions automatically:
# - Creates GitHub release
# - Publishes to NPM
# - Builds and pushes Docker image
# - Updates documentation
```

## ☐ Monitoring & Maintenance

### Regular Checks
- [ ] Monitor GitHub Actions runs weekly
- [ ] Review npm download statistics
- [ ] Check Docker image pulls
- [ ] Review security advisories
- [ ] Update dependencies monthly
  ```bash
  npm audit
  npm outdated
  ```

### Incident Response
- [ ] Document how to rollback releases
- [ ] Set up alerts for failed builds
- [ ] Configure notification channels
- [ ] Test disaster recovery procedures

## ☐ Documentation

- [ ] Team trained on CI/CD workflows
- [ ] CI/CD guide reviewed: `.github/CICD.md`
- [ ] Quick reference bookmarked: `.github/CICD-QUICKREF.md`
- [ ] Implementation report read: `CI-CD-IMPLEMENTATION-REPORT.md`

## 🎉 Completion

When all items are checked:

✅ **CI/CD is fully operational!**

Your project now has:
- Automated testing on every push
- Automated releases with tags
- Docker containerization
- Comprehensive documentation
- Security scanning
- Multi-platform support

---

## 📞 Support

If you encounter issues:

1. Check documentation:
   - `.github/CICD.md` - Comprehensive guide
   - `.github/CICD-QUICKREF.md` - Quick reference
   - `CI-CD-IMPLEMENTATION-REPORT.md` - Implementation details

2. Run validation:
   ```bash
   ./scripts/validate-cicd.sh
   ```

3. Check GitHub Actions logs:
   - Repository → Actions tab → Select workflow run

4. Review Jenkins console output (if using Jenkins):
   - Jenkins dashboard → Select build → Console Output

5. Verify secrets are set correctly:
   - Repository Settings → Secrets and variables → Actions

6. Test locally first:
   ```bash
   npm run build
   npm test
   docker build -t svger-cli:test .
   ```

---

**Last Updated**: December 4, 2025  
**Version**: 1.0  
**Status**: Production Ready ✅
