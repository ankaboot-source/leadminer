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

# Loop through each service directory
for SERVICE_PATH in "${SERVICES[@]}"; do
  ENV_DEV_PATH="$SERVICE_PATH/.env.dev"
  ENV_PATH="$SERVICE_PATH/.env"

  echo "- Processing: $SERVICE_PATH"

  # Check if .env.dev exists
  if [ -f "$ENV_DEV_PATH" ]; then
    cp "$ENV_DEV_PATH" "$ENV_PATH"
    echo "- Copied $ENV_DEV_PATH → $ENV_PATH"
  else
    echo "- Skipped: $ENV_DEV_PATH not found."
  fi
done

echo ""
echo "🎉 Environment setup complete! All .env files are now ready."
