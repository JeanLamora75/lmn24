#Requires -Version 5.1
<#
  LMN24 - Manual OVHcloud deployment from Windows (GitHub CLI).
  No deployment occurs until the user explicitly types DEPLOYER.
  -CheckOnly verifies prerequisites without starting a workflow.
#>
[CmdletBinding()]
param(
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$repo = 'JeanLamora75/lmn24'
$workflow = 'deploy-production.yml'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))

function Stop-Deployment {
    param([string]$Message)
    Write-Host ''
    Write-Host "ERREUR : $Message" -ForegroundColor Red
    exit 1
}

function Get-Tool {
    param([string]$Tool, [string]$InstallHint)
    $command = Get-Command $Tool -ErrorAction SilentlyContinue
    if (-not $command) {
        Stop-Deployment "$Tool est introuvable. $InstallHint"
    }
    return $command.Source
}

Write-Host ''
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ' LMN24 - Deploiement manuel OVHcloud'
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ''

$git = Get-Tool 'git' 'Installe Git for Windows ou ajoute Git au PATH Windows.'
$gh = Get-Tool 'gh' 'Installe GitHub CLI (winget install --id GitHub.cli -e), puis rouvre cette fenetre.'
Write-Host '[1/4] Verification du depot Git local...'

$isGitRepo = (& $git -C $repoRoot rev-parse --is-inside-work-tree 2>$null | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $isGitRepo -ne 'true') {
    Stop-Deployment "Le dossier $repoRoot n'est pas un depot Git."
}

$origin = (& $git -C $repoRoot remote get-url origin | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $origin -notmatch '(?i)^(https://github\.com/|git@github\.com:)JeanLamora75/lmn24(\.git)?$') {
    Stop-Deployment "Le depot Git local ne pointe pas vers $repo."
}

$branch = (& $git -C $repoRoot branch --show-current | Out-String).Trim()
$localSha = (& $git -C $repoRoot rev-parse HEAD | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $localSha -notmatch '^[0-9a-f]{40}$') {
    Stop-Deployment 'Impossible de lire le commit local.'
}

# Ignore a single unstaged Next.js-generated file. All other changes block production.
$dirty = @(& $git -C $repoRoot status --porcelain --untracked-files=normal)
if ($LASTEXITCODE -ne 0) {
    Stop-Deployment "Impossible de verifier l'etat Git local."
}
$blockingChanges = @($dirty | Where-Object {
    $_ -and $_ -notmatch '^ M apps/frontend/next-env\.d\.ts$'
})

Write-Host "Branche locale : $branch"
Write-Host "Commit local   : $localSha"

Write-Host ''
Write-Host '[2/4] Verification de GitHub CLI...'
& $gh auth status --hostname github.com
if ($LASTEXITCODE -ne 0) {
    Stop-Deployment 'GitHub CLI n est pas connecte. Lance gh auth login dans PowerShell.'
}

$remoteSha = (& $gh api "repos/$repo/git/ref/heads/main" --jq '.object.sha' | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $remoteSha -notmatch '^[0-9a-f]{40}$') {
    Stop-Deployment "Impossible de lire le commit main depuis GitHub."
}
Write-Host "GitHub main    : $remoteSha"

if ($CheckOnly) {
    Write-Host ''
    Write-Host '[VERIFICATION UNIQUEMENT : AUCUN DEPLOIEMENT]' -ForegroundColor Green
    if ($branch -ne 'main') {
        Write-Host 'Pour deployer, bascule sur main dans GitHub Desktop.'
    }
    if ($localSha -ne $remoteSha) {
        Write-Host 'Avant de deployer, recupere et teste la derniere version main.'
    }
    if ($blockingChanges.Count -gt 0) {
        Write-Host 'Le depot contient des modifications locales a traiter :'
        $blockingChanges | ForEach-Object { Write-Host "  $_" }
    }
    Write-Host 'Git, GitHub CLI, authentification et acces a main : OK.' -ForegroundColor Green
    exit 0
}

