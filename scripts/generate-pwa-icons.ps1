param(
  [string]$OutputDir = "public",
  [string]$AndroidResDir = "android/app/src/main/res"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$resolvedOutputDir = Join-Path (Get-Location) $OutputDir
$resolvedAndroidResDir = Join-Path (Get-Location) $AndroidResDir
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

function New-RoundedRectanglePath(
  [float]$x,
  [float]$y,
  [float]$width,
  [float]$height,
  [float]$radius
) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-GradientBrush(
  [System.Drawing.RectangleF]$bounds,
  [string[]]$colors,
  [single[]]$positions,
  [single]$angle
) {
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bounds,
    [System.Drawing.ColorTranslator]::FromHtml($colors[0]),
    [System.Drawing.ColorTranslator]::FromHtml($colors[$colors.Length - 1]),
    $angle
  )
  $blend = [System.Drawing.Drawing2D.ColorBlend]::new($colors.Length)
  $blend.Colors = [System.Drawing.Color[]]@(
    $colors | ForEach-Object { [System.Drawing.ColorTranslator]::FromHtml($_) }
  )
  $blend.Positions = $positions
  $brush.InterpolationColors = $blend
  return $brush
}

function Fill-CeramicPath($graphics, $path) {
  $brush = New-GradientBrush $path.GetBounds() @("#DFBD99", "#C9A27A", "#DDB58D") ([single[]]@(0, 0.52, 1)) 38
  $graphics.FillPath($brush, $path)
  $brush.Dispose()
}

function Fill-ScalePath($graphics, $path) {
  $brush = New-GradientBrush $path.GetBounds() @("#172B3B", "#203345", "#172A3A") ([single[]]@(0, 0.52, 1)) 42
  $graphics.FillPath($brush, $path)
  $brush.Dispose()
}

function Draw-Icon(
  [int]$size,
  [single]$contentScale,
  [bool]$transparentBackground,
  [bool]$roundClip,
  [string]$filePath,
  [bool]$fillCanvas = $false
) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  if ($roundClip) {
    $clipPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $clipPath.AddEllipse(0, 0, $size, $size)
    $graphics.SetClip($clipPath)
    $clipPath.Dispose()
  }

  $backgroundColor = [System.Drawing.ColorTranslator]::FromHtml("#FAF0E7")
  if (-not $transparentBackground) {
    $graphics.Clear($backgroundColor)
  }

  if ($fillCanvas) {
    # The artwork itself spans x=156..876 and y=129..900 in the 1024-unit design.
    # Map those bounds directly to the favicon canvas so no background padding remains.
    $renderScaleX = $size / 720.0
    $renderScaleY = $size / 771.0
    $offsetX = -156 * $renderScaleX
    $offsetY = -129 * $renderScaleY
  } else {
    $designToPixels = $size / 1024.0
    $renderScaleX = $designToPixels * $contentScale
    $renderScaleY = $renderScaleX
    $offsetX = ($size - (1024 * $renderScaleX)) / 2
    $offsetY = $offsetX
  }
  $matrix = [System.Drawing.Drawing2D.Matrix]::new($renderScaleX, 0, 0, $renderScaleY, $offsetX, $offsetY)
  $graphics.Transform = $matrix

  $knob = New-RoundedRectanglePath 407 129 220 26 11
  Fill-CeramicPath $graphics $knob

  $lid = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $lid.AddLine(426, 169, 608, 169)
  $lid.AddBezier(608, 169, 599, 185, 594, 201, 597, 218)
  $lid.AddBezier(597, 218, 669, 226, 732, 261, 768, 319)
  $lid.AddBezier(768, 319, 770, 323, 768, 325, 764, 325)
  $lid.AddLine(764, 325, 268, 325)
  $lid.AddBezier(268, 325, 264, 325, 262, 323, 264, 319)
  $lid.AddBezier(264, 319, 300, 261, 363, 226, 436, 218)
  $lid.AddBezier(436, 218, 439, 201, 437, 186, 425, 172)
  $lid.AddBezier(425, 172, 423, 170, 424, 169, 426, 169)
  $lid.CloseFigure()
  Fill-CeramicPath $graphics $lid

  $bowl = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $bowl.AddLine(175, 336, 857, 336)
  $bowl.AddBezier(857, 336, 829, 365, 815, 396, 807, 439)
  $bowl.AddLine(807, 439, 786, 540)
  $bowl.AddBezier(786, 540, 775, 594, 754, 635, 724, 663)
  $bowl.AddLine(724, 663, 307, 663)
  $bowl.AddBezier(307, 663, 277, 634, 256, 593, 245, 540)
  $bowl.AddLine(245, 540, 224, 439)
  $bowl.AddBezier(224, 439, 215, 396, 202, 365, 174, 339)
  $bowl.AddBezier(174, 339, 172, 337, 173, 336, 175, 336)
  $bowl.CloseFigure()
  Fill-CeramicPath $graphics $bowl

  $saucer = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $saucer.AddLine(193, 674, 839, 674)
  $saucer.AddBezier(839, 674, 839, 697, 801, 719, 730, 730)
  $saucer.AddLine(730, 730, 301, 730)
  $saucer.AddBezier(301, 730, 232, 719, 194, 697, 193, 674)
  $saucer.CloseFigure()
  Fill-CeramicPath $graphics $saucer

  $scaleBase = New-RoundedRectanglePath 156 744 720 156 53
  Fill-ScalePath $graphics $scaleBase

  $ringPen = [System.Drawing.Pen]::new($backgroundColor, 10)
  $graphics.DrawEllipse($ringPen, 477, 784, 78, 78)

  $ringPen.Dispose()
  $scaleBase.Dispose()
  $saucer.Dispose()
  $bowl.Dispose()
  $lid.Dispose()
  $knob.Dispose()
  $matrix.Dispose()
  $graphics.Dispose()

  $parentDir = Split-Path -Parent $filePath
  New-Item -ItemType Directory -Force -Path $parentDir | Out-Null
  $bitmap.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

Draw-Icon 192 1 $false $false (Join-Path $resolvedOutputDir "pwa-192x192.png")
Draw-Icon 512 1 $false $false (Join-Path $resolvedOutputDir "pwa-512x512.png")
Draw-Icon 192 0.76 $false $false (Join-Path $resolvedOutputDir "pwa-maskable-192x192.png")
Draw-Icon 512 0.76 $false $false (Join-Path $resolvedOutputDir "pwa-maskable-512x512.png")
Draw-Icon 180 1 $false $false (Join-Path $resolvedOutputDir "apple-touch-icon.png")
Draw-Icon 64 1 $true $false (Join-Path $resolvedOutputDir "favicon-64x64.png") $true

$androidSizes = [ordered]@{
  "mdpi" = 48
  "hdpi" = 72
  "xhdpi" = 96
  "xxhdpi" = 144
  "xxxhdpi" = 192
}

foreach ($entry in $androidSizes.GetEnumerator()) {
  $mipmapDir = Join-Path $resolvedAndroidResDir ("mipmap-" + $entry.Key)
  Draw-Icon $entry.Value 1 $false $false (Join-Path $mipmapDir "ic_launcher.png")
  Draw-Icon $entry.Value 0.76 $false $true (Join-Path $mipmapDir "ic_launcher_round.png")
  Draw-Icon ([int]($entry.Value * 2.25)) 0.76 $true $false (Join-Path $mipmapDir "ic_launcher_foreground.png")
}

Write-Output "Generated Teapp web, PWA, and Android launcher icons."
