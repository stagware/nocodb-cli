#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${NOCO_BASE_URL:-}"
BASE_ID="${NOCO_BASE_ID:-}"
TOKEN="${NOCO_TOKEN:-}"

if [[ -z "$BASE_URL" || -z "$BASE_ID" || -z "$TOKEN" ]]; then
  echo "Set NOCO_BASE_URL, NOCO_BASE_ID, NOCO_TOKEN" >&2
  exit 1
fi

headers=(
  -H "xc-token: ${TOKEN}"
  -H "Content-Type: application/json"
)

create_table() {
  local name="$1"
  local payload
  payload=$(cat <<JSON
{
  "table_name": "${name}",
  "title": "${name}",
  "columns": [
    {"column_name":"Title","title":"Title","uidt":"SingleLineText"}
  ]
}
JSON
)
  curl -sS "${headers[@]}" \
    -X POST "${BASE_URL}/api/v2/meta/bases/${BASE_ID}/tables" \
    -d "$payload"
}

add_link_column() {
  local parent_table_id="$1"
  local child_table_id="$2"
  local payload
  payload=$(cat <<JSON
{
  "title": "LinkToSecondary",
  "column_name": "LinkToSecondary",
  "uidt": "Links",
  "parentId": "${parent_table_id}",
  "childId": "${child_table_id}",
  "type": "mm"
}
JSON
)
  curl -sS "${headers[@]}" \
    -X POST "${BASE_URL}/api/v2/meta/tables/${parent_table_id}/columns" \
    -d "$payload"
}

echo "Creating two tables..."
A_NAME="CurlLinkA"
B_NAME="CurlLinkB"
A_JSON=$(create_table "$A_NAME")
B_JSON=$(create_table "$B_NAME")
A_ID=$(echo "$A_JSON" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));console.log(d.id)")
B_ID=$(echo "$B_JSON" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));console.log(d.id)")

echo "Table A: $A_ID"
echo "Table B: $B_ID"

echo "Attempting to add link column..."
add_link_column "$A_ID" "$B_ID" || true

echo "Done. Inspect tables in UI: $A_NAME, $B_NAME"
