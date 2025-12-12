#!/usr/bin/env bash

print_usage() {
    cat <<'USAGE'
Usage: ./.claude/.ralph/ralph.sh [prompt] [max_iterations] [completion_marker]

Arguments:
  prompt            Optional: Update prompt.md with this command/prompt
                    (e.g., "docs/tickets/001_feature/plan.md")
  max_iterations    Number of loop iterations (0 = infinite, default: 0)
  completion_marker Marker to stop after detecting in .claude/.ralph/claude_output.jsonl
                                        (default: <promise>COMPLETE</promise>)

Examples:
  # Use default prompt.md
  ./.claude/.ralph/ralph.sh

  # Update prompt and run
  ./.claude/.ralph/ralph.sh "docs/tickets/001_feature/plan.md"

  # Update prompt with max iterations
  ./.claude/.ralph/ralph.sh "docs/tickets/001_feature/plan.md" 10
USAGE
}

if [[ $1 == "-h" || $1 == "--help" ]]; then
    print_usage
    exit 0
fi

prompt_file=".claude/.ralph/prompt.md"
output_log=".claude/.ralph/claude_output.jsonl"

# If first argument doesn't look like a number, treat it as a prompt
if [[ -n "$1" && ! "$1" =~ ^[0-9]+$ ]]; then
    user_prompt="$1"
    max_iterations=${2:-0}
    completion_marker=${3:-"<promise>COMPLETE</promise>"}
    
    # Update prompt.md with user's prompt
    if [[ "$user_prompt" == *"/"* ]] || [[ "$user_prompt" == *"plan.md"* ]]; then
        # Looks like a path - prepend the command
        updated_prompt="/3_implement_plan $user_prompt"
    else
        # Use as-is (might be a full command)
        updated_prompt="$user_prompt"
    fi
    
    # Update first line of prompt.md, keep the rest
    {
        echo "$updated_prompt"
        echo ""
        tail -n +3 "$prompt_file"
    } > "$prompt_file.tmp" && mv "$prompt_file.tmp" "$prompt_file"
    
    echo "Updated prompt.md with: $updated_prompt"
else
    # No prompt provided, use existing prompt.md
    max_iterations=${1:-0}
    completion_marker=${2:-"<promise>COMPLETE</promise>"}
fi

check_completion() {
    if [ -f "$output_log" ] && grep -q "$completion_marker" "$output_log"; then
        echo "Completion promise detected. Exiting loop."
        return 0
    fi

    return 1
}

if [ "$max_iterations" -gt 0 ]; then
    for ((i = 1; i <= max_iterations; i++)); do
        echo "Iteration: $i / $max_iterations"
        ./.claude/.ralph/sync.sh
        if check_completion; then
            break
        fi
        echo -e "===SLEEP===\n===SLEEP===\n"
        echo "looping"
        sleep 10
    done
else
    while true; do
        ./.claude/.ralph/sync.sh
        if check_completion; then
            break
        fi
        echo -e "===SLEEP===\n===SLEEP===\n"
        echo "looping"
        sleep 10
    done
fi