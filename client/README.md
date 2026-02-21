# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Cloudflare Pages Functions + OpenAI

This project now includes a Pages Function endpoint:

- `POST /api/storybooks`
- file: `functions/api/storybooks.ts`

### Required environment variables

Set in Cloudflare Pages project:

- `OPENAI_API_KEY` (secret)
- `OPENAI_PROMPT_ID` (var, default configured in `wrangler.jsonc`)
- `OPENAI_PROMPT_VERSION` (var, default `17`)
- `OPENAI_IMAGE_MODEL` (var, default `gpt-image-1.5`)

For local Pages dev, create `client/.dev.vars`:

```bash
OPENAI_API_KEY="sk-..."
OPENAI_PROMPT_ID="pmpt_6997ab7bf5a8819696d08aa2f6349bda056f201a80d93697"
OPENAI_PROMPT_VERSION="17"
OPENAI_IMAGE_MODEL="gpt-image-1.5"
```

If you run Vite separately (`npm run dev`), set `VITE_API_BASE_URL` in `.env`:

```bash
VITE_API_BASE_URL="http://127.0.0.1:8788"
```

Optional live check test (disabled by default):

```bash
VITE_OPENAI_LIVE_CHECK=1 \
VITE_OPENAI_API_KEY="sk-..." \
VITE_OPENAI_PROMPT_ID="pmpt_6997ab7bf5a8819696d08aa2f6349bda056f201a80d93697" \
VITE_OPENAI_PROMPT_VERSION="17" \
npm run test:run -- functions/api/storybooks.live.test.ts
```

## Supabase Google Auth

Google login is wired in the app header via Supabase Auth.

### Client env vars

Set in `client/.env` (or `client/.env.local`):

```bash
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY="<supabase-publishable-key>"
```

This app also accepts `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as aliases.

### Supabase Dashboard setup

- Enable `Google` provider in `Authentication > Providers`.
- Add your app URL(s) in `Authentication > URL Configuration > Site URL / Redirect URLs` (for local dev usually `http://localhost:5173`).
- In Google Cloud OAuth client, add Supabase callback URI:
  `https://<project-ref>.supabase.co/auth/v1/callback`

### Optional live API check test

Unit tests always run in CI. Live API checks are optional and skipped by default.

```bash
VITE_SUPABASE_LIVE_CHECK=1 \
VITE_SUPABASE_URL="https://<project-ref>.supabase.co" \
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY="<supabase-publishable-key>" \
npm run test:supabase:live
```

Optional table read check:

```bash
VITE_SUPABASE_LIVE_CHECK=1 \
VITE_SUPABASE_LIVE_CHECK_TABLE="instruments" \
VITE_SUPABASE_URL="https://<project-ref>.supabase.co" \
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY="<supabase-publishable-key>" \
npm run test:supabase:live
```

### Commands

```bash
npm run build
npm run cf:pages:dev
```

Deploy:

```bash
npm run build
npm run cf:pages:deploy -- --project-name doodle-storybook
```
