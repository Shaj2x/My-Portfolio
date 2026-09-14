# Project skills

Each folder here is a skill Claude can load on demand in any session working
in this repo. A skill is one folder containing `SKILL.md`:

```
.claude/skills/<skill-name>/SKILL.md
```

`SKILL.md` needs YAML frontmatter with `name` and `description`:

```md
---
name: my-skill
description: What this covers and WHEN to read it. This sentence is the only
  thing Claude sees before deciding to load the skill, so write it as a
  trigger — name the tasks and words that should pull it in.
---

# Body

Everything below the frontmatter is the instruction Claude follows once the
skill loads.
```

The `description` is the important part: it is the trigger. Everything below
the frontmatter is only read after the skill is loaded.

## Supporting files

Put references, templates and scripts in the same folder and point to them
from `SKILL.md` by relative path. Claude reads them only when the skill says
to, which keeps the skill itself short:

```
.claude/skills/my-skill/
├── SKILL.md
├── REFERENCE.md
└── scripts/check.py
```

## Where skills can live

| Location                       | Applies to                    | In a Claude Code web session? |
| ------------------------------ | ----------------------------- | ----------------------------- |
| `.claude/skills/` (this folder)| Anyone working in this repo   | Yes — it is committed         |
| `~/.claude/skills/`            | Only you, on your own machine | No                            |

Commit anything you want available in web sessions or to collaborators.

## Skill or CLAUDE.md?

- **`CLAUDE.md`** (repo root) is always in context. Use it for a handful of
  facts that matter on every single task.
- **A skill** is loaded on demand. Use it for anything long or situational —
  it costs nothing until it is needed.

A new skill is usually picked up in a fresh session rather than the one you
added it in.
