---
name: 9_research_cloud
description: Conduct comprehensive READ-ONLY analysis of cloud deployments and infrastructure
model: claude-sonnet-4-5-20250929
allowed-tools: AskUserQuestion, Edit, Task, TodoWrite, Write, Bash(git:*), Bash(gh:*), Bash(basename:*), Bash(date:*), Bash(az:*), Bash(aws:*), Bash(gcloud:*)
argument-hint: [cloud-platform-and-scope]
---

# Research Cloud Infrastructure

You are tasked with conducting comprehensive READ-ONLY analysis of cloud deployments and infrastructure using cloud-specific CLI tools (az, aws, gcloud, etc.).

⚠️ **IMPORTANT SAFETY NOTE** ⚠️
This command only executes READ-ONLY cloud CLI operations. All commands are safe inspection operations that do not modify any cloud resources.

## Initial Setup

When this command is invoked, respond with:

```
I'm ready to analyze your cloud infrastructure. Please specify:
1. Which cloud platform (Azure/AWS/GCP/other)
2. What aspect to focus on (or "all" for comprehensive analysis):
   - Resources and architecture
   - Security and compliance
   - Cost optimization
   - Performance and scaling
   - Specific services or resource groups
```

Then wait for the user's specifications.

## Steps to follow after receiving the cloud research request

1. **Verify Cloud CLI Access:**
   - Check if the appropriate CLI is installed (az, aws, gcloud)
   - Verify authentication status
   - Identify available subscriptions/projects

2. **Decompose the Research Scope:**
   - Break down the analysis into research areas
   - Create a research plan using TodoWrite
   - Identify specific resource types to investigate
   - Plan parallel inspection tasks

3. **Execute Cloud Inspection (READ-ONLY):**
   - Run safe inspection commands for each resource category
   - All commands are READ-ONLY operations that don't modify resources
   - Examples of safe commands:
     - `az vm list --output json` (lists VMs)
     - `az storage account list` (lists storage)
     - `az network vnet list` (lists networks)

4. **Systematic Resource Inspection:**
   - Compute resources (list VMs, containers, functions)
   - Storage resources (list storage accounts, databases)
   - Networking (list VNets, load balancers, DNS)
   - Security (list firewall rules, IAM roles)
   - Cost analysis (query billing APIs - read only)

5. **Synthesize Findings:**
   - Compile all inspection results
   - Create unified view of infrastructure
   - Create architecture diagrams where appropriate
   - Generate cost breakdown and optimization recommendations
   - Identify security risks and compliance issues

6. **Generate Cloud Research Document:**

   ```markdown
   ---
   date: [Current date and time in ISO format]
   researcher: Claude
   platform: [Azure/AWS/GCP]
   environment: [Production/Staging/Dev]
   subscription: [Subscription/Account ID]
   tags: [cloud, infrastructure, platform-name, environment]
   status: complete
   ---

   # Cloud Infrastructure Analysis: [Environment Name]

   ## Analysis Scope
   - Platform: [Cloud Provider]
   - Subscription/Project: [ID]
   - Regions: [List]
   - Focus Areas: [What was analyzed]

   ## Executive Summary
   [High-level findings, critical issues, and recommendations]

   ## Resource Inventory
   [Table of resources by type, count, region, and cost]

   ## Architecture Overview
   [Visual or textual representation of deployment architecture]

   ## Detailed Findings

   ### Compute Infrastructure
   [VMs, containers, serverless findings]

   ### Data Layer
   [Databases, storage, caching findings]

   ### Networking
   [Network topology, security groups, routing]

   ### Security Analysis
   [IAM, encryption, compliance findings]

   ## Cost Analysis
   - Current Monthly Cost: $X
   - Projected Annual Cost: $Y
   - Optimization Opportunities: [List]
   - Unused Resources: [List]

   ## Risk Assessment
   ### Critical Issues
   - [Security vulnerabilities]
   - [Single points of failure]

   ### Warnings
   - [Configuration concerns]
   - [Cost inefficiencies]

   ## Recommendations
   ### Immediate Actions
   1. [Security fixes]
   2. [Critical updates]

   ### Short-term Improvements
   1. [Cost optimizations]
   2. [Performance enhancements]

   ### Long-term Strategy
   1. [Architecture improvements]
   2. [Migration considerations]

   ## CLI Commands for Verification
   ```bash
   # Key commands to verify findings
   az resource list --resource-group [rg-name]
   az vm list --output table
   # ... other relevant commands
   ```

   ```

7. **Save and Present Findings:**
   - Check existing cloud research files for sequence number
   - Save to `docs/tickets/TICKET-NAME/cloud-platform-environment.md` if associated with a ticket, or `docs/cloud-platform-environment.md` for general research
   - Create cost analysis in `docs/tickets/TICKET-NAME/cloud-costs.md` if associated with a ticket, or `docs/cloud-costs.md` for general research
   - Generate security report if issues found
   - Present summary with actionable recommendations

## Important Notes

- **READ-ONLY OPERATIONS ONLY** - never create, modify, or delete
- **Always verify CLI authentication** before running commands
- **Use --output json** for structured data parsing
- **Handle API rate limits** by spacing requests
- **Respect security** - never expose sensitive data in reports
- **Be cost-conscious** - only run necessary read operations
- **Generate actionable insights**, not just resource lists

## Allowed Operations (READ-ONLY)

- List/show/describe/get operations
- View configurations and settings
- Read metrics and logs
- Query costs and billing (read-only)
- Inspect security settings (without modifying)

## Forbidden Operations (NEVER EXECUTE)

- Any command with: create, delete, update, set, put, post, patch, remove
- Starting/stopping services or resources
- Scaling operations
- Backup or restore operations
- IAM modifications
- Configuration changes

## Multi-Cloud Considerations

### Azure

- Use `az` CLI with appropriate subscription context
- Check for Azure Policy compliance
- Analyze Cost Management data
- Review Security Center recommendations

### AWS

- Use `aws` CLI with proper profile
- Check CloudTrail for audit
- Analyze Cost Explorer data
- Review Security Hub findings

### GCP

- Use `gcloud` CLI with project context
- Check Security Command Center
- Analyze billing exports
- Review IAM recommender

## Error Handling

- If CLI not authenticated: Guide user through login
- If insufficient permissions: List required permissions
- If rate limited: Implement exponential backoff
- If resources not accessible: Document and continue with available data
