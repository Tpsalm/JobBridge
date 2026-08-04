import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Deployment trigger for the three-dot chat action menu (Messages page).
 *
 * POST /api/deploy  { action: 'commit' | 'push' | 'deploy' }
 *
 * Triggers a real production deployment for jobbridge.com.ng:
 *   1. (Preferred) VERCEL_DEPLOY_HOOK — a Vercel "Deploy Hook" URL. Posting to
 *      it starts a production build & deploy of the latest git-linked commit.
 *      Create one: Vercel Dashboard → Project → Settings → Git → Deploy Hooks.
 *   2. (Fallback)  GITHUB_PAT + GITHUB_REPO — dispatches the repo's
 *      `.github/workflows/deploy.yml` workflow on branch `main` via the
 *      GitHub API. The PAT needs `workflow` scope.
 *
 * Set exactly one of those env vars in your Vercel project settings.
 */

const ACTIONS = ['commit', 'push', 'deploy'] as const;
type Action = (typeof ACTIONS)[number];

const ACTION_LABELS: Record<Action, string> = {
  commit: 'Changes committed & production build started',
  push: 'Changes pushed & production build started',
  deploy: 'Production deployment triggered',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = (req.body || {}) as { action?: string };
  if (!action || !ACTIONS.includes(action as Action)) {
    return res.status(400).json({ error: `Invalid action. Expected one of: ${ACTIONS.join(', ')}` });
  }
  const act = action as Action;

  // ── 1) Vercel Deploy Hook (simplest, no auth) ─────────────────────────
  const vercelDeployHook = process.env.VERCEL_DEPLOY_HOOK;
  if (vercelDeployHook) {
    try {
      const resp = await fetch(vercelDeployHook, { method: 'POST' });
      const text = await resp.text().catch(() => '');
      if (resp.ok) {
        return res.status(200).json({
          ok: true,
          action: act,
          target: 'vercel',
          message: `${ACTION_LABELS[act]} on Vercel (jobbridge.com.ng) ✅`,
          jobId: text.trim() || null,
        });
      }
      return res.status(502).json({
        ok: false,
        error: 'Vercel deploy hook returned an error',
        details: text,
      });
    } catch (err: any) {
      return res.status(502).json({
        ok: false,
        error: 'Failed to reach the Vercel deploy hook',
        details: String(err?.message || err),
      });
    }
  }

  // ── 2) GitHub Actions workflow_dispatch (fallback) ────────────────────
  const githubPat = process.env.GITHUB_PAT;
  if (githubPat) {
    const repo = process.env.GITHUB_REPO || 'Tpsalm/JobBridge';
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/deploy.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${githubPat}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'jobbridge-deploy',
          },
          body: JSON.stringify({ ref: 'main' }),
        },
      );
      if (resp.status === 204 || resp.ok) {
        return res.status(200).json({
          ok: true,
          action: act,
          target: 'github-actions',
          message: `${ACTION_LABELS[act]} via GitHub Actions ✅`,
        });
      }
      const text = await resp.text().catch(() => '');
      return res.status(502).json({
        ok: false,
        error: 'GitHub Actions dispatch failed',
        details: text,
      });
    } catch (err: any) {
      return res.status(502).json({
        ok: false,
        error: 'Failed to reach the GitHub API',
        details: String(err?.message || err),
      });
    }
  }

  // ── 3) Not configured ──────────────────────────────────────────────────
  return res.status(500).json({
    ok: false,
    error:
      'Deployment not configured. Add VERCEL_DEPLOY_HOOK (or GITHUB_PAT) to your Vercel project environment variables to enable in-app deploys.',
  });
}
