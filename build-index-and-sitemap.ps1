$root = Get-Location
$domain = "https://ai-studies.net"
$encoding = New-Object System.Text.UTF8Encoding($true)

# Chinese strings via Unicode escapes (avoid ps1 encoding problems)
$title = [string]::Concat(
    [char]0x9646,[char]0x65B0,[char]0x5F81,[char]0x8BFE,[char]0x9898,[char]0x7EC4,
    [char]0x5FAE,[char]0x4FE1,[char]0x516C,[char]0x4F17,[char]0x53F7,
    [char]0x6587,[char]0x7AE0,[char]0x5907,[char]0x4EFD
)

$dirs = Get-ChildItem -Directory | Where-Object {
    Test-Path (Join-Path $_.FullName "index.html")
} | Sort-Object Name

$items = $dirs | ForEach-Object {
    $name = $_.Name
    "    <li><a href=""./$name/index.html"">$name</a></li>"
}

$indexHtml = @()
$indexHtml += "<!doctype html>"
$indexHtml += "<html lang=""zh-CN"">"
$indexHtml += "<head>"
$indexHtml += "  <meta charset=""utf-8"">"
$indexHtml += "  <meta name=""viewport"" content=""width=device-width, initial-scale=1"">"
$indexHtml += "  <title>$title</title>"
$indexHtml += "  <style>body{font-family:Arial,Helvetica,'PingFang SC','Microsoft YaHei',sans-serif;max-width:1100px;margin:40px auto;padding:0 16px;line-height:1.6} ul{columns:2;-webkit-columns:2;-moz-columns:2} li{break-inside:avoid}</style>"
$indexHtml += "</head>"
$indexHtml += "<body>"
$indexHtml += "  <h1>$title</h1>"
$indexHtml += "  <p>Count: $($dirs.Count)</p>"
$indexHtml += "  <ul>"
$indexHtml += $items
$indexHtml += "  </ul>"
$indexHtml += "</body>"
$indexHtml += "</html>"

[System.IO.File]::WriteAllLines((Join-Path $root "index.html"), $indexHtml, $encoding)

$now = (Get-Date).ToString("yyyy-MM-dd")
$sm = @()
$sm += "<?xml version=""1.0"" encoding=""UTF-8""?>"
$sm += "<urlset xmlns=""http://www.sitemaps.org/schemas/sitemap/0.9"">"
$sm += "  <url><loc>$domain/</loc><lastmod>$now</lastmod></url>"
$dirs | ForEach-Object {
    $name = $_.Name
    $sm += "  <url><loc>$domain/$name/index.html</loc><lastmod>$now</lastmod></url>"
}
$sm += "</urlset>"
[System.IO.File]::WriteAllLines((Join-Path $root "sitemap.xml"), $sm, $encoding)

"Done. folders=$($dirs.Count)"