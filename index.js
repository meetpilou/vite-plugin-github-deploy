import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { Octokit } from '@octokit/rest'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function checkCommandInstalled(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' })
  } catch {
    console.error(`❌ Missing: ${cmd}`)
    console.log(`👉 Please install ${cmd} before continuing.`)
    process.exit(1)
  }
}

function ensureGitAndGhAuthenticated() {
  checkCommandInstalled('git')
  checkCommandInstalled('gh')

  try {
    execSync('gh auth status', { stdio: 'ignore' })
  } catch {
    console.warn('\n❌ GitHub CLI not authenticated.')
    console.log('👉 Run: gh auth login')
    console.log('   → Choose "SSH" when asked for protocol.\n')
    process.exit(1)
  }
}

function ensureSshKeyExists() {
  const sshKeyPath = path.join(
    process.env.HOME || process.env.USERPROFILE,
    '.ssh',
    'id_ed25519'
  )
  if (!fs.existsSync(sshKeyPath)) {
    console.warn('🔐 No SSH key found.')
    console.log('👉 Run this to generate one:\n')
    console.log('   ssh-keygen -t ed25519 -C "your-email@example.com"\n')
    console.log(
      'Then add your key to GitHub: https://github.com/settings/keys\n'
    )
    process.exit(1)
  }
}

function getGitHubTokenFromGhCli() {
  try {
    return execSync('gh auth token', { encoding: 'utf-8' }).trim()
  } catch {
    console.error('❌ GitHub CLI token not found.')
    process.exit(1)
  }
}

async function ensureRepoExists({ repoName, isPrivate, owner, octokit }) {
  try {
    const finalOwner =
      owner || (await octokit.users.getAuthenticated()).data.login
    await octokit.repos.get({ owner: finalOwner, repo: repoName })
    console.log(`✅ Repo "${finalOwner}/${repoName}" already exists.`)
  } catch (err) {
    if (err.status === 404) {
      const opts = { name: repoName, private: isPrivate }
      if (owner) {
        await octokit.repos.createInOrg({ org: owner, ...opts })
      } else {
        await octokit.repos.createForAuthenticatedUser(opts)
      }
      console.log(`📦 Created repo: ${owner || 'your account'}/${repoName}`)
      await sleep(2000)
    } else {
      throw err
    }
  }
}

function deployToGit({ dir, remoteUrl, branch, label }) {
  try {
    console.log(`🚀 Deploying ${dir} to ${label}...`)

    if (!fs.existsSync(path.join(dir, '.git'))) {
      execSync('git init', { cwd: dir, stdio: 'inherit' })
      execSync('git add .', { cwd: dir, stdio: 'inherit' })
      execSync('git commit -m "Initial commit"', { cwd: dir, stdio: 'inherit' })
    }

    try {
      execSync('git remote remove origin', { cwd: dir, stdio: 'ignore' })
    } catch {}

    execSync(`git remote add origin ${remoteUrl}`, {
      cwd: dir,
      stdio: 'inherit',
    })
    execSync(`git checkout -B ${branch}`, { cwd: dir, stdio: 'inherit' })

    try {
      execSync('git add .', { cwd: dir, stdio: 'inherit' })
      execSync('git commit -m "🔄 Update"', { cwd: dir, stdio: 'inherit' })
    } catch {}

    execSync(`git push -f origin ${branch}`, { cwd: dir, stdio: 'inherit' })

    console.log(`✅ Done pushing ${label}\n`)
  } catch (err) {
    console.error(`❌ Failed to push to ${label}:`, err)
  }
}

export default function githubDeployPlugin() {
  return {
    name: 'vite-plugin-github-deploy',

    async closeBundle() {
      if (process.env.DEPLOY !== 'true') return

      console.log('🔐 Deploy mode enabled (DEPLOY=true)')

      const cwd = process.cwd()
      const distPath = path.join(cwd, 'dist')
      const configPath = path.join(cwd, 'starter.config.js')

      if (!fs.existsSync(distPath)) {
        console.error('❌ No dist/ directory found. Run build first.')
        return
      }

      if (!fs.existsSync(configPath)) {
        console.warn('[deploy] No starter.config.js found. Skipping deploy.')
        return
      }

      ensureGitAndGhAuthenticated()
      ensureSshKeyExists()

      const userConfig = await import(configPath).then(
        (mod) => mod.default || mod
      )
      const { deploy = {}, cdn = {} } = userConfig
      const { mode = 'none', branch = 'main', publicRepo, privateRepo } = deploy
      const isOrg = cdn.org === true
      const owner = isOrg ? cdn.user : null

      const token = getGitHubTokenFromGhCli()
      const octokit = new Octokit({ auth: token })

      if (mode === 'none') {
        console.log('[deploy] Mode: none → skipping.')
        return
      }

      if (mode === 'public-only') {
        if (!publicRepo) {
          console.warn('[deploy] Missing publicRepo in config.')
          return
        }

        await ensureRepoExists({
          repoName: publicRepo,
          isPrivate: false,
          owner,
          octokit,
        })

        const remote = `git@github.com:${owner || cdn.user}/${publicRepo}.git`
        deployToGit({
          dir: cwd,
          remoteUrl: remote,
          branch,
          label: 'public repo (full project)',
        })
        return
      }

      if (mode === 'split') {
        if (!publicRepo || !privateRepo) {
          console.warn('[deploy] Missing publicRepo or privateRepo in config.')
          return
        }

        await ensureRepoExists({
          repoName: publicRepo,
          isPrivate: false,
          owner,
          octokit,
        })
        await ensureRepoExists({
          repoName: privateRepo,
          isPrivate: true,
          owner,
          octokit,
        })

        const remotePublic = `git@github.com:${
          owner || cdn.user
        }/${publicRepo}.git`
        const remotePrivate = `git@github.com:${
          owner || cdn.user
        }/${privateRepo}.git`

        deployToGit({
          dir: distPath,
          remoteUrl: remotePublic,
          branch,
          label: 'public repo (dist only)',
        })
        deployToGit({
          dir: cwd,
          remoteUrl: remotePrivate,
          branch,
          label: 'private repo (source)',
        })
        return
      }

      console.warn('[deploy] Unknown mode:', mode)
    },
  }
}