Write-Host ''
Write-Host '[3/4] Controle des conditions de publication...'
if ($branch -ne 'main') {
    Stop-Deployment 'Seule la branche main peut etre deployee. Utilise Current branch > main dans GitHub Desktop.'
}
if ($blockingChanges.Count -gt 0) {
    $blockingChanges | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Stop-Deployment 'Des modifications locales non publiees sont presentes. Traite-les dans GitHub Desktop.'
}
if ($localSha -ne $remoteSha) {
    Stop-Deployment 'Ton main local differe du main sur GitHub. Fais Fetch origin / Pull origin, teste la version actualisee, puis recommence.'
}

Write-Host ''
Write-Host 'ATTENTION : tu vas declencher un VRAI deploiement sur OVHcloud.' -ForegroundColor Yellow
Write-Host "Depot      : $repo"
Write-Host 'Branche    : main'
Write-Host "Commit     : $localSha"
Write-Host 'Serveur    : OVHcloud production'
Write-Host 'Les sauvegardes, tests et redemarrages seront executes par GitHub Actions.'
Write-Host ''
$confirmation = Read-Host 'Tape DEPLOYER pour autoriser cette publication'
if ($confirmation -cne 'DEPLOYER') {
    Write-Host 'Publication annulee. Aucune action lancee.' -ForegroundColor Yellow
    exit 0
}

Write-Host ''
Write-Host '[4/4] Lancement du workflow GitHub Actions...'

# Store pre-existing run IDs to find only the newly requested run.
$knownIds = @()
try {
    $jsonBefore = (& $gh run list --repo $repo --workflow $workflow --event workflow_dispatch --branch main --limit 20 --json databaseId | Out-String).Trim()
    if ($LASTEXITCODE -eq 0 -and $jsonBefore) {
        $knownIds = @((ConvertFrom-Json $jsonBefore) | ForEach-Object { [string]$_.databaseId })
    }
} catch {
    Write-Host 'Impossible de memoriser les anciens runs; le lancement reste possible.' -ForegroundColor Yellow
}

& $gh workflow run $workflow --repo $repo --ref main --field "expected_sha=$localSha"
if ($LASTEXITCODE -ne 0) {
    Stop-Deployment 'GitHub a refuse le declenchement. Aucune confirmation de deploiement.'
}

Write-Host 'Workflow demande. Recherche de son execution pour suivre sa progression...'
$runId = $null
for ($i = 0; $i -lt 20 -and -not $runId; $i++) {
    Start-Sleep -Seconds 3
    try {
        $raw = (& $gh run list --repo $repo --workflow $workflow --event workflow_dispatch --branch main --limit 20 --json databaseId,headSha,createdAt | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or -not $raw) { continue }
        $runs = @(ConvertFrom-Json $raw)
        $match = $runs |
            Where-Object { $_.headSha -eq $localSha -and $knownIds -notcontains [string]$_.databaseId } |
            Sort-Object createdAt -Descending |
            Select-Object -First 1
        if ($match) { $runId = [string]$match.databaseId }
    } catch {
        # GitHub Actions can take some time to expose a queued run.
    }
}

if (-not $runId) {
    Write-Host ''
    Write-Host 'Le workflow a ete declenche mais son execution n a pas ete identifiee.' -ForegroundColor Yellow
    Write-Host "Consulte : https://github.com/$repo/actions/workflows/$workflow"
    exit 0
}

Write-Host "Execution GitHub Actions : https://github.com/$repo/actions/runs/$runId"
Write-Host 'Suivi automatique : cette fenetre restera ouverte pendant le deploiement.'
& $gh run watch $runId --repo $repo --interval 5 --exit-status
if ($LASTEXITCODE -ne 0) {
    Stop-Deployment "Le deploiement a echoue ou le suivi a ete interrompu. Consulte https://github.com/$repo/actions/runs/$runId"
}

Write-Host ''
Write-Host 'DEPLOIEMENT REUSSI !' -ForegroundColor Green
Write-Host "Version publiee : $localSha"
Write-Host 'Verifier https://www.lmn24.com/fr et la connexion a l administration.'
exit 0
