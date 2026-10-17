#Requires -Version 5.1
<#
    Installs official GitHub CLI portable for the current Windows user only.
    No administrator privileges and no machine-wide PATH modifications.
    Sources: https://github.com/cli/cli/releases/latest
#>
$ErrorActionPreference = 'Stop'

$destination = Join-Path $env:LOCALAPPDATA 'LMN24\GitHubCLI'
$target = Join-Path $destination 'gh.exe'
$temporary = Join-Path $env:TEMP ("lmn24-gh-cli-" + [guid]::NewGuid().ToString('N'))

try {
    if (-not [Environment]::Is64BitOperatingSystem) {
        throw 'Une version 64 bits de Windows est necessaire pour ce script.'
    }
    $platform = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'windows_arm64.zip' } else { 'windows_amd64.zip' }

    Write-Host ''
    Write-Host 'LMN24 - Installation portable de GitHub CLI' -ForegroundColor Cyan
    Write-Host "Destination : $target"
    Write-Host 'Aucun privilege administrateur requis.'
    Write-Host ''

    $headers = @{ 'User-Agent' = 'LMN24-portable-GitHub-CLI-installer' }
    Write-Host 'Recherche de la derniere version stable officielle GitHub CLI...'
    $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/cli/cli/releases/latest' -Headers $headers -UseBasicParsing
    $version = ([string]$release.tag_name) -replace '^v', ''
    if ($version -notmatch '^\d+\.\d+\.\d+$') {
        throw "Version de release inattendue : $version"
    }

    $archiveName = "gh_${version}_$platform"
    $asset = @($release.assets | Where-Object { $_.name -eq $archiveName } | Select-Object -First 1)
    $checksumName = "gh_${version}_checksums.txt"
    $checksumAsset = @($release.assets | Where-Object { $_.name -eq $checksumName } | Select-Object -First 1)
    if ($asset.Count -ne 1 -or $checksumAsset.Count -ne 1) {
        throw "Archive Windows ou fichier de sommes SHA256 introuvable dans la release GitHub $version."
    }

    New-Item -ItemType Directory -Path $temporary -Force | Out-Null
    $archiveFile = Join-Path $temporary $archiveName
    $checksumFile = Join-Path $temporary $checksumName

    Write-Host "Telechargement de GitHub CLI $version depuis GitHub..."
    Invoke-WebRequest -Uri $asset[0].browser_download_url -OutFile $archiveFile -UseBasicParsing
    Invoke-WebRequest -Uri $checksumAsset[0].browser_download_url -OutFile $checksumFile -UseBasicParsing

    $lines = @(Get-Content -LiteralPath $checksumFile)
    $archiveSuffix = [regex]::Escape($archiveName)
    $matchingLines = @($lines | Where-Object { $_ -match ('^([a-fA-F0-9]{64})\s+\*?' + $archiveSuffix + '$') })
    if ($matchingLines.Count -ne 1) {
        throw 'Impossible de verifier la somme SHA256 officielle de l archive.'
    }
    $expectedSha = ($matchingLines[0] -split '\s+')[0]
    $actualSha = (Get-FileHash -LiteralPath $archiveFile -Algorithm SHA256).Hash
    if ($expectedSha -ine $actualSha) {
        throw 'SHA256 INCORRECT : le telechargement est refuse.'
    }
    Write-Host 'Verification SHA256 : OK' -ForegroundColor Green

    $extraction = Join-Path $temporary 'extracted'
    Expand-Archive -LiteralPath $archiveFile -DestinationPath $extraction -Force
    $executables = @(Get-ChildItem -LiteralPath $extraction -Filter gh.exe -Recurse -File)
    if ($executables.Count -ne 1) {
        throw 'Impossible de localiser gh.exe dans l archive officielle.'
    }

    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Copy-Item -LiteralPath $executables[0].FullName -Destination $target -Force
    Write-Host ''
    & $target --version
    if ($LASTEXITCODE -ne 0) {
        throw 'GitHub CLI portable ne demarre pas.'
    }

    Write-Host ''
    Write-Host 'GitHub CLI portable est pret !' -ForegroundColor Green
    Write-Host "Installe dans : $target"
    Write-Host "Les raccourcis Windows de LMN24 trouveront cette version automatiquement."
    Write-Host ''
    Write-Host 'Etape suivante : ouvre PowerShell et execute :'
    Write-Host ('& "' + $target + '" auth login')
    Write-Host 'Selectionne GitHub.com et la connexion via ton navigateur.'
    Write-Host 'Puis double-clique sur Verifier-Deploiement-LMN24.cmd.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host ("ERREUR : " + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Si les telechargements sont bloques par ta politique entreprise, telecharge' -ForegroundColor Yellow
    Write-Host 'manuellement le fichier windows_amd64.zip sur https://github.com/cli/cli/releases/latest' -ForegroundColor Yellow
    Write-Host "et place le gh.exe extrait a l emplacement : $target" -ForegroundColor Yellow
    exit 1
}
finally {
    if (Test-Path -LiteralPath $temporary) {
        Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
    }
}
