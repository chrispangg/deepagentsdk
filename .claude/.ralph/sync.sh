#!/usr/bin/env bash

prompt_file=".claude/.ralph/prompt.md"

# If a prompt/ticket-name is provided, update prompt.md
if [ -n "$1" ]; then
    user_prompt="$1"
    
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
fi

cat "$prompt_file" | \
    claude -p --output-format=stream-json --verbose --dangerously-skip-permissions --add-dir . | \
    tee -a .claude/.ralph/claude_output.jsonl | \
    uvx --from rich python .claude/.ralph/visualize.py --debug