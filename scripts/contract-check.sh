#!/usr/bin/env bash
set -euo pipefail

echo "Regenerating types from live API schema..."
npm run generate-types

echo "Running typecheck..."
npm run typecheck

echo "Contract check passed."
