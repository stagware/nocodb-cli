$BaseUrl = $env:NOCO_BASE_URL
$BaseId = $env:NOCO_BASE_ID
$Token = $env:NOCO_TOKEN

if (-not $BaseUrl -or -not $BaseId -or -not $Token) {
  Write-Error "Set NOCO_BASE_URL, NOCO_BASE_ID, NOCO_TOKEN"
  exit 1
}

$headers = @{ "xc-token" = $Token; "Content-Type" = "application/json" }

function Get-Tables {
  Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/v2/meta/bases/$BaseId/tables" -Headers $headers
}

function Delete-Table($tableId) {
  Invoke-RestMethod -Method Delete -Uri "$BaseUrl/api/v2/meta/tables/$tableId" -Headers $headers
}

function Create-Table($name) {
  $payload = @{ table_name = $name; title = $name; columns = @(@{ column_name = "Title"; title = "Title"; uidt = "SingleLineText" }) } | ConvertTo-Json -Depth 6
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v2/meta/bases/$BaseId/tables" -Headers $headers -Body $payload
}

function Add-LinkColumn($parentTableId, $childTableId) {
  $payload = @{
    title = "LinkToSecondary"
    column_name = "LinkToSecondary"
    uidt = "Links"
    parentId = $parentTableId
    childId = $childTableId
    type = "mm"
  } | ConvertTo-Json -Depth 6
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v2/meta/tables/$parentTableId/columns" -Headers $headers -Body $payload
}

$AName = "CurlLinkA"
$BName = "CurlLinkB"

# Clean up existing tables with the same names
Write-Host "Checking for existing tables..."
$existingTables = Get-Tables
foreach ($t in $existingTables.list) {
  if ($t.title -eq $AName -or $t.title -eq $BName) {
    Write-Host "  Deleting existing table: $($t.title) ($($t.id))"
    Delete-Table $t.id | Out-Null
  }
}

Write-Host "Creating two tables..."
$A = Create-Table $AName
$B = Create-Table $BName
$AId = $A.id
$BId = $B.id

if (-not $AId -or -not $BId) {
  Write-Error "Failed to create tables. A=$AId B=$BId"
  exit 1
}

Write-Host "Table A: $AId"
Write-Host "Table B: $BId"

Write-Host "Attempting to add link column..."
try {
  Add-LinkColumn $AId $BId | Out-Null
  Write-Host "Link column created."
} catch {
  Write-Warning "Link column creation failed: $($_.Exception.Message)"
}

Write-Host "Done. Inspect tables in UI: $AName, $BName"
