---
title: "Why I built CommitCraft offline-first"
description: "Most AI dev tools phone home. CommitCraft doesn't. Here's the reasoning behind that constraint and what it forced me to get right."
date: 2026-03-15
tags: ["CommitCraft", "Local AI", "Developer Tooling"]
draft: false
---

Every AI-assisted developer tool I've evaluated over the past two years makes the same architectural decision: send the code to a remote model, stream back a result. It's the path of least resistance. The models are better, the latency is acceptable on a good connection, and you don't have to think about inference infrastructure.

I made the opposite choice with CommitCraft, and it wasn't primarily about privacy — though that mattered. It was about **the contract with the user**.

## The problem with remote calls in a tight loop

Commit message generation sits inside one of the tightest feedback loops in software development. You stage a change, you want a message, you want to move on. Any latency you introduce is felt as friction. More importantly, any *variable* latency — depending on network conditions, API quotas, server load — trains the developer to distrust the tool.

I've watched engineers disable tools that worked well 80% of the time because the other 20% was unpredictable. Reliability is more important than peak quality.

An on-device model running on a predictable CPU has predictable latency. 2–6 seconds on a laptop, every time. That's a latency profile a developer can internalize and trust.

## What the offline constraint forced me to fix

Running locally meant I couldn't lean on a GPT-4-class model to paper over a vague prompt. I had to get the prompt right for a 3B parameter model to produce consistently structured output. That turned out to be useful discipline.

The conventional commit format — `type(scope): subject` — is rigid enough that a small, fine-tuned model handles it well. Constraining the output format to something the model has seen millions of times means the 3B parameter ceiling isn't a real ceiling for this specific task.

```
fix(auth): return 401 when authorization header is missing
feat(payments): add Stripe webhook endpoint for subscription events
refactor(db): extract connection pooling into dedicated module
```

A larger model would occasionally produce better descriptions of *why* a change was made. But it would also occasionally time out, fail, or cost money. The smaller model produces correct, parseable output on every run.

## The license validation problem

The obvious objection to fully offline software is: how do you prevent copying? My answer is Ed25519 signature verification. The license key *is* the signature. The extension ships with the public key and verifies it locally — no server involved, no expiry check that can fail, no grace period logic that needs maintenance.

This isn't a new idea, but it's underused in small dev tools. It means the license infrastructure never becomes a reliability dependency.

## What I'd do differently

The model download on first use (~1.9 GB) is the roughest part of the experience. I underestimated how much progress feedback matters for a download that long. It works, but the UX around it deserves more attention than I gave it in the initial release.

That's next.
