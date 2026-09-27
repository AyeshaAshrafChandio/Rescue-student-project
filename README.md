# 🚨 Student Project Rescue

### Rescue your project before the deadline.

Student Project Rescue is an AI-powered developer workflow platform that helps students understand, debug, complete, and verify unfinished software projects before submission deadlines.

Instead of overwhelming students with a long list of issues, it creates a prioritized rescue workflow:

**What's Done → What's Broken → What's Missing → Priority → Fix → Verify**

## 🎯 Problem

Students often reach deadlines with:

- Incomplete features
- Unknown bugs
- Broken APIs
- Missing requirements
- Failed builds
- Missing tests
- Unclear priorities

The main challenge is understanding what needs to be fixed first.

## 💡 Solution

Student Project Rescue analyzes a real project/codebase and creates an actionable rescue plan.

```text
Project
   ↓
Analyze
   ↓
What's Done
   ↓
What's Broken
   ↓
What's Missing
   ↓
Prioritize
   ↓
Rescue Plan
   ↓
Fix
   ↓
Verify
   ↓
Final Report

✨ Core Features
 
- 📦 ZIP / GitHub project input
- 🔍 Real codebase analysis
- ✅ What's Done detection
- 🔴 What's Broken detection
- 🟡 What's Missing detection
- 🎯 Priority-based task planning
- 🛟 AI Rescue Workspace
- 🧪 Fix verification
- 📈 Rescue progress tracking
- 📄 Final project report

 
## 🤖 AI Rescue Workflow
 
For each priority task, the system can:
 
1. Understand the problem
2. Inspect relevant files
3. Identify the likely root cause
4. Create a fix plan
5. Implement the required changes
6. Verify the result

 
## 🤝 IBM Bob 2.0
 
IBM Bob 2.0 is used as an active development partner during the project development workflow.
 
The project demonstrates AI-assisted development with real repository context, codebase understanding, implementation, testing, and review.
 
## 🛠️ Technology
 
- Google Stitch AI
- Google AI Studio
- Gemini AI
- React
- GitHub
- IBM Bob 2.0

 
## 🎬 Demo Scenario
 
A student uploads an unfinished project.
 
```text
Initial Project Health: 61%

3 Critical Issues
5 Broken Features
4 Missing Features
7 Missing Tests

Student Project Rescue creates a prioritized rescue plan.

After completing and verifying the highest-priority tasks:

**Final Project Health: 91%**

- **Critical Issues:** 3 → 0
- **Verified Tasks:** 0 → 8

## 🎯 Core Philosophy

**Understand the project. Identify what matters. Fix it. Verify it. Rescue the project.**

## 👩‍💻 Project

### Student Project Rescue

> “Rescue your project before the deadline.”

**Built for the IBM Bob 2.0 Hackathon.**

Available next action: [Create a downloadable DOCX file here in this chat containing the editable prose above](reference-followup:2510)
## IBM Bob 2.0 Usage

IBM Bob 2.0 was used as an active development, QA, debugging, and code-review partner for **Student Project Rescue**.

### How IBM Bob Was Used

- Inspected and understood the actual project repository and its existing architecture.
- Reviewed frontend, backend, API routes, dependencies, configuration, AI integration, and verification logic.
- Audited the implementation against the project's actual requirements.
- Investigated real security issues and potential runtime problems.
- Verified previously reported issues against the actual source code instead of relying on assumptions.
- Reviewed Gemini model configuration and SDK compatibility.
- Assisted with debugging and fixing confirmed implementation issues.
- Reviewed the verification system to ensure dangerous commands could not be executed through the test-command workflow.
- Performed a final security and code-quality audit.
- Reviewed the final state of the project and separated verified results from items that could not be tested.

### Bugs and Issues Fixed With IBM Bob

- Fixed invalid Gemini model identifiers and corrected the Gemini fallback configuration.
- Fixed the invalid `ThinkingLevel.MINIMAL` configuration.
- Removed a duplicate Gemini fallback model.
- Fixed the `esbuild` dependency version conflict in `package.json`.
- Improved the verifier's detection of invalid Gemini model patterns.
- Strengthened the `testCommand` security blocklist to prevent dangerous command execution patterns.

### IBM Bob Contribution

IBM Bob was used directly on the real project repository to **inspect → analyze → debug → fix → review → verify** the existing implementation. No fake, mock, or demo repository was used for the Bob audit, and the existing application architecture and UI were preserved.
