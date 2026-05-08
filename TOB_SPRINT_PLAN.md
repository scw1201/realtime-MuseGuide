# MuseGuide 4-Day ToB Sprint Plan

## Goal

Build a minimal MuseGuide toB version in 4 days that is:

- demo-ready
- value-oriented
- deployable in a standardized way

The focus is not on adding the most features, but on making the product feel sellable, configurable, and operational for museum partners.

## Core Priorities

1. Minimal content management backend
2. Minimal analytics dashboard
3. Standardized deployment plan and pricing structure
4. Lightweight server demo only if time remains

## Day 1: Minimal Content Backend

Deliver a simple backend or admin surface that allows non-technical users to update guide content without modifying code.

Scope:

- Manage exhibition zones
- Manage exhibits
- Edit exhibit narration content
- Configure persona binding or switching
- Configure basic chips or recommendation copy

Target outcome:

- Museum staff can update core content without developer intervention

## Day 2: Connect Backend to the Guide Flow

Ensure backend changes actually drive the live guide experience.

Scope:

- Verify edited exhibit content appears in guide responses
- Verify stage transitions after zone switching
- Verify exhibit introduction triggers correctly
- Verify chips change with state and configured content
- Verify persona-specific speaking style still works

Target outcome:

- Backend configuration is not decorative; it actively controls the system

## Day 3: Minimal Analytics Dashboard

Build a lightweight dashboard that helps demonstrate product value to museum stakeholders.

Recommended metrics:

- Total session count
- Average guide turns or session duration
- Most visited zones
- Most visited exhibits
- Chips click distribution
- Auto-advance trigger count
- Auto-advance success rate
- Guide stage where users most often disengage

Recommended presentation:

- 4 to 6 summary cards
- 1 zone/exhibit popularity chart
- 1 guide-stage progression view

Target outcome:

- The system can show measurable value, not just conversational quality

## Day 4: Delivery Plan and Commercial Packaging

Turn the project from a demo into a clear product proposal.

Scope:

- Write deployment instructions
- List required APIs and environment dependencies
- Define a standard delivery flow
- Draft package tiers and pricing logic
- Prepare demo-facing product materials
- If time remains, deploy a lightweight demo server

Target outcome:

- MuseGuide is presented as a deliverable product, not only a prototype

## Delivery Framing

Suggested package structure:

- Basic: single persona, single exhibition, basic guide flow
- Professional: multiple personas, multi-stage guide logic, analytics dashboard
- Custom: private deployment, branded experience, configurable backend, multilingual support

## Current Decision

- Do not prioritize renting a server first
- Prioritize productization before infrastructure
- Revisit server deployment on Day 4 or after the backend and dashboard are in place

## Execution Principle

Day 1 builds editability.
Day 2 makes the configuration truly effective.
Day 3 proves measurable value.
Day 4 makes the system presentable and sellable.
