---
title: Progressive Disclosure for AI Skills — A Practical Guide
description: How to give an AI agent only what it needs, when it needs it — from the one-sentence idea to a full routing architecture.
date: 2026-05-18
note: Compiled by Carlo V. Santiago
notion_link: https://carlovsantiago.notion.site/365cfaedc1ba80878b88ea64bf9c6379
---

# Progressive Disclosure for AI Skills

## The whole idea in one sentence

> **Give the AI only the instruction it needs for the step it's on — and reveal the deeper rules, examples, and edge cases only when they actually become relevant.**

That's it. If you remember nothing else, remember that. Everything below is just consequences of that one sentence.

---

## The everyday version

Imagine handing someone a 40-page manual to answer a one-line question. They'll spend more energy finding the relevant paragraph than doing the task — and they'll get distracted by nine things that don't apply. Models have the same problem. A skill that dumps everything up front is that 40-page manual.

A well-designed skill behaves like an **editorial binder with tabs**, not a scroll nailed to the agent's forehead. The front page tells you what the binder is for and which tab to open. You only open a tab when the task needs it.

Put differently: `SKILL.md` should be a **dispatcher, not a department store**. Its job is to route, not to contain.

### Why this matters

| Benefit | What it means in practice |
|---|---|
| **Less noisy** | The agent isn't distracted by rules that don't apply to this task. |
| **More reliable** | The core workflow is short enough to actually follow. |
| **More modular** | You can add deep references without bloating the main instructions. |
| **More reusable** | Beginners get a simple path; advanced users can drill down. |
| **More token-efficient** | The agent doesn't burn context on material it doesn't need yet. |

The underlying principle: **reveal complexity only when the user — or the model — has demonstrated readiness for it.**

---

## The minimal pattern you can use today

You don't need an architecture to get the benefit. The smallest version that works is a `SKILL.md` — a required header (called *frontmatter*) plus four sections, in this order:

```markdown
---
name: skill-name
description: What this skill does, AND when to use it — the exact
  user phrases and situations that should trigger it. This header is
  the skill's only triggering mechanism, so the "when to use" belongs
  here, never in the body below.
---

# Skill Name

## Purpose
What this skill helps with.

## Fast Path
The shortest reliable workflow — the 90% case.

## Decision Points
When to branch, and which deeper file to open for each branch.

## Deep References
Pointers (not contents) to detailed examples, templates, rubrics, edge cases.
```

The agent reads the **description** first to decide whether this skill applies at all — that's why "when to use" lives there and nowhere else. If it applies, it reads **Purpose → Fast Path** and starts working, consulting the deeper sections only when a Decision Point sends it there.

The rule of thumb for ordering anything inside a skill:

> Core instructions first. Detailed rules second. Examples third. Edge cases last.
> **Do not make the AI read the appendix before it knows what job it has.**

A skill folder only has three standard subfolders, all optional. The minimal durable setup is just:

```text
skill-name/
  SKILL.md      required — the frontmatter + four sections above
  references/   deep knowledge, opened on demand
                (genre guides, craft notes, rubrics, step-by-step procedures)
  assets/       files used in the output (templates, boilerplate, icons)
  scripts/      optional — runnable code for repetitive, exact tasks
```

Those three folder names — `references/`, `assets/`, `scripts/` — are the convention. Role words you'll hear later in this guide (*playbook*, *rubric*, *template*) describe **what a file does**, not a folder it needs: a playbook or rubric is just a file inside `references/`; a template is a file inside `assets/`. Don't create a folder per role.

That is enough structure to stay discoverable without turning the system into a private government agency. **If you stop reading here, you can already build a good skill.** The rest is for when one skill has to carry a lot.

---

## Optional deep dive — the full routing architecture

> Read on only if your skill is large: many task modes, a real knowledge base, project-specific facts mixed with reusable craft. If your skill fits the minimal pattern, skip to the recap.

