---
name: commit
description: Generate user's style commits. Use this skill whenever the user asks to write a commit message, document changes as a commit, summarize code changes into a commit, or mentions words like "commit", "git commit", "changelog entry", or "what should I commit". Always apply this format even if the user just pastes a diff or describes what they changed.
---

# Conventional Commits with Emojis

## Format

```
<type>(<scope>)<emoji>: <short description>
* <bullet>
* <bullet>
* <bullet>
```

- **First line**: `type(scope)emoji: short imperative description` — max ~72 chars
- **Bullets**: concrete, specific changes — use as many as needed, skip if trivial
- **scope** is optional; omit parentheses if not applicable

---

## Emoji Map

| Type       | Emoji | When to use                                              |
|------------|-------|----------------------------------------------------------|
| `feat`     | ✨    | New feature or capability                                |
| `fix`      | 🐛    | Bug fix                                                  |
| `refactor` | ♻️    | Code restructure, no behavior change                     |
| `style`    | 🎨    | Formatting, whitespace, linting — no logic change        |
| `chore`    | 🔧    | Build scripts, deps, config, tooling                     |
| `docs`     | 📝    | Documentation only                                       |
| `test`     | 🧪    | Adding or fixing tests                                   |
| `perf`     | ⚡    | Performance improvement                                  |
| `ci`       | 🚀    | CI/CD pipeline changes                                   |
| `revert`   | ⏪    | Reverting a previous commit                              |
| `security` | 🔒    | Security fix or hardening                                |
| `i18n`     | 🌐    | Internationalization / localization                      |
| `wip`      | 🚧    | Work in progress (avoid committing unless necessary)     |

---

## Examples

```
feat(auth)✨: add OAuth2 login with Google
* integrate Google OAuth2 flow via passport.js
* store refresh tokens encrypted in DB
* redirect to /dashboard on successful login

fix(cart)🐛: prevent duplicate items on rapid add clicks
* debounce addToCart handler by 300ms
* guard against concurrent state updates

refactor(api)♻️: extract pagination logic into shared util
* move offset/limit calculation out of controllers
* add reusable paginate() helper in utils/pagination.ts

chore🔧: upgrade dependencies to latest patch versions

docs(readme)📝: add local dev setup instructions
* document required env vars
* add step-by-step DB migration instructions
```

---

## Rules

1. **Imperative mood** on the first line — "add", not "added" or "adds"
2. **No period** at the end of the first line
3. **Bullets are optional** — omit for single-line obvious changes
4. **One concern per commit** — if the change touches multiple unrelated things, split it
5. When unsure of scope, omit it — `fix🐛: correct null check` is fine
6. **Tag agents** — if the user mentions an agent, add a note at the end of the commit tagging that agent (e.g., `Co-authored-by: Agent Name <agent@example.com>` or `@agent-name`)
