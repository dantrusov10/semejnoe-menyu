# Ставит GEMINI_API_KEY в Cloudflare Worker Secrets (не в git).
# Читает ключ с рабочего стола: Google API Key.txt
# Требует: wrangler login  ИЛИ  $env:CLOUDFLARE_API_TOKEN

$ErrorActionPreference = "Stop"
$desk = [Environment]::GetFolderPath("Desktop")
$keyFile = Join-Path $desk "Google API Key.txt"
if (-not (Test-Path $keyFile)) {
  Write-Error "Не найден файл: $keyFile"
}

$raw = Get-Content -Raw -Encoding UTF8 $keyFile
$key = $null
foreach ($line in ($raw -split "`r?`n")) {
  $t = $line.Trim()
  if ($t -match '^(AIza|AQ\.)[A-Za-z0-9_\-]+$') { $key = $t; break }
}
if (-not $key) {
  # fallback: первая длинная «похожая на ключ» строка
  foreach ($line in ($raw -split "`r?`n")) {
    $t = $line.Trim()
    if ($t.Length -ge 30 -and $t -notmatch '\s' -and $t -notmatch '^(API|Name|Project|For )') {
      $key = $t
      break
    }
  }
}
if (-not $key) { Write-Error "В файле не найден API key" }

Write-Host "Ключ прочитан (длина $($key.Length)). Отправляю в Worker secret GEMINI_API_KEY…"
$key | npx --yes wrangler@3 secret put GEMINI_API_KEY
if ($LASTEXITCODE -ne 0) { Write-Error "secret put failed. Сначала: npx wrangler login" }

Write-Host "Деплой Worker…"
npx --yes wrangler@3 deploy
if ($LASTEXITCODE -ne 0) { Write-Error "deploy failed" }

Write-Host "Готово. Ключ только в Cloudflare Secrets, не в репозитории."
