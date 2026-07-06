<div align="center">

<img src="https://raw.githubusercontent.com/cmdOS-App/cmdOS/main/src/shared-components/assets/tasklabs_logo.png" alt="cmdOS" width="80" height="80" />

# cmdOS


**A keyboard-first command terminal for the browser.**

Access search, browser commands, and web shortcuts — all from one command bar.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-9.15.1-orange)](https://pnpm.io)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[**Getting Started**](#getting-started) · [**Features**](#features) · [**Contributing**](#contributing) · [**License**](#license)

</div>


---

## What is cmdOS?

cmdOS is a Chrome extension that replaces repetitive browser actions with keyboard commands. Instead of navigating menus, bookmarks, and tabs manually, you open cmdOS with `Alt + S` and run commands from one place.

It is entirely **local-first** — your data stays on your machine. No account required to use the core features.

---

## Features

### ⌨️ Command Palette

Open cmdOS with `Alt + S` from any page and run commands instantly.

```
/notes           → Open your notes
/link            → Create or open a saved link
/screenshot      → Capture the current page
/shortcuts       → Manage keyboard shortcuts
```


```

### 🛠️ Browser Commands

Built-in commands available from the command bar:

- Visible-page and full-page screenshots
- Image download from current page
- Table extraction and CSV export
- Print-friendly PDF generation

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19, TypeScript |
| Build | Vite 6, Turborepo |
| Styling | Tailwind CSS |
| Package manager | pnpm workspaces |
| Storage | Chrome Extension APIs (local-first) |
| Extension | Manifest V3 |

---

## Repository Structure

<pre>
cmdOS/
├── background/                  # Service worker, manifest, extension bootstrap
├── packages/                    # Shared internal packages (monorepo)
│   ├── ui/                      # Design system components
│   ├── shared/                  # Utility helpers and schemas
│   ├── storage/                 # Chrome storage helpers
│   ├── env/                     # Environment variable schemas
│   └── module-manager/          # Core module configuration
├── src/
│   ├── allObjectFolder/         # Core object types — the heart of the extension
│   │   └── src/createObject/
│   │       ├── links/           # Link and tab group objects
│   │       ├── notes/           # Rich note objects
│   │       ├── snippets/        # Reusable text snippets
│   │       ├── commands/        # Command definitions and handlers
│   │       ├── session/         # Session tracking objects
│   │       ├── automationBeta/  # Automation workflow objects
│   │       ├── ChatAgent/       # AI agent integration
│   │       ├── aiPrompt/        # AI prompt objects
│   │       ├── todos/           # Task and to-do objects
│   │       └── tags/            # Tag management
│   ├── settings/                # Extension settings UI and logic
│   │   ├── authentication/      # Login and auth UI
│   │   ├── backup/              # Data backup and restore
│   │   ├── generalSettingsPageUi/  # General settings panel
│   │   ├── uiPersonalization/   # Theme and appearance settings
│   │   ├── uxLayoutCustomization/  # Layout customization options
│   │   └── allWorkspaceManager/ # Workspace and folder management
│   ├── storage/                 # Storage abstraction layer
│   ├── shared-components/       # Reusable UI components and utilities
│   ├── welcomeGuide/            # Onboarding and tutorial flows
│   └── pages/                   # Extension entry points
│       ├── AltS_search_newtab/  # Primary new tab workspace dashboard
│       ├── popup/               # Browser toolbar popup
│       ├── contentScript/       # Injected content scripts
│       └── content-ui/          # Injected UI overlays
├── docs/                        # Documentation and guides
└── .env                         # Environment config (pre-configured for local dev)
</pre>


---

## Getting Started

### Prerequisites

- **Node.js** `>= 22.12.0` — [Download](https://nodejs.org)
- **pnpm** `>= 9.15.1` — `npm install -g pnpm`
- Google Chrome or any Chromium-based browser

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/cmdOS-App/cmdOS.git
cd cmdOS
```

**2. Set up environment**

```bash
cp .env .env.local
# The default .env is pre-configured for local development.
# No changes needed to run the extension locally.
```

**3. Install dependencies**

```bash
pnpm install
```

### Development

Start the development server with hot reload:

```bash
pnpm dev
```

Then load the extension in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `dist/` directory

The extension rebuilds automatically when you save changes.

### Building

Build the production extension:

```bash
pnpm build
```

The built extension will be in `dist/`. Load it in Chrome using the same steps as development.

### Type Checking

```bash
pnpm type-check
```

### Linting

```bash
pnpm lint
pnpm prettier
```

---



## License

Copyright © 2024–2026 RPA TASKLABS AUTOMATION SOFTWARE PRIVATE LIMITED · [Apache License 2.0](LICENSE)

