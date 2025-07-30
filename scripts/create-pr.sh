#!/bin/bash

# Create PR workflow script for anode project
# This script handles the complete workflow for creating a PR with proper change management

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to sluggify a string (convert to lowercase, replace spaces with hyphens, remove special chars)
sluggify() {
    echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g' | cut -c1-50
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists git; then
        print_error "Git is not installed"
        exit 1
    fi
    
    if ! command_exists gh; then
        print_error "GitHub CLI (gh) is not installed. Please install it first."
        print_status "Installation guide: https://cli.github.com/"
        exit 1
    fi
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi
    
    # Check if gh is authenticated
    if ! gh auth status > /dev/null 2>&1; then
        print_error "GitHub CLI is not authenticated. Please run 'gh auth login' first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to get current branch
get_current_branch() {
    git branch --show-current
}

# Function to check if there are any changes
has_changes() {
    ! git diff-index --quiet HEAD -- || ! git diff --cached --quiet
}

# Function to check if there are staged changes
has_staged_changes() {
    ! git diff --cached --quiet
}

# Function to check if there are unstaged changes
has_unstaged_changes() {
    ! git diff --quiet
}

# Function to prompt for change title
get_change_title() {
    local title
    while true; do
        read -p "Enter a descriptive title for your changes: " title
        if [[ -n "$title" ]]; then
            echo "$title"
            break
        else
            print_warning "Title cannot be empty. Please try again."
        fi
    done
}

# Function to stash staged changes
stash_staged_changes() {
    local title="$1"
    local stash_name="TO-COMMIT: $title"
    
    print_status "Stashing staged changes as '$stash_name'..."
    
    # Create a temporary commit to stash staged changes
    git commit --no-verify -m "temp: staged changes for stash"
    
    # Stash the temporary commit
    git stash push -m "$stash_name"
    
    # Reset to remove the temporary commit
    git reset --soft HEAD~1
    
    print_success "Staged changes stashed successfully"
}

# Function to stash unstaged changes
stash_unstaged_changes() {
    local title="$1"
    local stash_name="WIP: $title"
    
    print_status "Stashing unstaged changes as '$stash_name'..."
    git stash push -m "$stash_name"
    print_success "Unstaged changes stashed successfully"
}

# Function to switch to main and pull latest
switch_to_main_and_pull() {
    print_status "Switching to main branch..."
    git checkout main
    
    print_status "Pulling latest changes from main..."
    git pull origin main
    
    print_success "Successfully switched to main and pulled latest changes"
}

# Function to create and publish branch
create_and_publish_branch() {
    local title="$1"
    local branch_name
    
    # Create branch name from title
    branch_name=$(sluggify "$title")
    
    print_status "Creating branch: $branch_name"
    git checkout -b "$branch_name"
    
    print_status "Publishing branch to origin..."
    git push -u origin "$branch_name"
    
    print_success "Branch '$branch_name' created and published successfully"
    echo "$branch_name"
}

# Function to create PR
create_pr() {
    local title="$1"
    local branch_name="$2"
    
    print_status "Creating pull request..."
    
    # Create PR using GitHub CLI
    gh pr create \
        --title "$title" \
        --body "" \
        --base main \
        --head "$branch_name"
    
    print_success "Pull request created successfully!"
}

# Function to restore stashed changes
restore_stashed_changes() {
    local title="$1"
    local branch_name="$2"
    
    print_status "Restoring stashed changes to new branch..."
    
    # Switch to the new branch
    git checkout "$branch_name"
    
    # Find and apply TO-COMMIT stash
    local to_commit_stash=$(git stash list | grep "TO-COMMIT: $title" | head -1 | cut -d: -f1)
    if [[ -n "$to_commit_stash" ]]; then
        print_status "Applying TO-COMMIT stash..."
        git stash pop "$to_commit_stash"
    fi
    
    # Find and apply WIP stash
    local wip_stash=$(git stash list | grep "WIP: $title" | head -1 | cut -d: -f1)
    if [[ -n "$wip_stash" ]]; then
        print_status "Applying WIP stash..."
        git stash pop "$wip_stash"
    fi
    
    print_success "Stashed changes restored successfully"
}

# Main workflow
main() {
    print_status "Starting PR creation workflow..."
    
    # Check prerequisites
    check_prerequisites
    
    # Get current branch
    local current_branch=$(get_current_branch)
    print_status "Current branch: $current_branch"
    
    # Check if we're already on main
    if [[ "$current_branch" == "main" ]]; then
        print_warning "You are currently on the main branch. Consider creating your changes on a feature branch first."
        read -p "Do you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Workflow cancelled"
            exit 0
        fi
    fi
    
    # Check if there are any changes
    if ! has_changes; then
        print_warning "No changes detected. Nothing to stash."
        read -p "Do you want to continue with branch creation and PR? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Workflow cancelled"
            exit 0
        fi
    fi
    
    # Get change title
    local change_title=$(get_change_title)
    print_status "Change title: $change_title"
    
    # Stash changes if they exist
    if has_changes; then
        if has_staged_changes; then
            stash_staged_changes "$change_title"
        fi
        
        if has_unstaged_changes; then
            stash_unstaged_changes "$change_title"
        fi
    fi
    
    # Switch to main and pull latest
    switch_to_main_and_pull
    
    # Create and publish branch
    local branch_name=$(create_and_publish_branch "$change_title")
    
    # Create PR
    create_pr "$change_title" "$branch_name"
    
    # Restore stashed changes if they exist
    if has_changes; then
        restore_stashed_changes "$change_title" "$branch_name"
    fi
    
    print_success "PR creation workflow completed successfully!"
    print_status "Your changes are now available on branch: $branch_name"
    print_status "You can continue working on your changes and push updates as needed."
}

# Run main function
main "$@" 