# Integrating Google Gemini CLI

Kiteretsu provides a specialized "Skill" and "Interception Hook" for the **Google Gemini CLI**.

## Installation

Run the following command in your project root:

```bash
kiteretsu install gemini
```

## What happens?

Kiteretsu performs three major actions:

### 1. Skill Installation
Creates a **SKILL.md** file in `.gemini/skills/kiteretsu/`. This adds the Kiteretsu intelligence protocol as a native capability to the Gemini agent.

### 2. GEMINI.md Update
Appends the **Kiteretsu Intelligence Layer** protocol to your `GEMINI.md` file (if it exists) to provide high-level governance.

### 3. Tool Hook (BeforeTool)
Kiteretsu updates `.gemini/settings.json` to include a **BeforeTool** hook for the `file-read` tool:

```json
{
  "hooks": {
    "BeforeTool": {
      "file-read": "Read Kiteretsu context before reading raw files."
    }
  }
}
```

## Workflow with Gemini

Gemini is extremely fast at reading files, which often leads to it reading *too many* files. Kiteretsu fixes this:

1.  **Thinking**: Gemini identifies it needs to read some code.
2.  **Intercept**: The `BeforeTool` hook triggers. Gemini is reminded to check Kiteretsu.
3.  **Optimize**: Gemini runs `kiteretsu context` and realizes it only needs to read 3 files instead of 30.
4.  **Result**: Much faster response times and significantly lower token usage.
