# Surface Polish Upgrades — Design Spec
**Date:** 2026-06-19
**Project:** NLPC EV Safety & Diagnostics
**Status:** Approved

## Goal
Add industry-standard engineering markers to the project without modifying any existing Java or React source files. All changes are either new files or dependency/config additions.

## Scope

| Addition | Type | Purpose |
|---|---|---|
| springdoc-openapi + actuator | pom.xml dependency | Interactive API docs + health endpoint |
| Swagger config + actuator exposure | application.yml | Config only, no logic change |
| `docker-compose.yml` | New file | One-command infrastructure setup |
| `mosquitto.conf` | New file | Required by docker-compose mosquitto service |
| `GlobalExceptionHandler.java` | New file | Clean JSON error responses |
| `TelemetryServiceTest.java` | New test file | 4 unit tests covering crash detection + auto-registration |
| `.github/workflows/ci.yml` | New file | CI pipeline, green badge on README |
| README update | Existing file | CI badge + Swagger link + docker-compose instructions |

## Constraints
- Zero modifications to any existing `.java` file
- Zero modifications to any frontend file
- No deployment required

## What Recruiters See After
- `GET /swagger-ui.html` — interactive API explorer
- `GET /actuator/health` — `{"status":"UP"}`
- `docker-compose up -d && mvn spring-boot:run` — one-command setup
- Green CI badge on GitHub README
- 4 passing unit tests in `src/test/`
