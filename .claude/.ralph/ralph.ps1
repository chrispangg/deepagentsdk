param(
    [switch]$Help,
    [string]$Prompt,
    [int]$MaxIterations = 0,
    [string]$CompletionMarker = "<promise>COMPLETE</promise>"
)

function Show-Usage {
    @"
Usage: ./.claude/.ralph/ralph.ps1 [-Help] [-Prompt <string>] [-MaxIterations <int>] [-CompletionMarker <string>]

  -Help               Show this message
  -Prompt             Optional: Update prompt.md with this command/prompt
                      (e.g., "docs/tickets/001_feature/plan.md")
  -MaxIterations      Number of loop iterations (0 = infinite, default: 0)
  -CompletionMarker   Marker to stop after detecting in .claude/.ralph/claude_output.jsonl
                      (default: <promise>COMPLETE</promise>)

Examples:
  # Use default prompt.md
  ./.claude/.ralph/ralph.ps1

  # Update prompt and run
  ./.claude/.ralph/ralph.ps1 -Prompt "docs/tickets/001_feature/plan.md"

  # Update prompt with max iterations
  ./.claude/.ralph/ralph.ps1 -Prompt "docs/tickets/001_feature/plan.md" -MaxIterations 10
"@
}

if ($Help) {
    Show-Usage
    exit 0
}

$PromptFile = ".claude/.ralph/prompt.md"
$OutputLog = ".claude/.ralph/claude_output.jsonl"

# Update prompt.md if user provided a prompt
if ($Prompt) {
    if ($Prompt -match "/" -or $Prompt -match "plan\.md") {
        # Looks like a path - prepend the command
        $UpdatedPrompt = "/3_implement_plan $Prompt"
    } else {
        # Use as-is (might be a full command)
        $UpdatedPrompt = $Prompt
    }
    
    # Read existing prompt.md, update first line, keep the rest
    $Lines = Get-Content $PromptFile -Encoding UTF8
    $NewContent = @($UpdatedPrompt, "") + ($Lines | Select-Object -Skip 2)
    $NewContent | Set-Content $PromptFile -Encoding UTF8
    
    Write-Host "Updated prompt.md with: $UpdatedPrompt"
}

function CheckCompletion {
    param(
        [string]$Path,
        [string]$Marker
    )

    if (-not (Test-Path $Path -PathType Leaf)) {
        return $false
    }

    return Select-String -Path $Path -Pattern ([regex]::Escape($Marker)) -Quiet
}

if ($MaxIterations -gt 0) {
    for ($i = 1; $i -le $MaxIterations; $i++) {
        Write-Host "Iteration: $i / $MaxIterations"
        & ./.claude/.ralph/sync.ps1
        if (CheckCompletion -Path $OutputLog -Marker $CompletionMarker) {
            Write-Host "Completion promise detected. Exiting loop."
            break
        }
        Write-Host "===SLEEP===`n===SLEEP===`n"
        Write-Host "looping"
        Start-Sleep -Seconds 10
    }
} else {
    while ($true) {
        & ./.claude/.ralph/sync.ps1
        if (CheckCompletion -Path $OutputLog -Marker $CompletionMarker) {
            Write-Host "Completion promise detected. Exiting loop."
            break
        }
        Write-Host "===SLEEP===`n===SLEEP===`n"
        Write-Host "looping"
        Start-Sleep -Seconds 10
    }
}
