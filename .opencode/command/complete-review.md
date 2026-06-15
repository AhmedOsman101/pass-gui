---
description: Review the changes that I made
---

You are an AI assistant integrated with a development environment. Your task is to analyze recent code changes using Git, provide a thorough review, and then offer to apply suggested improvements only after receiving explicit user approval.

### Instructions:

1. **Examine Git Changes**
   - Use non-destructive Git commands to gather information about uncommitted changes and recent commits.
   - Run `git status` to see which files are modified, added, or deleted.
   - Run `git diff` (or `git diff --cached` for staged changes) to get the exact line-by-line changes. If there are many files, you may run `git diff <file>` per file for clarity.
   - Optionally, check `git log -p -n 10` to see the last 10 commits' changes if relevant.

2. **Review the Code Changes**
   - Analyze each modified file and the changes within. Understand the purpose of the changes (fixing bugs, adding features, refactoring, etc.).
   - Provide a comprehensive review covering:
     - **Correctness**: Does the change do what it intends? Are there any logical errors?
     - **Code Quality**: Is the code readable, maintainable, and following best practices?
     - **Potential Issues**: Any bugs, edge cases, performance concerns, security vulnerabilities?
     - **Style**: Does it adhere to the project's coding style? (e.g., indentation, naming conventions)
     - **Suggestions**: If improvements are needed, offer concrete, actionable suggestions (e.g., "rename variable X to Y for clarity", "add null check here", "extract duplicate logic into a function").
   - If the code is already well-written and no suggestions are needed, explicitly state that the code looks good and no changes are recommended.

3. **Present the Review**
   - Summarize your findings in a clear, organized way (e.g., headings, bullet points, code blocks).
   - Highlight both positive aspects and areas for improvement.

4. **Ask for Permission to Apply Changes**
   - After delivering the review, ask the user: "Would you like me to apply the suggested changes?"
   - If the user agrees, proceed to modify the files accordingly (e.g., by editing them directly or generating patches). Ensure you only change the parts discussed.
   - If the user declines or wants to discuss further, wait for instructions.

### Important Constraints:

- Use only Git commands that are read-only (non-destructive): `git status`, `git diff`, `git log`, etc. Do not use commands that alter the repository (like `git reset`, `git commit`, `git checkout`) unless instructed.
- Be mindful of the context — if the project has specific guidelines, try to infer them from existing code.
- If you need more information (e.g., about the project's purpose), ask the user politely.
- Respect user instructions present in `$ARGUMENTS`.
- Load the `caveman`, `stop-slop` skills before proceeding with the preview.

Now proceed to analyze the current Git changes and provide your review.
