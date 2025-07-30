# Scripts Directory

This directory contains utility scripts for the anode project.

## Available Scripts

### `create-pr.sh`

A comprehensive workflow script for creating pull requests with proper change management.

#### Features

- **Change Management**: Safely stashes your current work with descriptive names
- **Branch Creation**: Creates a new branch from the latest main
- **PR Creation**: Automatically creates a pull request using GitHub CLI
- **Workflow Safety**: Includes prerequisite checks and error handling

#### Prerequisites

1. **Git**: Must be installed and configured
2. **GitHub CLI**: Must be installed and authenticated
   - Install: https://cli.github.com/
   - Authenticate: `gh auth login`

#### Usage

```bash
./scripts/create-pr.sh
```

#### What it does

1. **Prompts for change title** - You'll be asked to provide a descriptive title for your changes
2. **Stashes staged changes** - Any staged changes are stashed with "TO-COMMIT:" prefix
3. **Stashes unstaged changes** - Any unstaged changes are stashed with "WIP:" prefix
4. **Switches to main** - Switches to the main branch
5. **Pulls latest** - Pulls the latest changes from origin/main
6. **Creates branch** - Creates a new branch with a sluggified version of your title
7. **Publishes branch** - Pushes the branch to origin and sets upstream
8. **Creates PR** - Creates a pull request using GitHub CLI
9. **Restores changes** - Applies your stashed changes to the new branch

#### Example

```bash
$ ./scripts/create-pr.sh
[INFO] Starting PR creation workflow...
[INFO] Checking prerequisites...
[SUCCESS] Prerequisites check passed
[INFO] Current branch: feature/my-changes
[INFO] Change title: Add new authentication feature
[INFO] Stashing staged changes as 'TO-COMMIT: Add new authentication feature'...
[SUCCESS] Stashed changes stashed successfully
[INFO] Stashing unstaged changes as 'WIP: Add new authentication feature'...
[SUCCESS] Unstaged changes stashed successfully
[INFO] Switching to main branch...
[INFO] Pulling latest changes from main...
[SUCCESS] Successfully switched to main and pulled latest changes
[INFO] Creating branch: add-new-authentication-feature
[INFO] Publishing branch to origin...
[SUCCESS] Branch 'add-new-authentication-feature' created and published successfully
[INFO] Creating pull request...
[SUCCESS] Pull request created successfully!
[INFO] Restoring stashed changes to new branch...
[SUCCESS] Stashed changes restored successfully
[SUCCESS] PR creation workflow completed successfully!
[INFO] Your changes are now available on branch: add-new-authentication-feature
[INFO] You can continue working on your changes and push updates as needed.
```

#### Safety Features

- **Error handling**: Script exits on any error with `set -e`
- **Prerequisite checks**: Verifies git and GitHub CLI are available
- **Authentication check**: Ensures GitHub CLI is properly authenticated
- **Confirmation prompts**: Asks for confirmation in edge cases
- **Colored output**: Clear visual feedback for different types of messages

#### Other Scripts

- `start-dev.sh` - Start the development server
- `start-runtime.sh` - Start the runtime server
- `start-iframe-output.sh` - Start the iframe output server
- `dev-runtime.sh` - Development runtime setup
- `use-runt.sh` - Runt integration script
- `optimize-build.sh` - Build optimization script
- `watch-script.cjs` - File watching script
