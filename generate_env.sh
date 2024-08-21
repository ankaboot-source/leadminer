#!/bin/bash

# generate_env.sh
#
# This script generates service-specific .env files from a master environment file.
# It distributes variables to frontend and backend .env files based on variable name patterns.
#
# Usage: ./generate_env.sh <path_to_master_env_file>
#
# Example: ./generate_env.sh ./env_file
#
# The script will create or overwrite .env files in the ./frontend and ./backend directories.


if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path_to_master_env_file>"
    exit 1
fi

INPUT_FILE="$1"
FRONTEND_ENV="./frontend/.env"
BACKEND_ENV="./backend/.env"

# Function to write a section to a file
write_section() {
    local section=$1
    local output_file=$2
    sed -n "/$section/,/# ===/p" "$INPUT_FILE" | sed '/# ===/d' >> "$output_file"
}

# Clear existing .env files
> "$FRONTEND_ENV"
> "$BACKEND_ENV"

# Write common variables to both files
write_section "# ==============| Common |============= #" "$FRONTEND_ENV"
write_section "# ==============| Common |============= #" "$BACKEND_ENV"
# Write frontend variables
write_section "# ==============| Frontend |============= #" "$FRONTEND_ENV"
# Write backend variables
write_section "# ==============| Backend |============= #" "$BACKEND_ENV"