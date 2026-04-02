#!/bin/bash
# Usage: ./sanitize-name.sh "qwen3.5-9B:Q4"
# Output: qwen3-5-9b-q4
echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[.:]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-63
