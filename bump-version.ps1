$root = "D:\Projects\worklog"

$pkgPath   = "$root\package.json"
$tauriPath = "$root\src-tauri\tauri.conf.json"
$cargoPath = "$root\src-tauri\Cargo.toml"

$pkg = Get-Content $pkgPath | ConvertFrom-Json
$v   = [version]$pkg.version
$new = "{0}.{1}.{2}" -f $v.Major, $v.Minor, ($v.Build + 1)

Write-Host "Version: $($pkg.version) -> $new"

$old = $pkg.version

(Get-Content $pkgPath   -Raw) -replace """version"": ""$old""", """version"": ""$new""" | Set-Content $pkgPath   -NoNewline
(Get-Content $tauriPath -Raw) -replace """version"": ""$old""", """version"": ""$new""" | Set-Content $tauriPath -NoNewline
(Get-Content $cargoPath -Raw) -replace "version = ""$old""",   "version = ""$new"""   | Set-Content $cargoPath -NoNewline
