#!/bin/bash
#
# generate_env.sh
#
# This script initializes environment files for all services by
# copying each `.env.dev` to `.env` in the specified directories.
#
# Usage: ./generate_env.sh
#
# Example:
#   ./generate_env.sh
#
# It will automatically navigate through all defined service folders
# (e.g., frontend, backend, micro-services/email-fetching) and
# replicate their .env.dev into .env.
#

# Exit immediately if a command exits with a non-zero status
set -e

# Define the list of service directories
SERVICES=(
  "./frontend"
  "./backend"
  "./micro-services/emails-fetcher"
  "./supabase/functions"
)

echo "Generating .env files for all services..."

MISSING_ENV_DEV=()

# Loop through each service directory
for SERVICE_PATH in "${SERVICES[@]}"; do
  ENV_DEV_PATH="$SERVICE_PATH/.env.dev"
  ENV_EXAMPLE_PATH="$SERVICE_PATH/.env.example"
  ENV_PATH="$SERVICE_PATH/.env"
  ENV_TEMPLATE_PATH="$ENV_DEV_PATH"

  echo "- Processing: $SERVICE_PATH"

  if [ ! -f "$ENV_TEMPLATE_PATH" ] && [ -f "$ENV_EXAMPLE_PATH" ]; then
    ENV_TEMPLATE_PATH="$ENV_EXAMPLE_PATH"
  fi

  if [ -f "$ENV_TEMPLATE_PATH" ]; then
    cp "$ENV_TEMPLATE_PATH" "$ENV_PATH"
    echo "- Copied $ENV_TEMPLATE_PATH → $ENV_PATH"
  else
    echo "- Skipped: $ENV_DEV_PATH or $ENV_EXAMPLE_PATH not found."
    MISSING_ENV_DEV+=("$ENV_DEV_PATH")
  fi
done

echo ""
if [ ${#MISSING_ENV_DEV[@]} -gt 0 ]; then
  echo "❌ Environment setup incomplete. Missing templates:"
  for MISSING_PATH in "${MISSING_ENV_DEV[@]}"; do
    echo "- $MISSING_PATH"
  done
  exit 1
fi

echo "🎉 Environment setup complete! All .env files are now ready."
