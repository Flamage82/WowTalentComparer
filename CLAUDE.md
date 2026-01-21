# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WowTalentComparer - A static web app for visualizing and comparing World of Warcraft talent builds. Runs entirely client-side, deployed to GitHub Pages.

## Development Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm test         # Run tests (Vitest)
```

## Architecture

- **Framework**: React 18 + TypeScript + Vite
- **Deployment**: GitHub Pages via GitHub Actions (auto-deploys on push to main)
- **Data Source**: Talent tree data from wago.tools DB2 exports

### Key Files

- `src/lib/talentParser.ts` - Decodes WoW talent export strings
- `src/components/TalentTree.tsx` - Renders the talent tree visualization
- `src/components/TalentInput.tsx` - Input form for talent strings

### Talent String Format

WoW talent strings are base64-encoded binary containing:
- Version byte
- Spec ID (16-bit)
- Tree hash (128-bit)
- Talent node selections (bit-packed)
