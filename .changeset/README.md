# Changesets

This folder contains changeset files for tracking version bumps.

## Creating a changeset

After making changes to any package, run:

```bash
bun run changeset
```

This will prompt you to:

1. Select which packages have changed
2. Choose the semver bump type (patch/minor/major)
3. Write a summary of your changes

Commit the generated changeset file along with your code changes.

## What happens on release

When a release is triggered:

1. All pending changesets are consumed
2. Package versions are bumped according to the changesets
3. CHANGELOG.md files are updated
4. Packages are published to npm in dependency order
