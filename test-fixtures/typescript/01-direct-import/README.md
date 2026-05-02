# Direct Import Test

This fixture tests the most basic dependency pattern: a direct named import from one file to another.

## Why it's tricky
While simple, any failure here indicates a fundamental issue with the Tree-sitter query or the path resolution logic.

## Correct Behavior
Changing `userService.ts` should include `authMiddleware.ts` in the blast radius.
