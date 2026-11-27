# Ouvre dans le pare-feu Windows les ports du PC indique (interfaces.md section 1).
# A lancer dans PowerShell EN ADMINISTRATEUR, sur chaque PC :
#   .\pare-feu.ps1 -Pc PC2
# Pour retirer les regles :  .\pare-feu.ps1 -Pc PC2 -Remove

param(
    [Parameter(Mandatory)][ValidateSet('PC1', 'PC2', 'PC3', 'PC4', 'PC5')][string]$Pc,
    [switch]$Remove
)

$ports = @{
    PC1 = @('8080')
    PC2 = @('8081', '8091-8094', '5432')
    PC3 = @('8082', '8095-8096', '5432')
    PC4 = @('8000', '8001', '5672', '15672', '1025', '8025')
    PC5 = @('8101-8104')
}

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Write-Error "Lancer PowerShell en administrateur."; exit 1 }

$nomTcp = "MediLink $Pc (TCP)"
$nomPing = "MediLink ping"

Get-NetFirewallRule -DisplayName $nomTcp -ErrorAction SilentlyContinue | Remove-NetFirewallRule
if ($Remove) {
    Get-NetFirewallRule -DisplayName $nomPing -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Write-Host "Regles MediLink retirees pour $Pc."
    exit 0
}

# Profil Any : le Wi-Fi de demo est souvent classe "Public" par Windows
New-NetFirewallRule -DisplayName $nomTcp -Direction Inbound -Protocol TCP -LocalPort $ports[$Pc] -Action Allow -Profile Any | Out-Null

# Autorise aussi le ping (test de connexion entre PC)
if (-not (Get-NetFirewallRule -DisplayName $nomPing -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $nomPing -Direction Inbound -Protocol ICMPv4 -IcmpType 8 -Action Allow -Profile Any | Out-Null
}

Write-Host "Ports ouverts sur $Pc : $($ports[$Pc] -join ', ') (+ ping)"
