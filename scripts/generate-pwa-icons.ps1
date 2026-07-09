param(
  [string]$OutputDir = "public"
)

Add-Type -AssemblyName System.Drawing

$resolvedOutputDir = Join-Path (Get-Location) $OutputDir
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

function New-Brush([string]$hex) {
  return [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function New-Pen([string]$hex, [float]$width) {
  $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($hex), $width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function Draw-RoundedRectangle($graphics, [float]$x, [float]$y, [float]$width, [float]$height, [float]$radius, $brush) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $graphics.FillPath($brush, $path)
  $path.Dispose()
}

function Draw-Icon([int]$size, [bool]$maskable, [string]$fileName) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $bg = New-Brush "#164E43"
  $cream = New-Brush "#F6E7C8"
  $tea = New-Brush "#D59A38"
  $accent = New-Brush "#8ED6C9"
  $darkPen = New-Pen "#164E43" ($size * 0.045)
  $creamPen = New-Pen "#F6E7C8" ($size * 0.045)
  $accentPen = New-Pen "#8ED6C9" ($size * 0.03)

  if ($maskable) {
    $graphics.FillRectangle($bg, 0, 0, $size, $size)
    $safe = $size * 0.18
  } else {
    $safe = $size * 0.08
    Draw-RoundedRectangle $graphics $safe $safe ($size - $safe * 2) ($size - $safe * 2) ($size * 0.18) $bg
  }

  $cupX = $size * 0.27
  $cupY = $size * 0.38
  $cupW = $size * 0.46
  $cupH = $size * 0.29
  Draw-RoundedRectangle $graphics $cupX $cupY $cupW $cupH ($size * 0.075) $cream
  $graphics.FillEllipse($tea, $cupX + $size * 0.055, $cupY + $size * 0.045, $cupW - $size * 0.11, $size * 0.085)
  $graphics.DrawArc($creamPen, $cupX + $cupW - $size * 0.045, $cupY + $size * 0.055, $size * 0.18, $size * 0.18, 275, 175)

  $graphics.DrawLine($creamPen, $size * 0.32, $size * 0.75, $size * 0.68, $size * 0.75)
  $graphics.DrawLine($creamPen, $size * 0.5, $size * 0.67, $size * 0.5, $size * 0.75)
  $graphics.DrawLine($accentPen, $size * 0.39, $size * 0.79, $size * 0.61, $size * 0.79)

  $graphics.DrawBezier($accentPen, $size * 0.38, $size * 0.29, $size * 0.28, $size * 0.18, $size * 0.51, $size * 0.18, $size * 0.43, $size * 0.08)
  $graphics.DrawBezier($accentPen, $size * 0.56, $size * 0.30, $size * 0.47, $size * 0.19, $size * 0.70, $size * 0.19, $size * 0.62, $size * 0.09)

  $graphics.DrawLine($darkPen, $cupX + $size * 0.11, $cupY + $size * 0.20, $cupX + $cupW - $size * 0.11, $cupY + $size * 0.20)

  $path = Join-Path $resolvedOutputDir $fileName
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

  $darkPen.Dispose()
  $creamPen.Dispose()
  $accentPen.Dispose()
  $bg.Dispose()
  $cream.Dispose()
  $tea.Dispose()
  $accent.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Draw-Icon 192 $false "pwa-192x192.png"
Draw-Icon 512 $false "pwa-512x512.png"
Draw-Icon 192 $true "pwa-maskable-192x192.png"
Draw-Icon 512 $true "pwa-maskable-512x512.png"
Draw-Icon 180 $false "apple-touch-icon.png"
Draw-Icon 64 $false "favicon-64x64.png"

Write-Output "Generated Teapp PWA icons in $resolvedOutputDir"
