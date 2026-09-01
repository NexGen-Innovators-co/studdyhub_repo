# How to Resolve Git Merge Conflicts

## What Causes Conflicts?

A conflict happens when Git can't automatically merge changes because the **same line** in the same file was edited in both branches.

Example:
- You change line 10 in `Header.tsx` on your branch
- Someone else changes line 10 in `Header.tsx` on `main`
- Git doesn't know which version to keep → **conflict**

---

## What a Conflict Looks Like

Git marks conflicts with these markers:

```
<<<<<<< HEAD
Your changes (from your branch)
=======
Their changes (from the branch you're merging into)
>>>>>>> origin/main
```

- `<<<<<<< HEAD` = **your** version (current branch)
- `=======` = divider
- `>>>>>>> origin/main` = **their** version (target branch)

---

## Step-by-Step Resolution

### 1. Start the merge

```bash
git fetch origin
git merge origin/main
```

If there are conflicts, Git will say:
```
CONFLICT (content): Merge conflict in path/to/file.tsx
Automatic merge failed; fix conflicts and then commit the result.
```

### 2. Find the conflicted files

```bash
git status
```

Files with conflicts show as `both modified`.

Or search for conflict markers:

```bash
# In PowerShell:
Select-String -Path "path/to/file.tsx" -Pattern "<<<<<<" 

# In bash/terminal:
grep -rn "<<<<<<" path/to/file.tsx
```

### 3. Open the file and resolve each conflict

You'll see blocks like this:

```
<<<<<<< HEAD
      <Button onClick={handleClick}>Download</Button>
=======
      <a href="/download.apk">
        <Button>Download</Button>
      </a>
>>>>>>> origin/main
```

**You must:**
1. **Delete** the `<<<<<<<`, `=======`, and `>>>>>>>` markers
2. **Keep the version you want** (or combine both)
3. Make sure the code is syntactically correct

Example — keeping your version:
```tsx
      <Button onClick={handleClick}>Download</Button>
```

Example — keeping their version:
```tsx
      <a href="/download.apk">
        <Button>Download</Button>
      </a>
```

Example — combining both (if both changes are needed):
```tsx
      <a href="/download.apk">
        <Button onClick={handleClick}>Download</Button>
      </a>
```

### 4. Verify no conflict markers remain

```bash
# PowerShell:
Get-ChildItem -Recurse -Include *.tsx,*.ts,*.kt -Exclude node_modules | 
  Select-String -Pattern "<<<<<<"

# Or just check specific files:
Select-String -Path "path/to/file.tsx" -Pattern "<<<<<<"
```

If nothing is returned, all conflicts are resolved.

### 5. Stage and commit

```bash
git add path/to/file.tsx
git commit -m "resolve merge conflicts: description of what you chose"
```

**Do NOT** use `git commit -m "merge"` — describe what you resolved.

### 6. Push

```bash
git push
```

---

## Quick Reference: Resolving in This Project

When merging `main` into your feature branch:

```bash
git fetch origin
git merge origin/main
# If conflicts:
# 1. Open conflicted files in VS Code
# 2. Search for <<<<<<" 
# 3. Decide which version to keep
# 4. Delete the conflict markers
# 5. Save, stage, commit, push
```

---

## Common Patterns We Use

| Scenario | Resolution |
|---|---|
| Both add different features to same file | Keep both if they don't overlap |
| One renames a variable, other uses old name | Keep the new name, update references |
| One adds a new import, other modifies same section | Keep both imports |
| Both modify the same function differently | Decide which behavior is correct, or merge logic |

---

## VS Code Conflict Resolution (Easier)

1. Open the conflicted file
2. Click the **"Git: Open File"** link in the conflict markers
3. Use the buttons above each conflict:
   - **Accept Current** — keep your version
   - **Accept Incoming** — keep their version
   - **Accept Both** — keep both versions
4. Save and commit

---

## What NOT to Do

- **Don't** commit with conflict markers still in the file
- **Don't** just accept both without checking if they conflict
- **Don't** force push to overwrite someone else's work
- **Don't** merge without testing if your changes still work

---

## Practice

To practice, create a test branch and simulate a conflict:

```bash
git checkout -b test-conflict
echo "line 1" > test.txt
git add test.txt && git commit -m "add test.txt"

git checkout main
echo "different line 1" > test.txt
git add test.txt && git commit -m "modify test.txt on main"

git checkout test-conflict
git merge main
# Conflict! Resolve it.
```
