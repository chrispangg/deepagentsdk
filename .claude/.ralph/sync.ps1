# Ensure UTF-8 throughout the pipeline
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

# Set console codepage to UTF-8 (suppressing output)
chcp 65001 | Out-Null

$PromptFile = ".claude/.ralph/prompt.md"

# If a prompt/ticket-name is provided, update prompt.md
if ($args.Count -gt 0 -and $args[0]) {
    $UserPrompt = $args[0]
    
    # Update prompt.md with user's prompt
    if ($UserPrompt -match "/" -or $UserPrompt -match "plan\.md") {
        # Looks like a path - prepend the command
        $UpdatedPrompt = "/3_implement_plan $UserPrompt"
    } else {
        # Use as-is (might be a full command)
        $UpdatedPrompt = $UserPrompt
    }
    
    # Read existing prompt.md, update first line, keep the rest
    $Lines = Get-Content $PromptFile -Encoding UTF8
    $NewContent = @($UpdatedPrompt, "") + ($Lines | Select-Object -Skip 2)
    $NewContent | Set-Content $PromptFile -Encoding UTF8
    
    Write-Host "Updated prompt.md with: $UpdatedPrompt"
}

Get-Content $PromptFile -Encoding UTF8 |
    claude -p --output-format=stream-json --verbose --dangerously-skip-permissions --add-dir . |
    Tee-Object -FilePath .claude/.ralph/claude_output.jsonl -Append |
    uvx --from rich python .claude/.ralph/visualize.py --debug