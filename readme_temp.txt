Skip to content
Navigation Menu
Platform
Solutions
Resources
Open Source
Enterprise
Pricing
Sign in
Sign up
Gentleman-Programming
/
gentle-ai
Public
Notifications
Fork 125
 Star 1.1k
Code
Issues
27
Pull requests
7
Actions
Projects
Security
Insights
Gentleman-Programming/gentle-ai
 main
9 Branches
104 Tags
Code
Folders and files
Name	Last commit message	Last commit date

Latest commit
Alan-TheGentleman
feat(tui): scrollable backup list with rename and delete support
20975d5
 · 
History
204 Commits


.engram
	
feat(tui): scrollable backup list with rename and delete support
	


.github
	
ci: run workflows with Go 1.24 (#65)
	


.windsurf/workflows
	
feat(windsurf): rebuild SDD orchestrator with full standard sections …
	


cmd/gentle-ai
	
feat(update): self-update on startup with BuildInfo version fallback
	


docs
	
feat(persona): neutral persona is now the same teacher without region…
	


e2e
	
fix(e2e): accept absolute engram path in Codex config.toml assertion
	


internal
	
feat(tui): scrollable backup list with rename and delete support
	


scripts
	
fix: prefer binary download over go install to avoid stale Go proxy c…
	


skills
	
docs: add branch naming and commit message regex patterns to skill an…
	


testdata/golden
	
fix(engram): OpenCode mcp.engram command array format + atomic replac…
	


.dockerignore
	
feat: initial implementation of AI Gentle Stack
	


.gitignore
	
fix(sync,gga,tui): persist agent selection, idempotent GGA reinstall,…
	


.goreleaser.yaml
	
feat: add Windows platform support
	


AGENTS.md
	
feat(github): enforce issue-first PR workflow with templates, CI chec…
	


CONTRIBUTING.md
	
fix(engram): preserve absolute MCP command paths
	


PRD.md
	
docs(sdd): reframe SDD and engram as agent-managed, clarify multi-mod…
	


README.md
	
Update image in README.md
	


go.mod
	
ci: run workflows with Go 1.24 (#65)
	


go.sum
	
feat: initial implementation of AI Gentle Stack
	


informe-neural-labs.html
	
fix(e2e): update skill count assertions for branch-pr and issue-creation
	


informe-neural-labs.pdf
	
fix(e2e): update skill count assertions for branch-pr and issue-creation
	
Repository files navigation
README
Contributing
AI Gentle Stack

One command. Any agent. Any OS. The Gentleman AI ecosystem -- configured and ready.

   

What It Does

This is NOT an AI agent installer. Most agents are easy to install. This is an ecosystem configurator -- it takes whatever AI coding agent(s) you use and supercharges them with the Gentleman stack: persistent memory, Spec-Driven Development workflow, curated coding skills, MCP servers, an AI provider switcher, a teaching-oriented persona with security-first permissions, and per-phase model assignment so each SDD step can run on a different model.

Before: "I installed Claude Code / OpenCode / Cursor, but it's just a chatbot that writes code."

After: Your agent now has memory, skills, workflow, MCP tools, and a persona that actually teaches you.

8 Supported Agents
Agent	Delegation Model	Key Feature
Claude Code	Full (Task tool)	Sub-agents, output styles
OpenCode	Full (multi-mode overlay)	Per-phase model routing
Gemini CLI	Full (experimental)	Custom agents in ~/.gemini/agents/
Cursor	Full (native subagents)	9 SDD agents in ~/.cursor/agents/
VS Code Copilot	Full (runSubagent)	Parallel execution
Codex	Solo-agent	CLI-native, TOML config
Windsurf	Solo-agent	Plan Mode, Code Mode, native workflows
Antigravity	Solo-agent + Mission Control	Built-in Browser/Terminal sub-agents

Note: This project supersedes Agent Teams Lite (now archived). Everything ATL provided is included here with better installation, automatic updates, and persistent memory.

Quick Start
macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash
Windows (PowerShell)
irm https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.ps1 | iex

This downloads the latest release for your platform and launches the interactive TUI. No Go toolchain required.

Install
Homebrew (macOS / Linux)
brew tap Gentleman-Programming/homebrew-tap
brew install gentle-ai
Go install (any platform with Go 1.24+)
go install github.com/gentleman-programming/gentle-ai/cmd/gentle-ai@latest
Windows (PowerShell)
# Option 1: PowerShell installer (downloads binary from GitHub Releases)
irm https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.ps1 | iex

# Option 2: Go install (requires Go 1.24+)
go install github.com/gentleman-programming/gentle-ai/cmd/gentle-ai@latest
From releases

Download the binary for your platform from GitHub Releases.

Documentation
Topic	Description
Intended Usage	How gentle-ai is meant to be used — the mental model
Agents	Supported agents, feature matrix, config paths, and per-agent notes
Components, Skills & Presets	All components, GGA behavior, skill catalog, and preset definitions
Usage	Persona modes, interactive TUI, CLI flags, and dependency management
Platforms	Supported platforms, Windows notes, security verification, config paths
Architecture & Development	Codebase layout, testing, and relationship to Gentleman.Dots
About
No description, website, or topics provided.
Resources
 Readme
Contributing
 Contributing
 Activity
 Custom properties
Stars
 1.1k stars
Watchers
 17 watching
Forks
 125 forks
Report repository


Releases 103
v1.12.1
Latest
+ 102 releases


Packages
No packages published



Contributors
11


Languages
Go
84.8%
 
Shell
8.9%
 
TypeScript
3.2%
 
HTML
2.3%
 
PowerShell
0.8%
Footer
© 2026 GitHub, Inc.
Footer navigation
Terms
Privacy
Security
Status
Community
Docs
Contact
Manage cookies
Do not share my personal information
