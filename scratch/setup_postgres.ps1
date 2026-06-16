$baseDir = "C:\Users\gojen\.gemini\antigravity\postgres"
$zipsDir = "$baseDir\zips"
$pgsqlDir = "$baseDir\pgsql"
$postgisDir = "$baseDir\postgis"

# Create directories if they don't exist
New-Item -ItemType Directory -Force -Path $baseDir
New-Item -ItemType Directory -Force -Path $zipsDir

$pgZipPath = "$zipsDir\postgresql.zip"
$postgisZipPath = "$zipsDir\postgis.zip"

# 1. Download PostgreSQL (only if not already complete)
$expectedPgSize = 325741585
$pgComplete = $false
if (Test-Path $pgZipPath) {
    $pgSize = (Get-Item $pgZipPath).Length
    if ($pgSize -eq $expectedPgSize) {
        $pgComplete = $true
        Write-Host "PostgreSQL zip is already downloaded and complete ($pgSize bytes)."
    }
}

if (-not $pgComplete) {
    if (Test-Path $pgZipPath) { Remove-Item $pgZipPath -Force }
    Write-Host "Downloading PostgreSQL 16 using curl..."
    curl.exe -L -o $pgZipPath "https://get.enterprisedb.com/postgresql/postgresql-16.14-2-windows-x64-binaries.zip"
}

# 2. Download PostGIS with resume loop (up to 20 attempts)
$expectedPostgisSize = 123957610
$postgisComplete = $false

for ($attempt = 1; $attempt -le 20; $attempt++) {
    if (Test-Path $postgisZipPath) {
        $size = (Get-Item $postgisZipPath).Length
        if ($size -eq $expectedPostgisSize) {
            $postgisComplete = $true
            Write-Host "PostGIS zip is complete ($size bytes)."
            break
        }
        Write-Host "PostGIS zip is partial ($size bytes). Resuming download (attempt $attempt)..."
    } else {
        Write-Host "Starting PostGIS download (attempt $attempt)..."
    }

    # Use -C - to resume download
    curl.exe -C - -L -o $postgisZipPath "https://winnie.postgis.net/download/windows/pg16/buildbot/postgis-bundle-pg16-3.6.2x64.zip"

    # Wait a bit before retrying
    Start-Sleep -Seconds 3
}

if (-not $postgisComplete) {
    # Check one last time
    if (Test-Path $postgisZipPath) {
        $size = (Get-Item $postgisZipPath).Length
        if ($size -eq $expectedPostgisSize) {
            $postgisComplete = $true
        }
    }
}

if (-not $postgisComplete) {
    Write-Error "Failed to download complete PostGIS zip after multiple attempts."
    exit 1
}

# 3. Clean up extraction directories to ensure fresh extract
Write-Host "Cleaning up extraction directories..."
if (Test-Path $pgsqlDir) { Remove-Item $pgsqlDir -Recurse -Force }
if (Test-Path $postgisDir) { Remove-Item $postgisDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $pgsqlDir

# 4. Extract PostgreSQL
Write-Host "Extracting PostgreSQL..."
Expand-Archive -Path $pgZipPath -DestinationPath $baseDir -Force

# 5. Extract PostGIS
Write-Host "Extracting PostGIS..."
Expand-Archive -Path $postgisZipPath -DestinationPath $postgisDir -Force

# 6. Merge PostGIS files into pgsql
Write-Host "Merging PostGIS into PostgreSQL installation..."
Copy-Item -Path "$postgisDir\*" -Destination $pgsqlDir -Recurse -Force

# 7. Initialize database
$dataDir = "$pgsqlDir\data"
if (-not (Test-Path $dataDir)) {
    Write-Host "Initializing database..."
    & "$pgsqlDir\bin\initdb.exe" -D $dataDir -U postgres --auth-host=trust --auth-local=trust
}

# 8. Start database
Write-Host "Starting PostgreSQL..."
& "$pgsqlDir\bin\pg_ctl.exe" -D $dataDir -l "$dataDir\pg.log" start

# Wait for database to initialize and start
Start-Sleep -Seconds 5

# 9. Create database and extension
Write-Host "Creating 'realestate' database..."
& "$pgsqlDir\bin\createdb.exe" -U postgres -p 5432 realestate 2>$null

Write-Host "Enabling PostGIS extension..."
& "$pgsqlDir\bin\psql.exe" -U postgres -p 5432 -d realestate -c "CREATE EXTENSION IF NOT EXISTS postgis;"

Write-Host "PostgreSQL with PostGIS is setup and running successfully!"
