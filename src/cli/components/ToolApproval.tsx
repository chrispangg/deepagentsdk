/**
 * Tool approval component for interactive approval flow.
 */
import React from "react";
import { Box, Text, useInput } from "ink";

interface ToolApprovalProps {
  toolName: string;
  args: unknown;
  onApprove: () => void;
  onDeny: () => void;
  onApproveAll?: () => void;
}

export function ToolApproval({
  toolName,
  args,
  onApprove,
  onDeny,
  onApproveAll,
}: ToolApprovalProps): React.ReactElement {
  useInput((input, key) => {
    if (input === "y" || input === "Y") {
      onApprove();
    } else if (input === "n" || input === "N" || key.escape) {
      onDeny();
    } else if ((input === "a" || input === "A") && onApproveAll) {
      onApproveAll();
    }
  });

  // Format args for display (truncate if too long)
  const argsDisplay = JSON.stringify(args, null, 2);
  const truncatedArgs =
    argsDisplay.length > 500
      ? argsDisplay.slice(0, 500) + "\n... (truncated)"
      : argsDisplay;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      marginY={1}
    >
      <Text bold color="yellow">
        🛑 Tool Approval Required
      </Text>
      <Text>
        Tool: <Text bold>{toolName}</Text>
      </Text>
      <Box marginTop={1}>
        <Text dimColor>Arguments:</Text>
      </Box>
      <Text>{truncatedArgs}</Text>
      <Box marginTop={1}>
        <Text>
          Press <Text bold color="green">[Y]</Text> to approve,{" "}
          <Text bold color="red">[N]</Text> to deny
          {onApproveAll && (
            <>
              , <Text bold color="blue">[A]</Text> to approve all (enable auto-approve)
            </>
          )}
        </Text>
      </Box>
    </Box>
  );
}
