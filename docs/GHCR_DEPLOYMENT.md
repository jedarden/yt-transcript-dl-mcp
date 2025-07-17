# GitHub Container Registry (GHCR) Deployment Guide

This document explains how the `yt-transcript-dl-mcp` package is automatically published to GitHub Container Registry (GHCR) and how to use the published container images.

## Overview

The project uses GitHub Actions to automatically build and publish multi-architecture Docker images to GHCR whenever:
- A new release is created
- Code is pushed to the main branch
- The publish workflow is manually triggered

## Container Registry Details

- **Registry**: `ghcr.io` (GitHub Container Registry)
- **Repository**: `ghcr.io/jedarden/yt-transcript-dl-mcp`
- **Supported Platforms**: `linux/amd64`, `linux/arm64`
- **Automatic Publishing**: Yes, via GitHub Actions

## Available Tags

### Release Tags
- `ghcr.io/jedarden/yt-transcript-dl-mcp:latest` - Latest stable release
- `ghcr.io/jedarden/yt-transcript-dl-mcp:1.0.0` - Specific version
- `ghcr.io/jedarden/yt-transcript-dl-mcp:1.0` - Major.minor version
- `ghcr.io/jedarden/yt-transcript-dl-mcp:1` - Major version

### Development Tags
- `ghcr.io/jedarden/yt-transcript-dl-mcp:main` - Latest main branch build
- `ghcr.io/jedarden/yt-transcript-dl-mcp:pr-123-sha1234` - Pull request builds

## Usage Examples

### Basic Usage

```bash
# Pull the latest stable version
docker pull ghcr.io/jedarden/yt-transcript-dl-mcp:latest

# Run with default stdio transport
docker run --rm ghcr.io/jedarden/yt-transcript-dl-mcp:latest

# Run with multi-transport mode
docker run --rm -p 3001:3001 -p 3002:3002 \
  ghcr.io/jedarden/yt-transcript-dl-mcp:latest --multi-transport

# Run with environment variables
docker run --rm -p 3001:3001 -p 3002:3002 \
  -e MCP_MULTI_TRANSPORT=true \
  -e LOG_LEVEL=debug \
  ghcr.io/jedarden/yt-transcript-dl-mcp:latest
```

### Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  yt-transcript-mcp:
    image: ghcr.io/jedarden/yt-transcript-dl-mcp:latest
    ports:
      - "3001:3001"  # SSE transport
      - "3002:3002"  # HTTP transport
    environment:
      - MCP_MULTI_TRANSPORT=true
      - LOG_LEVEL=info
      - CORS_ENABLED=true
      - CACHE_ENABLED=true
      - CACHE_TTL=3600
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Run with:
```bash
docker-compose up -d
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: yt-transcript-mcp
  labels:
    app: yt-transcript-mcp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: yt-transcript-mcp
  template:
    metadata:
      labels:
        app: yt-transcript-mcp
    spec:
      containers:
      - name: yt-transcript-mcp
        image: ghcr.io/jedarden/yt-transcript-dl-mcp:latest
        ports:
        - containerPort: 3001
          name: sse
        - containerPort: 3002
          name: http
        env:
        - name: MCP_MULTI_TRANSPORT
          value: "true"
        - name: LOG_LEVEL
          value: "info"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: yt-transcript-mcp-service
spec:
  selector:
    app: yt-transcript-mcp
  ports:
  - name: sse
    port: 3001
    targetPort: 3001
  - name: http
    port: 3002
    targetPort: 3002
  type: LoadBalancer
```

## Image Information

### Container Labels

Each image includes comprehensive metadata:

```bash
# View image labels
docker inspect ghcr.io/jedarden/yt-transcript-dl-mcp:latest | jq '.[0].Config.Labels'
```

Labels include:
- `org.opencontainers.image.title`: YouTube Transcript MCP Server
- `org.opencontainers.image.description`: MCP server for YouTube transcript extraction
- `org.opencontainers.image.version`: Package version
- `org.opencontainers.image.source`: GitHub repository URL
- `org.opencontainers.image.licenses`: MIT
- `org.opencontainers.image.vendor`: Claude Code

### Image Size and Layers

The image uses a multi-stage build to minimize size:
- **Base**: Node.js Alpine Linux
- **Final size**: ~150MB (including Node.js runtime)
- **Architecture**: Multi-arch (AMD64, ARM64)

## Security Features

### Image Scanning

All images are automatically scanned for vulnerabilities:
- **Trivy security scanning** in CI/CD pipeline
- **Dependency vulnerability checks** via npm audit
- **Base image updates** through Dependabot

### Non-root User

