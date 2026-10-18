# 生成扩展图标：橙色圆角方块 + 白色下载箭头。
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\make-icons.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'assets\icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-RoundedPath {
    param([float]$x, [float]$y, [float]$w, [float]$h, [float]$r)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

$size = 512
$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

$rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$bgPath = New-RoundedPath 0 0 $size $size 112
$c1 = [System.Drawing.Color]::FromArgb(255, 255, 122, 61)
$c2 = [System.Drawing.Color]::FromArgb(255, 255, 77, 15)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)
$g.FillPath($brush, $bgPath)

$white = [System.Drawing.Color]::White
$whiteBrush = New-Object System.Drawing.SolidBrush($white)

# 箭杆
$stemPath = New-RoundedPath 226 112 60 190 30
$g.FillPath($whiteBrush, $stemPath)

# 箭头
$head = @(
    (New-Object System.Drawing.PointF(150, 260)),
    (New-Object System.Drawing.PointF(362, 260)),
    (New-Object System.Drawing.PointF(256, 396))
)
$g.FillPolygon($whiteBrush, $head)

# 托盘
$pen = New-Object System.Drawing.Pen($white, 42)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$g.DrawLine($pen, 136, 352, 136, 404)
$g.DrawLine($pen, 136, 404, 376, 404)
$g.DrawLine($pen, 376, 404, 376, 352)

$pen.Dispose()
$whiteBrush.Dispose()
$brush.Dispose()
$g.Dispose()

foreach ($target in 16, 32, 48, 128) {
    $out = New-Object System.Drawing.Bitmap($target, $target, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $og = [System.Drawing.Graphics]::FromImage($out)
    $og.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $og.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $og.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $og.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $dest = New-Object System.Drawing.Rectangle(0, 0, $target, $target)
    $og.DrawImage($bmp, $dest)
    $og.Dispose()
    $file = Join-Path $outDir "icon$target.png"
    $out.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose()
    Write-Output "generated $file"
}

$bmp.Dispose()
