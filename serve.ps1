$root = $PSScriptRoot
$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")
try {
    $listener.Start()
} catch {
    Write-Host "Failed to start: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Probably port 8000 is busy. Close other servers and retry." -ForegroundColor Yellow
    pause
    exit 1
}
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  HRconnect local server" -ForegroundColor Cyan
Write-Host "  URL: http://localhost:$port" -ForegroundColor Green
Write-Host "  Root: $root" -ForegroundColor Gray
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".ico"  = "image/x-icon"
    ".pdf"  = "application/pdf"
    ".woff" = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"  = "font/ttf"
    ".txt"  = "text/plain; charset=utf-8"
}

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response

        $path = $req.Url.LocalPath
        if ($path -eq "/") { $path = "/index.html" }
        # Strip query string already done by LocalPath
        $rel = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $filePath = Join-Path $root $rel

        # If it's a directory, append index.html
        if (Test-Path $filePath -PathType Container) {
            $filePath = Join-Path $filePath "index.html"
        }
        # If no extension and file doesn't exist, try .html
        if (-not (Test-Path $filePath) -and -not [System.IO.Path]::HasExtension($filePath)) {
            if (Test-Path "$filePath.html") { $filePath = "$filePath.html" }
        }

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $ct = $mime[$ext]
            if (-not $ct) { $ct = "application/octet-stream" }
            $res.ContentType = $ct
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "200 $($req.HttpMethod) $path" -ForegroundColor DarkGray
        } else {
            $res.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
            $res.OutputStream.Write($msg, 0, $msg.Length)
            Write-Host "404 $path" -ForegroundColor DarkYellow
        }
        $res.Close()
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
