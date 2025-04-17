# 🚀 vite-plugin-github-deploy

A Vite plugin to automate GitHub deployment using `git`, `gh` CLI, and `@octokit/rest`.
Perfect for JAMStack, Webflow, or static sites needing CDN-ready delivery.

---

## ✨ Features

- 🔐 SSH support + GitHub authentication (`gh auth login`)
- 📁 Pushes either:
  - entire project (source + dist)
  - or `dist/` only
- 🧠 Smart detection of existing repositories
- 🔄 Automatically creates repos via GitHub API (`@octokit/rest`)
- 🧰 Works with `starter.config.js` for unified setup

---

## ⚙️ Supported Deployment Modes

| Mode          | Description                                                               |
| ------------- | ------------------------------------------------------------------------- |
| `none`        | Skips deployment entirely                                                 |
| `public-only` | Pushes full project (source + `dist/`) to a **public repo**               |
| `split`       | Pushes source code to **private repo**, `dist/` folder to **public repo** |

Each mode fits a different use case:

- `public-only`: For simple public open-source projects.
- `split`: When your code is private but output must be public (e.g. CDN via jsDelivr).
- `none`: When you want to manage deployment manually.

---

## 📦 Installation

```bash
npm install --save-dev @kobono-studio/vite-plugin-github-deploy
```

---

## 🔧 Configuration (`starter.config.js`)

At your project root, create:

```js
export default {
  cdn: {
    baseUrl: 'https://cdn.jsdelivr.net/gh',
    user: 'your-github-username-or-org',
    repo: 'your-public-repo',
    branch: 'main',
    org: true, // optional (true if you're using a GitHub org)
  },
  deploy: {
    mode: 'split', // 'none' | 'public-only' | 'split'
    publicRepo: 'webflow-assets',
    privateRepo: 'webflow-source',
    branch: 'main',
  },
}
```

---

## 🔌 Usage in `vite.config.js`

```js
import { defineConfig } from 'vite'
import githubDeployPlugin from '@kobono-studio/vite-plugin-github-deploy'

export default defineConfig({
  plugins: [githubDeployPlugin()],
})
```

---

## 🚀 Trigger Deployment

Before deploying, you must manually build your project (e.g. with `npm run build` or `npm run build:pages`):

```bash
npm run build
#or
npm run build:pages
```

Then trigger deployment using the DEPLOY flag:

```bash
DEPLOY=true npm run build
```

This will:

1. ✅ Verify `git` and `gh` are installed
2. 🔐 Ensure SSH key exists and is configured
3. 🤝 Authenticate with GitHub CLI
4. 📁 Create or detect GitHub repos
5. 🚀 Push files to correct repos based on deployment mode

---

## 🧪 Examples

### ➤ `public-only`

- Project pushed entirely to `git@github.com:user/project.git`
- Ideal for public showcase or open source

### ➤ `split`

- `dist/` → public repo (`user/cdn-repo`)
- Source → private repo (`user/source-repo`)
- Perfect for Webflow CDN or static assets

---

## 📁 What gets pushed?

| Folder    | Mode        | Repo type |
| --------- | ----------- | --------- |
| `.` (all) | public-only | Public    |
| `dist/`   | split       | Public    |
| `.` (all) | split       | Private   |

---

## 🛠 Requirements

- Node.js ≥ 18
- `git` installed
- `gh` GitHub CLI (`gh auth login` required)
- SSH key (`id_ed25519`) added to GitHub
- Internet access

---

## 🧠 Author

Made with ❤️ by [Pierre Lovenfosse](https://github.com/meetpilou)

## 📄 License

MIT — © Pierre Lovenfosse
