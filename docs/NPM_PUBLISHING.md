# NPM Publishing Guide

This document provides detailed instructions for publishing the `yt-transcript-dl-mcp` package to npm using GitHub workflows.

## Prerequisites

Before setting up automated publishing, ensure you have:

1. **NPM Account**: Create an account at [npmjs.com](https://www.npmjs.com/)
2. **NPM Access Token**: Generate a token with publish permissions
3. **GitHub Repository**: Push your code to a GitHub repository
4. **Package.json Configuration**: Ensure all metadata is correct

## Step 1: Configure NPM Access Token

### Generate NPM Token

1. Log into [npmjs.com](https://www.npmjs.com/)
2. Go to **Account Settings** → **Access Tokens**
3. Click **Generate New Token**
4. Select **Automation** (for CI/CD workflows)
5. Copy the generated token (starts with `npm_`)

### Add Token to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: Your NPM access token
6. Click **Add secret**

## Step 2: Create GitHub Workflow

Create the workflow file:

```bash
mkdir -p .github/workflows
```

### Workflow Configuration

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to NPM

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish (leave empty for current package.json version)'
        required: false
        type: string

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run tests
        run: npm run test

      - name: Build project
        run: npm run build

      - name: Test installation
        run: npm pack && npm install -g yt-transcript-dl-mcp-*.tgz

  publish:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'release' || github.event_name == 'workflow_dispatch'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Update version (if specified)
        if: github.event.inputs.version != ''
        run: npm version ${{ github.event.inputs.version }} --no-git-tag-version

      - name: Publish to NPM
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release (if manual trigger)
        if: github.event_name == 'workflow_dispatch'
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ steps.version.outputs.version }}
          release_name: Release v${{ steps.version.outputs.version }}
          draft: false
          prerelease: false
```

## Step 3: Configure Package.json

Update `package.json` with proper publishing configuration:

```json
{
  "name": "yt-transcript-dl-mcp",
  "version": "1.0.0",
  "description": "YouTube transcript download MCP server with stdio, SSE, and HTTP support",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "yt-transcript-dl-mcp": "dist/bin/server.js"
  },
  "files": [
    "dist/**/*",
    "README.md",
    "LICENSE",
    "package.json"
  ],
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "prepublishOnly": "npm run build && npm run test"
  },
  "keywords": [
    "youtube",
    "transcript",
    "mcp",
    "server",
    "stdio",
    "sse",
    "http",
    "docker",
    "cli"
  ],
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-username/yt-transcript-dl-mcp.git"
  },
  "bugs": {
    "url": "https://github.com/your-username/yt-transcript-dl-mcp/issues"
  },
  "homepage": "https://github.com/your-username/yt-transcript-dl-mcp#readme"
}
```

## Step 4: Create .npmignore

Create `.npmignore` to exclude unnecessary files:

```gitignore
# Source files
src/
tests/
examples/

# Development files
.github/
.vscode/
*.test.js
*.test.ts
jest.config.js
tsconfig.json
.eslintrc.js

# Build artifacts
coverage/
.nyc_output/

# Environment files
.env
.env.local
.env.development
.env.test
.env.production

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Documentation (optional - remove if you want to include)
docs/
*.md
!README.md

# Docker files (optional)
Dockerfile
docker-compose.yml
.dockerignore
```

## Step 5: Publishing Methods

### Method 1: Release-based Publishing (Recommended)

1. **Create a Release on GitHub**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Go to GitHub** → **Releases** → **Create new release**
3. **Select the tag** you just created
4. **Add release notes**
5. **Publish release**

The workflow will automatically:
- Run tests on multiple Node.js versions
- Build the project
- Publish to NPM

### Method 2: Manual Workflow Trigger

1. Go to **Actions** tab in your GitHub repository
2. Select **Publish to NPM** workflow
3. Click **Run workflow**
4. Optionally specify a version number
5. Click **Run workflow**

### Method 3: Local Publishing (Not Recommended for Production)

```bash
# Build and test
npm run build
npm run test

# Login to NPM
npm login

# Publish
npm publish
```

## Step 6: Version Management

### Automatic Version Bumping

Create `.github/workflows/version-bump.yml`:

```yaml
name: Version Bump