A note before the diagrams: the example below uses descriptive subfolders like `playbooks/` and `rubrics/`. These are an *organizational layer you build inside `references/`* — a way to group a large knowledge base by role. The three standard folders (`references/`, `assets/`, `scripts/`) and the `SKILL.md` frontmatter from the minimal pattern still apply unchanged; this section adds routing on top of them, it doesn't replace them.

### The three-layer model

```text
SKILL.md      → identifies the job, names the modes, sets quality gates
_routing.yaml → maps "if the user asks X, load Y, judge with Z"
references/   → deep knowledge, opened only when a trigger fires
```

`SKILL.md` is short, procedural, and bossy. It answers six questions and nothing else: what is this for, what are the task modes, what loads first, how does it decide what to load next, what output standards always apply, and what to avoid.

### `_routing.yaml` — the agent's map

This is the most important file in the deep version. It turns "read this if needed" into a behavioral trigger.

```yaml
version: 1
task_modes:
  scene_drafting:
    triggers: ["write a scene", "draft this scene", "turn this plan into prose"]
    load:
      playbook: "playbooks/draft-scene.md"
      templates: ["templates/scene-brief.md"]
      rubrics: ["rubrics/scene-quality-rubric.md"]
      references:
        conditional:
          - file: "references/craft/pov.md"
            use_when: "POV is specified, inconsistent, or part of the request"
          - file: "references/craft/dialogue.md"
            use_when: "scene is dialogue-heavy"
    output:
      default: "draft prose"
```

The `conditional` block is progressive disclosure made literal: the reference is named, but it only loads when the stated condition is true.

### Give every reference a document card

So the agent can decide *whether* to open a file without reading it, put a header on each one:

```markdown
---
id: genre.monster_in_the_house
type: reference
use_when:
  - The active genre is Monster in the House.
  - The task involves containment, transgression, or escalating threat.
do_not_use_when:
  - The user only asks for copyediting.
pairs_with:
  - rubrics/genre-alignment-rubric.md
authority: high
---
```

Dull, rigid, and extremely useful — a rare triumph for bureaucracy.

### The default load rule

> **One task = one playbook + one template + one rubric + only the references triggered by the task.**

Exceed it only when the user explicitly asks for a broad audit, the chosen rubric reveals a specific weakness, a required project fact is missing, or genre/continuity/prose standards directly affect the output.

| User request | Load |
|---|---|
| "Draft this scene." | draft-scene playbook, scene-brief template, active genre guide, scene rubric |
| "Fix the prose." | edit-prose playbook, prose rubric, prose standards |
| "Does this fit the genre?" | genre-alignment playbook, the one genre guide, genre rubric |
| "Full diagnostic." | audit playbook, multiple rubrics, routing map, relevant project files |

### When files disagree, follow an authority order

Agents otherwise treat every document as if it were carved in stone. State the precedence explicitly:

```markdown
1. Current user instruction
2. Project-specific story state
3. Project-specific genre / prose standards
4. Reusable skill playbooks
5. General references
6. Examples
```

And keep **reusable skill material separate from project-specific material**. The skill explains *how to work*; the project files define *this specific book*. Bury story facts inside the reusable skill and one zombie novel will quietly infect your cozy sapphic mystery — file systems enjoy genre contamination too.

### The discovery sequence (put this in `SKILL.md` verbatim)

```markdown
When activated:
1. Identify the task mode.
2. Open _routing.yaml.
3. Select the matching task pack.
4. Load the required playbook, template, rubric.
5. Load references only if the task triggers them.
6. Produce the output.
7. Run the relevant quality gate before finalizing.
```

---

## Recap — what you just did

Notice the shape of this guide. You got the entire concept in **one sentence**. Then a metaphor and a payoff table. Then a minimal pattern you could ship today — and an explicit invitation to *stop there*. The YAML, document cards, and authority maps were gated behind a single line that told you when they applied to you and when they didn't.

