
# MediLink POC - Tache 5
# Configuration des partages SMB
# Executer en tant qu'administrateur

$ErrorActionPreference = "Stop"
$root = "C:\medilink"
$username = "medilink"
$account = "$env:COMPUTERNAME\$username"

# 1. Creation des dossiers
$folders = @(
    "$root\dossiersoins\entree",
    "$root\dossiersoins\traite",
    "$root\sage\import"
)

foreach ($folder in $folders) {
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
}

# 2. Creation du compte local si absent
if (-not (Get-LocalUser -Name $username -ErrorAction SilentlyContinue)) {
    $password = Read-Host "Mot de passe du compte medilink" -AsSecureString

    New-LocalUser -Name $username `
        -Password $password `
        -Description "Compte SMB MediLink POC"
}

# 3. Creation des partages SMB
if (-not (Get-SmbShare -Name "dossiersoins" -ErrorAction SilentlyContinue)) {
    New-SmbShare -Name "dossiersoins" `
        -Path "$root\dossiersoins" `
        -ChangeAccess $account
}

if (-not (Get-SmbShare -Name "sage" -ErrorAction SilentlyContinue)) {
    New-SmbShare -Name "sage" `
        -Path "$root\sage" `
        -ChangeAccess $account
}

# 4. Permissions NTFS
icacls "$root\dossiersoins" /grant "${account}:(OI)(CI)M" /T
icacls "$root\sage" /grant "${account}:(OI)(CI)M" /T

# 5. Configuration du pare-feu
if (-not (Get-NetFirewallRule -DisplayName "MediLink SMB" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule `
        -DisplayName "MediLink SMB" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 445 `
        -Action Allow `
        -Profile Private `
        -RemoteAddress LocalSubnet
}

# 6. Verification
Get-SmbShare -Name sage,dossiersoins

Write-Host "Configuration SMB terminee." -ForegroundColor Green
Write-Host "DossierSoins : \\$env:COMPUTERNAME\dossiersoins"
Write-Host "Sage : \\$env:COMPUTERNAME\sage"
# Configuration du pare-feu pour les services web
if (-not (Get-NetFirewallRule -DisplayName "MediLink Web Services" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule `
        -DisplayName "MediLink Web Services" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 8101,8102,8103,8104 `
        -Action Allow `
        -Profile Private `
        -RemoteAddress LocalSubnet
}