on:
  push:
    branches: [main]
    paths-ignore:
      - 'README.md'
      - 'docs/**'

jobs:
  version-bump:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Bump version
        run: |
          git config user.name github-actions
          git config user.email github-actions@github.com
          npm version patch
          git push
          git push --tags
```

### Semantic Versioning

Use conventional commit messages to automate versioning:

- `feat:` → Minor version bump (1.0.0 → 1.1.0)
- `fix:` → Patch version bump (1.0.0 → 1.0.1)
- `BREAKING CHANGE:` → Major version bump (1.0.0 → 2.0.0)

## Step 7: Pre-publish Checklist

Before publishing, ensure:

- [ ] **Package name is available** on NPM
- [ ] **All tests pass** locally and in CI
- [ ] **Documentation is complete** (README.md)
- [ ] **License file exists**
- [ ] **Repository URL is correct**
- [ ] **Author information is accurate**
- [ ] **Keywords are relevant**
- [ ] **Version number follows semver**
- [ ] **Build artifacts are included** in `files` array
- [ ] **Binary is executable** (`chmod +x dist/bin/server.js`)

## Step 8: Post-publish Verification

After publishing, verify:

1. **Package is visible** on [npmjs.com/package/yt-transcript-dl-mcp](https://npmjs.com/package/yt-transcript-dl-mcp)
2. **Installation works**:
   ```bash
   npm install -g yt-transcript-dl-mcp
   yt-transcript-dl-mcp --help
   ```
3. **All files are included** in the published package
4. **CLI binary works** correctly

## Step 9: Monitoring and Maintenance

### Setup NPM Download Tracking

Add to README.md:

```markdown
[![npm version](https://badge.fury.io/js/yt-transcript-dl-mcp.svg)](https://badge.fury.io/js/yt-transcript-dl-mcp)
[![npm downloads](https://img.shields.io/npm/dm/yt-transcript-dl-mcp.svg)](https://www.npmjs.com/package/yt-transcript-dl-mcp)
```

### Automated Security Updates

Create `.github/workflows/security.yml`:

```yaml
name: Security Audit

on:
  schedule:
    - cron: '0 0 * * 1' # Weekly on Monday
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run security audit
        run: npm audit

      - name: Check for vulnerabilities
        run: npm audit --audit-level high
```

## Troubleshooting

### Common Issues

1. **NPM Token Error**: Ensure token has publish permissions
2. **Package Name Taken**: Choose a unique package name
3. **Build Failures**: Check TypeScript configuration
4. **Permission Denied**: Verify NPM account has publish rights
5. **Version Conflicts**: Ensure version numbers are unique

### Debug Commands

```bash
# Check package contents
npm pack --dry-run

# Verify login
npm whoami

# Check package info
npm view yt-transcript-dl-mcp

# Test local installation
npm install -g ./yt-transcript-dl-mcp-1.0.0.tgz
```

## Security Considerations

1. **Never commit NPM tokens** to the repository
2. **Use least-privilege tokens** (automation vs publish)
3. **Enable two-factor authentication** on NPM account
4. **Regularly rotate access tokens**
5. **Monitor package downloads** for suspicious activity
6. **Use signed commits** for releases

## Best Practices

1. **Test thoroughly** before publishing
2. **Use semantic versioning** consistently
3. **Write comprehensive changelogs**
4. **Maintain backward compatibility**
5. **Document breaking changes**
6. **Respond to issues promptly**
7. **Keep dependencies updated**
8. **Monitor security advisories**

## Example Release Process

1. **Development**:
   ```bash
   git checkout -b feature/new-feature
   # Make changes
   npm test
   git commit -m "feat: add new feature"
   git push origin feature/new-feature
   ```

2. **Pull Request**:
   - Create PR
   - CI runs tests
   - Code review
   - Merge to main

3. **Release**:
   ```bash
   git checkout main
   git pull origin main
   git tag v1.1.0
   git push origin v1.1.0
   ```

4. **GitHub Release**:
   - Create release from tag
   - Add release notes
   - Publish release
   - Automated NPM publish

This process ensures high-quality, reliable package releases with full automation and proper testing.