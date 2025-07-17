# Changelog

All notable changes to this project will be documented in this file.

## [1.1.2] - 2025-07-17

### Fixed
- Fixed Jest ESM configuration for proper module imports
- Removed unused youtube-captions-scraper dependency
- Fixed MCP SDK handler signatures for v1.0.0 compatibility
- Re-enabled tests in GitHub Actions CI
- Fixed GitHub Release creation using gh CLI instead of deprecated action
- Improved Docker build configuration

### Changed
- Updated Jest to use ESM presets and experimental VM modules
- Migrated from actions/create-release@v1 to gh CLI for releases
- Enhanced test coverage and TDD approach

## [1.1.1] - 2025-07-17

### Fixed
- Complete ESM migration to fix ERR_REQUIRE_ESM errors
- Updated package.json to include "type": "module"
- Fixed binary execution with proper ESM module loading
- Updated all import statements to include .js extensions

### Changed
- Upgraded @modelcontextprotocol/sdk to v1.0.0
- Updated TypeScript configuration for ESM compilation
- Version bump for ESM compatibility

## [1.1.0] - 2025-07-17

### Added
- Complete ESM module support
- Multi-transport architecture (stdio, HTTP, SSE)
- Comprehensive test suite with TDD approach
- Docker containerization support
- GitHub Actions CI/CD pipeline

### Fixed
- ERR_REQUIRE_ESM error resolution
- Binary execution compatibility
- Module import/export patterns

## [1.0.0] - 2025-07-17

### Added
- Initial release of YouTube Transcript DL MCP Server
- MCP server with stdio, SSE, and HTTP transports
- Single video and bulk transcript extraction
- Multiple output formats (text, JSON, SRT)
- Caching and rate limiting
- TypeScript support
- Comprehensive documentation