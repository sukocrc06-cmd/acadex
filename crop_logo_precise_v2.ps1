[System.Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null
$srcPath = "c:\Users\sukru\OneDrive\Desktop\acadex\assets\logo.png"
$destPath = "c:\Users\sukru\OneDrive\Desktop\acadex\assets\logo-icon-only.png"

$img = New-Object System.Drawing.Bitmap($srcPath)

# Crop coordinates based on column & row scanning of the icon
$cropX = 270
$cropY = 220
$cropW = 485  # 755 - 270
$cropH = 380  # 600 - 220

Write-Host "Cropping rect: X=$cropX, Y=$cropY, W=$cropW, H=$cropH"

# Create a new bitmap with the cropped region
$croppedImg = New-Object System.Drawing.Bitmap($cropW, $cropH)
$g = [System.Drawing.Graphics]::FromImage($croppedImg)

$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

$srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
$destRect = New-Object System.Drawing.Rectangle(0, 0, $cropW, $cropH)

$g.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

# Make white pixels transparent
# We check if a pixel is very close to white (R>=250, G>=250, B>=250) and make it transparent.
# To be robust, let's loop through all pixels in the cropped image and set their alpha to 0 if they are white/near-white.
for ($y = 0; $y -lt $croppedImg.Height; $y++) {
    for ($x = 0; $x -lt $croppedImg.Width; $x++) {
        $p = $croppedImg.GetPixel($x, $y)
        if ($p.R -ge 245 -and $p.G -ge 245 -and $p.B -ge 245) {
            $croppedImg.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
        }
    }
}

$croppedImg.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$croppedImg.Dispose()
$img.Dispose()

Write-Host "Successfully saved cropped icon to $destPath"
