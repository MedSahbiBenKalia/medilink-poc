# Teste depuis CE PC : ping des 5 PC + ports TCP de chaque service (interfaces.md section 1).
#   .\test-reseau.ps1            reseau de demo (IP 192.168.1.11 a .15)
#   .\test-reseau.ps1 -Local     plan B : tout sur localhost
# Un service non demarre apparait KO : normal tant que son equipe ne l'a pas lance.

param([switch]$Local)

$pcs = @(
    @{ Nom = 'PC1 Workflow';    Ip = '192.168.1.11'; Ports = @(8080) },
    @{ Nom = 'PC2 Soins';       Ip = '192.168.1.12'; Ports = @(8081, 8091, 8092, 8093, 8094, 5432) },
    @{ Nom = 'PC3 Gestion';     Ip = '192.168.1.13'; Ports = @(8082, 8095, 8096, 5432) },
    @{ Nom = 'PC4 Entree';      Ip = '192.168.1.14'; Ports = @(8000, 8001, 5672, 15672, 1025, 8025) },
    @{ Nom = 'PC5 Exterieur';   Ip = '192.168.1.15'; Ports = @(8101, 8102, 8103, 8104) }
)

function Test-Port([string]$ip, [int]$port) {
    $c = New-Object System.Net.Sockets.TcpClient
    try {
        $t = $c.ConnectAsync($ip, $port)
        return ($t.Wait(1500) -and $c.Connected)
    } catch { return $false } finally { $c.Dispose() }
}

foreach ($pc in $pcs) {
    $ip = if ($Local) { 'localhost' } else { $pc.Ip }
    $ping = if ($Local) { '-' } elseif (Test-Connection -ComputerName $ip -Count 1 -Quiet) { 'OK' } else { 'KO' }
    Write-Host ""
    Write-Host "$($pc.Nom)  ($ip)  ping: $ping"
    foreach ($p in $pc.Ports) {
        $etat = if (Test-Port $ip $p) { 'OK' } else { 'KO' }
        $couleur = if ($etat -eq 'OK') { 'Green' } else { 'Red' }
        Write-Host ("   {0,6}  {1}" -f $p, $etat) -ForegroundColor $couleur
    }
}
