---
title: "Announcing CommitCraft: AI commit messages that never leave your machine"
description: "CommitCraft is a VS Code extension that generates conventional commit messages from your staged diff using a local AI model. No API keys, no internet, no subscription."
date: 2026-04-03
tags: ["CommitCraft", "Release", "VS Code", "Local AI", "Developer Tooling"]
draft: false
---

Today I'm releasing [CommitCraft](https://commitcraft.cyferlawyn.org/) — a VS Code extension that reads your staged diff and writes a conventional commit message using an AI model running entirely on your machine.

No API key. No internet connection. No code ever sent to a remote server.

## The problem it solves

Writing commit messages is one of those tasks that sits at the intersection of "important" and "easy to do badly under time pressure." Conventional commits — `type(scope): subject` — are a well-established format that makes changelogs, releases, and `git log` actually readable. But getting the format right consistently, especially for a quick fix at the end of a long session, is friction that compounds.

Most AI tools that solve this send your diff to a remote model. That's a non-starter for any codebase with proprietary code, credentials in context, or a security-conscious employer. I wanted something that would just work, locally, without thinking about it.

## How it works

CommitCraft uses [Qwen2.5-Coder 3B](https://huggingface.co/Qwen/Qwen2.5-Coder-3B), a small code-focused language model distributed as a GGUF file. On first use, the extension downloads the model (~1.9 GB) to `~/.commitcraft/models/` — once, then never again.

From there the workflow is three steps:

1. **Install** CommitCraft from the VS Code Marketplace
2. **Stage** your changes as normal with `git add` or the Source Control panel
3. **Click the sparkle** (✦) in the Source Control title bar — CommitCraft reads the diff, runs inference locally, and writes the commit message directly into the input box

On a typical laptop CPU, generation takes 2–6 seconds. No GPU required.

## Conventional commits, every time

The output follows `type(scope): subject` format on every run:

```
fix(auth): return 401 when authorization header is missing
feat(payments): add Stripe webhook endpoint for subscription events
refactor(db): extract connection pooling into dedicated module
```

If you have a `commitlint` config in your repo, CommitCraft respects it.

## Pricing

CommitCraft is free to try for 14 days — no license needed. After that, a one-time license is **$9**.

No subscription. No seat limits. No expiry. License validation happens offline via Ed25519 signature, so it works the same whether or not you have an internet connection.

The extension itself is [MIT-licensed on GitHub](https://github.com/cyferlawyn/commitcraft-vscode). The compiled binaries ship under a commercial license.

## Get it

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cyferlawyn.cyferlawyn-commitcraft) — install and start the free trial
- [Buy a license — $9](https://cyferlawyn.gumroad.com/l/commitcraft)
- [GitHub](https://github.com/cyferlawyn/commitcraft-vscode) — source code, issues, and contributions
