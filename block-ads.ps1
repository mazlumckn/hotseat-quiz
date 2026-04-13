# ============================================================
# CINEMATIC APP — Sistem Düzeyinde Reklam Engelleyici
# Admin olarak çalıştır: sağ tık > "Yönetici olarak çalıştır"
# ============================================================

$adDomains = @(
    "googlesyndication.com",
    "pagead2.googlesyndication.com",
    "tpc.googlesyndication.com",
    "adservice.google.com",
    "adservice.google.com.tr",
    "doubleclick.net",
    "ad.doubleclick.net",
    "pubads.g.doubleclick.net",
    "securepubads.g.doubleclick.net",
    "googletagmanager.com",
    "googletagservices.com",
    "google-analytics.com",
    "www.google-analytics.com",
    "ssl.google-analytics.com",
    "amazon-adsystem.com",
    "aax.amazon-adsystem.com",
    "aax-us-east.amazon-adsystem.com",
    "ads.yahoo.com",
    "advertising.com",
    "adnxs.com",
    "ib.adnxs.com",
    "ads.pubmatic.com",
    "image6.pubmatic.com",
    "rubiconproject.com",
    "fastlane.rubiconproject.com",
    "openx.net",
    "us-u.openx.net",
    "taboola.com",
    "trc.taboola.com",
    "outbrain.com",
    "amplify.outbrain.com",
    "criteo.com",
    "dis.criteo.com",
    "bidswitch.net",
    "x.bidswitch.net",
    "casalemedia.com",
    "ssum-sec.casalemedia.com",
    "spotxchange.com",
    "search.spotxchange.com",
    "vidoomy.com",
    "sync.vidoomy.com",
    "vidazoo.com",
    "prebid.vidazoo.com",
    "exoclick.com",
    "server.cpmads.com",
    "prooptiki.com",
    "trafficfactory.biz",
    "popcash.net",
    "propellerads.com",
    "adsterra.com",
    "clickadu.com"
)

$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$existing  = Get-Content $hostsPath -Raw

$added = 0
foreach ($domain in $adDomains) {
    if ($existing -notmatch [regex]::Escape($domain)) {
        Add-Content -Path $hostsPath -Value "127.0.0.1    $domain"
        Add-Content -Path $hostsPath -Value "127.0.0.1    www.$domain"
        $added++
        Write-Host "Blocked: $domain" -ForegroundColor Green
    } else {
        Write-Host "Already blocked: $domain" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  $added reklam domaini engellendi!" -ForegroundColor Cyan
Write-Host "  Degisikliklerin etkili olmasi icin" -ForegroundColor Cyan
Write-Host "  tarayicinizi yeniden baslatiniz." -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# DNS cache temizle
ipconfig /flushdns | Out-Null
Write-Host "  DNS cache temizlendi." -ForegroundColor Green
