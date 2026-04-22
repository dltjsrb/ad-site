param(
  [string]$SiteUrl = "https://dreamfortunearchive.example"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$siteName = "Dream & Fortune Archive"
$defaultOgImage = "$SiteUrl/assets/images/og-default.svg"
$htmlFiles = Get-ChildItem -Path $projectRoot -Recurse -File | Where-Object { $_.Extension -eq ".html" }

function Get-RoutePath {
  param([string]$FullName)

  $relative = $FullName.Substring($projectRoot.Length).TrimStart("\").Replace("\", "/")

  if ($relative -eq "index.html") {
    return "/"
  }

  if ($relative -eq "404.html") {
    return "/404.html"
  }

  if ($relative.EndsWith("/index.html")) {
    return "/" + $relative.Replace("/index.html", "/")
  }

  return "/" + $relative
}

function Get-RelativePrefix {
  param([string]$FullName)

  $relative = $FullName.Substring($projectRoot.Length).TrimStart("\").Replace("\", "/")
  $directory = Split-Path $relative -Parent

  if (-not $directory -or $directory -eq ".") {
    return ""
  }

  $depth = ($directory -split "[/\\]").Count
  return ((1..$depth | ForEach-Object { "../" }) -join "")
}

function Remove-ExistingMeta {
  param([string]$Content)

  $patterns = @(
    '<meta name="theme-color" content="[^"]*">\r?\n?',
    '<meta name="robots" content="index,follow">\r?\n?',
    '<meta property="og:site_name" content="[^"]*">\r?\n?',
    '<meta property="og:title" content="[^"]*">\r?\n?',
    '<meta property="og:description" content="[^"]*">\r?\n?',
    '<meta property="og:type" content="[^"]*">\r?\n?',
    '<meta property="og:url" content="[^"]*">\r?\n?',
    '<meta property="og:image" content="[^"]*">\r?\n?',
    '<meta name="twitter:card" content="[^"]*">\r?\n?',
    '<meta name="twitter:title" content="[^"]*">\r?\n?',
    '<meta name="twitter:description" content="[^"]*">\r?\n?',
    '<meta name="twitter:image" content="[^"]*">\r?\n?',
    '<link rel="canonical" href="[^"]*">\r?\n?',
    '<link rel="icon" href="[^"]*" type="image/svg\+xml">\r?\n?',
    '<link rel="manifest" href="[^"]*">\r?\n?'
  )

  foreach ($pattern in $patterns) {
    $Content = [regex]::Replace($Content, $pattern, "")
  }

  return $Content
}

foreach ($file in $htmlFiles) {
  $content = Get-Content -Raw -Encoding UTF8 $file.FullName
  $content = Remove-ExistingMeta -Content $content

  $titleMatch = [regex]::Match($content, '<title>([^<]+)</title>')
  if (-not $titleMatch.Success) {
    continue
  }

  $descriptionMatch = [regex]::Match($content, '<meta name="description" content="([^"]*)">')
  $title = $titleMatch.Groups[1].Value
  $description = if ($descriptionMatch.Success) { $descriptionMatch.Groups[1].Value } else { $siteName }
  $routePath = Get-RoutePath -FullName $file.FullName
  $relativePrefix = Get-RelativePrefix -FullName $file.FullName
  $iconHref = "${relativePrefix}assets/images/icon.svg"
  $manifestHref = "${relativePrefix}site.webmanifest"
  $isNoIndex = $routePath -eq "/404.html" -or $content -match '<meta name="robots" content="noindex'
  $ogType = if ($routePath -eq "/") { "website" } else { "article" }

  $metaLines = @(
    '  <meta name="theme-color" content="#6B5B95">'
  )

  if (-not $isNoIndex) {
    $metaLines += '  <meta name="robots" content="index,follow">'
    $metaLines += "  <meta property=`"og:site_name`" content=`"$siteName`">"
    $metaLines += "  <meta property=`"og:title`" content=`"$title`">"
    $metaLines += "  <meta property=`"og:description`" content=`"$description`">"
    $metaLines += "  <meta property=`"og:type`" content=`"$ogType`">"
    $metaLines += "  <meta property=`"og:url`" content=`"$SiteUrl$routePath`">"
    $metaLines += "  <meta property=`"og:image`" content=`"$defaultOgImage`">"
    $metaLines += '  <meta name="twitter:card" content="summary_large_image">'
    $metaLines += "  <meta name=`"twitter:title`" content=`"$title`">"
    $metaLines += "  <meta name=`"twitter:description`" content=`"$description`">"
    $metaLines += "  <meta name=`"twitter:image`" content=`"$defaultOgImage`">"
    $metaLines += "  <link rel=`"canonical`" href=`"$SiteUrl$routePath`">"
  }

  $metaLines += "  <link rel=`"icon`" href=`"$iconHref`" type=`"image/svg+xml`">"
  $metaLines += "  <link rel=`"manifest`" href=`"$manifestHref`">"
  $metaBlock = ($metaLines -join "`r`n") + "`r`n"

  if ($descriptionMatch.Success) {
    $escapedDescription = [regex]::Escape($descriptionMatch.Value)
    $content = [regex]::Replace($content, $escapedDescription, "$($descriptionMatch.Value)`r`n$metaBlock", 1)
  } else {
    $viewportMatch = [regex]::Match($content, '<meta name="viewport" content="[^"]*">')
    if ($viewportMatch.Success) {
      $escapedViewport = [regex]::Escape($viewportMatch.Value)
      $content = [regex]::Replace($content, $escapedViewport, "$($viewportMatch.Value)`r`n$metaBlock", 1)
    }
  }

  [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.UTF8Encoding]::new($false))
}

$sitemapEntries = foreach ($file in $htmlFiles) {
  $routePath = Get-RoutePath -FullName $file.FullName
  if ($routePath -eq "/404.html") {
    continue
  }

  $lastmod = $file.LastWriteTime.ToString("yyyy-MM-dd")
  $priority = switch -Regex ($routePath) {
    '^/$' { '1.0'; break }
    '^/dream/.+/$' { '0.8'; break }
    '^/dream/$' { '0.9'; break }
    '^/guide/' { '0.7'; break }
    '^/fortune/' { '0.7'; break }
    default { '0.5' }
  }

  @"
  <url>
    <loc>$SiteUrl$routePath</loc>
    <lastmod>$lastmod</lastmod>
    <priority>$priority</priority>
  </url>
"@
}

$sitemap = @"
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
$($sitemapEntries -join "`r`n")
</urlset>
"@
[System.IO.File]::WriteAllText((Join-Path $projectRoot "sitemap.xml"), $sitemap, [System.Text.UTF8Encoding]::new($false))

$robots = @"
User-agent: *
Allow: /

Sitemap: $SiteUrl/sitemap.xml
"@
[System.IO.File]::WriteAllText((Join-Path $projectRoot "robots.txt"), $robots, [System.Text.UTF8Encoding]::new($false))

$manifest = @"
{
  "name": "$siteName",
  "short_name": "DreamFortune",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F5F3F0",
  "theme_color": "#6B5B95",
  "icons": [
    {
      "src": "/assets/images/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
"@
[System.IO.File]::WriteAllText((Join-Path $projectRoot "site.webmanifest"), $manifest, [System.Text.UTF8Encoding]::new($false))