The container runs as a non-root user for security:
```dockerfile
USER node
```

### Read-only Root Filesystem

The container supports read-only root filesystem:
```bash
docker run --rm --read-only -p 3001:3001 -p 3002:3002 \
  ghcr.io/jedarden/yt-transcript-dl-mcp:latest --multi-transport
```

## Accessing Private Images

If the repository becomes private, authenticate with GHCR:

```bash
# Create a personal access token with 'read:packages' scope
export CR_PAT=your_github_token

# Login to GHCR
echo $CR_PAT | docker login ghcr.io -u your_github_username --password-stdin

# Pull the image
docker pull ghcr.io/jedarden/yt-transcript-dl-mcp:latest
```

## CI/CD Integration

### Automated Building

Images are built automatically on:
- **Push to main**: Creates `main` tag
- **Release creation**: Creates version tags (`latest`, `1.0.0`, `1.0`, `1`)
- **Pull requests**: Creates PR-specific tags for testing

### Build Process

1. **Multi-stage Docker build** for optimized image size
2. **Multi-architecture build** (AMD64, ARM64) using Docker Buildx
3. **Automated testing** of built images
4. **Security scanning** with Trivy
5. **Publishing to GHCR** with proper tagging

### Workflow Files

- `.github/workflows/ci.yml` - Builds and pushes on every commit
- `.github/workflows/publish.yml` - Builds and pushes on releases

## Monitoring and Logging

### Health Checks

Built-in health endpoints:
- HTTP: `http://localhost:3002/health`
- SSE: `http://localhost:3001/health`

### Logging

Configure logging via environment variables:
```bash
docker run --rm -p 3001:3001 -p 3002:3002 \
  -e LOG_LEVEL=debug \
  -e LOG_FORMAT=json \
  ghcr.io/jedarden/yt-transcript-dl-mcp:latest --multi-transport
```

### Metrics

The container exposes metrics for monitoring:
- **Memory usage** via `/health` endpoint
- **Cache statistics** via MCP tools
- **Transport status** via status endpoints

## Performance Optimization

### Resource Limits

Recommended resource limits:
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Scaling

For high-traffic deployments:
- **Horizontal scaling**: Run multiple replicas
- **Load balancing**: Use service mesh or load balancer
- **Caching**: Enable Redis for shared caching

### Build Cache

The CI/CD pipeline uses GitHub Actions cache to speed up builds:
- **Docker layer caching** via `cache-from` and `cache-to`
- **Multi-stage build optimization**
- **Dependency caching** via npm ci

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3001 and 3002 are available
2. **Permission denied**: Image runs as non-root user
3. **Network issues**: Check firewall and security group settings

### Debug Mode

Run with debug logging:
```bash
docker run --rm -p 3001:3001 -p 3002:3002 \
  -e LOG_LEVEL=debug \
  ghcr.io/jedarden/yt-transcript-dl-mcp:latest --multi-transport
```

### Container Inspection

```bash
# Check running processes
docker exec -it container_id ps aux

# View logs
docker logs container_id

# Access container shell
docker exec -it container_id /bin/sh
```

## Registry Management

### Viewing Packages

Visit: https://github.com/users/jedarden/packages/container/package/yt-transcript-dl-mcp

### Package Cleanup

Old images are automatically cleaned up:
- **Keep latest 10 versions** of each tag
- **Delete untagged images** older than 7 days
- **Cleanup PR images** after PR closure

## Best Practices

1. **Always use specific tags** in production (not `latest`)
2. **Implement health checks** in orchestration platforms
3. **Set resource limits** to prevent resource exhaustion
4. **Use multi-stage builds** for custom images
5. **Enable security scanning** in your deployment pipeline
6. **Monitor container metrics** and logs
7. **Keep base images updated** through automated pipelines

## Integration Examples

### Claude Code Integration

```bash
# Add as MCP server in Claude Code
claude mcp add yt-transcript \
  "docker run --rm -p 3001:3001 -p 3002:3002 ghcr.io/jedarden/yt-transcript-dl-mcp:latest --multi-transport"
```

### CI/CD Pipeline Usage

```yaml
# GitHub Actions example
- name: Test with yt-transcript-mcp
  run: |
    docker run -d -p 3001:3001 -p 3002:3002 \
      --name yt-transcript-test \
      ghcr.io/jedarden/yt-transcript-dl-mcp:latest --multi-transport
    
    # Wait for startup
    sleep 10
    
    # Run tests
    curl -f http://localhost:3002/health
    
    # Cleanup
    docker stop yt-transcript-test
```

This deployment guide provides comprehensive information for using the GHCR-hosted container images in various environments and use cases.