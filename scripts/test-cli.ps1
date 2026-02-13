param (
    [string]$BaseUrl,
    [string]$Token,
    [string]$BaseId
)

$ErrorActionPreference = "Stop"

function Run-Test {
    param (
        [string]$Description,
        [string]$CommandArgs,
        [bool]$CaptureOutput = $false
    )

    Write-Host "Running: $Description..." -NoNewline
    
    try {
        # Construct the command line for logging
        # Using --prefix packages/cli to run the dev script from the root
        $cmdLine = "npm run dev --prefix packages/cli --silent -- $CommandArgs"
        # Write-Host "Debug: cmd /c $cmdLine"

        # Execute directly using cmd /c
        $output = cmd /c $cmdLine 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " [PASS]" -ForegroundColor Green
            if ($CaptureOutput) { return $output }
        }
        else {
            Write-Host " [FAIL]" -ForegroundColor Red
            Write-Host "Exit Code: $LASTEXITCODE"
            Write-Host "Output:"
            $output | ForEach-Object { Write-Host $_ }
            return $null
        }
    }
    catch {
        Write-Host " [FAIL] (Exception)" -ForegroundColor Red
        Write-Host $_
        return $null
    }
}

function Get-JsonValue {
    param (
        [string[]]$Output,
        [string]$Key
    )
    # Simple regex extraction for now, considering output might be JSON
    # A robust solution would parse JSON but `cmd /c` output is an array of strings
    try {
        $jsonStr = $Output -join "`n"
        $json = $jsonStr | ConvertFrom-Json
        return $json.$Key
    }
    catch {
        return $null
    }
}

Write-Host "Starting CLI Tests..." -ForegroundColor Cyan

# 1. Smoke Tests
Run-Test "Version" "--version"
Run-Test "Help" "--help"
Run-Test "Config Help" "config --help"

# 2. Live Integration Tests (if credentials provided)
if ($BaseUrl -and $Token) {
    Write-Host "`nStarting Live Integration Tests..." -ForegroundColor Cyan
    $wsName = "cli-test-ws"

    # Setup Workspace
    Run-Test "Add Workspace" "workspace add $wsName $BaseUrl $Token"
    Run-Test "Use Workspace" "workspace use $wsName"

    try {
        # Base Creation (if BaseId not provided)
        $testBaseId = $BaseId
        if (-not $testBaseId) {
            $baseFile = New-TemporaryFile
            '{"title":"CLI_Test_Base"}' | Set-Content $baseFile
            $output = Run-Test "Create Base" "bases create --data-file ""$($baseFile.FullName)""" -CaptureOutput $true
            Remove-Item $baseFile
            if ($output) {
                $testBaseId = Get-JsonValue -Output $output -Key "id"
                Write-Host "Created Base ID: $testBaseId"
            }
        }

        if ($testBaseId) {
            # Table Creation
            $tableFile = New-TemporaryFile
            '{"title": "CLI_Test_Table", "table_name": "CLI_Test_Table", "columns": [{"title": "Title", "uidt": "SingleLineText"}]}' | Set-Content $tableFile -Encoding utf8
            $output = Run-Test "Create Table" "tables create $testBaseId --data-file ""$($tableFile.FullName)""" -CaptureOutput $true
            Remove-Item $tableFile
            $tableId = Get-JsonValue -Output $output -Key "id"
            
            if ($tableId) {
                Write-Host "Created Table ID: $tableId"

                # Set Base Context (test saved baseId)
                Run-Test "Set Base Context" "config set baseId $testBaseId"

                # View Creation
                $viewFile = New-TemporaryFile
                '{"title":"CLI_Test_View"}' | Set-Content $viewFile
                Run-Test "Create View" "views create $tableId --data-file ""$($viewFile.FullName)"""
                Remove-Item $viewFile

                # Column Creation
                $colFile = New-TemporaryFile
                '{"title":"CLI_Test_Col","uidt":"SingleLineText"}' | Set-Content $colFile
                Run-Test "Create Column" "columns create $tableId --data-file ""$($colFile.FullName)"""
                Remove-Item $colFile

                # Row Creation
                $rowFile = New-TemporaryFile
                '{"Title":"Test Row"}' | Set-Content $rowFile
                # Removed --base flag; relies on config set baseId above
                Run-Test "Create Row" "rows create $tableId --data-file ""$($rowFile.FullName)"""
                Remove-Item $rowFile

                # Export Data
                $exportFile = Join-Path $PWD.Path "test-export.json"
                if (Test-Path $exportFile) { Remove-Item $exportFile }
                
                # Use quotes for path with spaces just in case
                Run-Test "Export Data" "data export $tableId --out ""$exportFile"""
                
                if (Test-Path $exportFile) {
                    Write-Host "Export File Created [PASS]" -ForegroundColor Green
                    Remove-Item $exportFile
                }
                else {
                    Write-Host "Export File Missing [FAIL]" -ForegroundColor Red
                    Write-Host "Expected at: $exportFile"
                }

                # Start Teardown
                Run-Test "Delete Table" "tables delete $tableId"

            }
            else {
                Write-Host "Skipping dependent tests (Table check failed)" -ForegroundColor Yellow
            }

            # Delete Base only if we created it
            if (-not $BaseId) {
                Run-Test "Delete Base" "bases delete $testBaseId"
            }
        }
        else {
            Write-Host "Skipping dependent tests (Base check failed)" -ForegroundColor Yellow
        }

    }
    finally {
        # Cleanup Workspace
        Run-Test "Delete Workspace" "workspace delete $wsName"
    }
}
else {
    Write-Host "`nSkipping Live Tests (BaseUrl/Token not provided)" -ForegroundColor Yellow
    Write-Host "Usage: .\test-cli.ps1 -BaseUrl <url> -Token <token> [-BaseId <id>]"
}

Write-Host "`nTests Completed." -ForegroundColor Cyan