That's not a coincidence. **This document was itself progressively disclosed.** You never had to read the appendix to learn what the job was. If you only needed the idea, you spent thirty seconds. If you're building a large skill, the deep layer was there the moment you were ready for it — and not before.

That is the entire discipline, and you've now experienced it from both sides: as the reader who benefited from it, and as the designer who's about to apply it.

**Walk away with three things:**

1. **The sentence** — only what's needed, only when it's needed.
2. **The order** — core, then detail, then examples, then edge cases. Never the reverse.
3. **The test** — your `SKILL.md` should be able to answer *"what phase am I in, and what file governs it?"* in under ten lines. If it can't, it's being a department store when it should be a dispatcher.

Build the minimal version first. Add the routing architecture the day a single skill starts straining under its own weight — not before. The whole point is to not carry what you don't need yet.

---

## Terminology — plain-language glossary

For non-coders: here's every technical term in this guide, in writer's terms.

- **Agent / AI agent** — the AI doing the work for you (Claude, ChatGPT, etc.). Think of it as a very fast, very literal collaborator who only knows what you put in front of it.

- **Skill** — a folder of instructions you give the agent so it does a task your way every time. Like a style guide and a process checklist bundled together. `SKILL.md` is its cover page.

- **`SKILL.md`** — the one file the agent reads first. The `.md` means *Markdown*, the same plain-text-with-formatting you'd use in most note apps. Treat it as the table of contents, not the book.

- **Edge case** — the rare, weird exception that isn't the normal situation. If your skill usually drafts scenes but occasionally has to handle a flashback inside a dream inside a letter, *that* is an edge case. You don't want the agent thinking about it during ordinary work.

- **Context window** — the agent's short-term memory: how much text it can hold in mind at once. It's finite. Fill it with irrelevant rules and there's less room for your actual story.

- **Token** — roughly a chunk of a word; how AI measures text length. "Token-efficient" just means "doesn't waste the agent's limited attention on things it doesn't need."

- **Playbook** — a step-by-step procedure for one job (e.g. "how to draft a scene"). The *how-to*.

- **Template** — a fill-in-the-blanks structure for the output (e.g. a scene brief with set fields). The *shape of the result*. Lives in the `assets/` folder.

- **Rubric** — a scoring guide for judging quality (e.g. "does this scene have tension, movement, a clear POV?"). The *grading sheet*. (You may already know this word from teaching — same idea.)

- **Reference** — the deep knowledge files: genre guides, craft notes, trope libraries, playbooks, rubrics. The *research shelf* the agent only walks over to when it needs something specific. All of these live in the `references/` folder.

- **Trigger / conditional / "use_when"** — the *if-then* that decides whether the agent opens a particular file. "If the scene is dialogue-heavy, open the dialogue notes." The condition is the trigger.

- **Routing / dispatcher** — sending the agent to the right file for the task at hand, instead of making it read everything. Like a librarian pointing you to the right shelf rather than handing you the whole library.

- **`_routing.yaml`** — the map file that lists those if-then rules. *YAML* is just a simple, indented plain-text format for settings — readable by humans, no coding required to edit it.

- **Manifest / registry** — a list-of-contents file. It says *what exists and where*, not the contents themselves. A map, not the territory.

- **Document card / frontmatter** — the little labeled header at the very top of a file, between the `---` lines (you can see one at the top of *this* document). It tells the agent what the file is for before it reads the file itself — like the back-cover copy of a book.

- **Authority order** — the rule for who wins when two files disagree. Same as deciding that your latest editorial note overrides an older outline.

- **Audit** — a thorough top-to-bottom review pass, as opposed to a quick targeted fix. A full manuscript read versus correcting one typo.

- **Gated / gating** — putting something behind a condition so it only appears when relevant. The "read on only if your skill is large" line earlier in this guide was a gate.

- **Modular** — built from separate, swappable pieces. You can replace one piece without rewriting the whole thing — like chapters you can reorder rather than one unbroken scroll.
