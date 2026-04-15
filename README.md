# depdoctor

Analyze dependency health for npm projects. Detect bloat, outdated packages, vulnerabilities, and unused dependencies — all from one CLI tool.

![depdoctor score](https://img.shields.io/badge/depdoctor-99%2F100-brightgreen)
![npm version](https://img.shields.io/npm/v/depdoctor)
![license](https://img.shields.io/npm/l/depdoctor)

## Install

```bash
npm install -g depdoctor
```

Or run without installing:

```bash
npx depdoctor analyze
```

## Commands

### `depdoctor analyze`

Analyze every dependency in your project and get a health score.

```bash
depdoctor analyze
depdoctor analyze --json
depdoctor analyze --depcheck
depdoctor analyze --no-cache
```

| Flag | Description |
|------|-------------|
| `--json` | Output raw JSON instead of a table |
| `--depcheck` | Include unused dependency detection |
| `--concurrency <n>` | Number of parallel requests (default: 10) |
| `--no-cache` | Bypass cache and fetch fresh data |

**What it checks for each package:**

- Current version vs latest version (proper semver comparison)
- Weekly download count from npm
- Bundle size (gzip) from Bundlephobia
- Known vulnerabilities via `npm audit`
- Deprecation status
- Last publish date (staleness)
- Multiple versions in lockfile
- Unused dependencies (with `--depcheck`)

**Scoring (0–100 per package):**

| Factor | Penalty |
|--------|---------|
| Deprecated | Capped at 5 |
| Major version behind | -25 |
| Minor version behind | -10 |
| Patch version behind | -5 |
| Low downloads (<1K/week) | -10 |
| Stale (>2 years) | -20 |
| Large bundle (>500KB gzip) | -10 |
| Critical vulnerability | -30 |
| High vulnerability | -25 |
| Moderate vulnerability | -15 |

The project score is a weighted average — packages with more downloads have more influence.

### `depdoctor migrate`

Find deprecated and stale packages with replacement suggestions.

```bash
depdoctor migrate
depdoctor migrate --fix
depdoctor migrate --github-token <token>
```

| Flag | Description |
|------|-------------|
| `--fix` | Automatically replace packages in package.json |
| `--github-token <token>` | GitHub token for higher API rate limits |
| `--no-cache` | Bypass cache |

Includes built-in migration hints for 20+ packages (moment, request, lodash, node-fetch, uuid, and more).

### `depdoctor badge`

Generate a shields.io health badge for your README.

```bash
depdoctor badge
depdoctor badge --output README.md
depdoctor badge --ci 70
```

| Flag | Description |
|------|-------------|
| `--output <file>` | Append badge markdown to a file |
| `--ci <threshold>` | Exit with code 2 if score is below threshold |
| `--no-cache` | Bypass cache |

### `depdoctor serve`

Launch a web dashboard to visualize your dependency health.

```bash
depdoctor serve
depdoctor serve --port 8080
```

| Flag | Description |
|------|-------------|
| `--port <n>` | Port to listen on (default: 4200) |

The dashboard includes:
- Score gauge with animated ring
- Sortable, searchable package table
- Issue summary badges
- Migration suggestions
- Badge generator
- Dark/light theme toggle

## Caching

Results are cached in `~/.depdoctor/cache/` to speed up repeat runs:

- npm registry data: 1 hour
- Bundle size data: 24 hours
- GitHub commit data: 1 hour

Use `--no-cache` to bypass the cache and fetch fresh data.

## Requirements

- Node.js 20 or later

## License

MIT
