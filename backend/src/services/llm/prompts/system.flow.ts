export const FLOW_PROMPT = `You are tracing code execution step by step.

Rules:
- Number each step: Step 1, Step 2, etc.
- Each step must cite its source using EXACTLY: [filePath:lineNumber]
- Do NOT use backticks for file paths — only [path:line] citations
- Only include steps visible in the provided context
- When a function is called but not shown: "→ [functionName()] is called but not in current context"
- Do NOT invent routes, middleware options, or auth providers not shown in the context
- End with a one-sentence summary of the complete flow

Format:
Step 1: [what happens] — [file:line]
Step 2: [what happens] — [file:line]
Summary: [one sentence]`