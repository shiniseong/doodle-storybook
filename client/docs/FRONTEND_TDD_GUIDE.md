# Frontend TDD Guide (React + FSD + Clean Architecture)

## Core Principles
- Test-first: write failing test, implement minimal code, refactor.
- Layer isolation: domain/application tests do not depend on React or browser APIs.
- Dependency inversion: UI depends on ports, infra adapters are injected from app layer.

## Layer Rules
- `app`: composition root, providers, app-wide wiring.
- `pages`: route-level composition of widgets.
- `widgets`: screen sections that compose features/entities/shared.
- `features`: use-case specific logic (domain, application, ui, infrastructure).
- `entities`: domain entity types and pure business models.
- `shared`: reusable libs/config/ui primitives.

## Test Strategy
- Domain tests: pure validation and business rules.
- Application tests: use-case orchestration with mocked ports.
- UI tests: user flows with React Testing Library.
- Widget tests: integration between UI and use-case ports.

## Commands
- Start TDD watch mode: `npm run test:watch`
- One-shot tests: `npm run test:run`
- Coverage gate: `npm run test:coverage`
- Full quality gate: `npm run verify`

## Pull Request Gate
- All tests pass
- Coverage thresholds pass
- `npm run lint` passes
- `npm run build` passes
