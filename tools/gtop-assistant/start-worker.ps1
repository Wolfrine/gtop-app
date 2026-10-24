param([string]$Config='H:\GTOP-Local-AI\pilot-runtime\worker.json')
$ErrorActionPreference='Stop'
$controllerRoot=$PSScriptRoot
$configPath=(Resolve-Path -LiteralPath $Config).Path
$nodeCandidate=Get-Command node -ErrorAction SilentlyContinue
$nodeExecutable=if($nodeCandidate){$nodeCandidate.Source}else{''}
if(!$nodeExecutable -or [int]((& $nodeExecutable -p 'process.versions.node.split(".")[0]')) -lt 22){
  $nodeExecutable=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if(!(Test-Path -LiteralPath $nodeExecutable)){throw 'Node22 or newer is required; no global runtime is installed by this launcher.'}
$loaderPath=Join-Path $controllerRoot 'node_modules\tsx\dist\loader.mjs'
if(!(Test-Path -LiteralPath $loaderPath)){throw 'Run npm ci in tools/gtop-assistant first.'}
$settings=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Path $settings.dataDirectory -Force | Out-Null
$outPath=Join-Path $settings.dataDirectory 'worker.stdout.log'
$errPath=Join-Path $settings.dataDirectory 'worker.stderr.log'
$active=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'src[\\/]main\.ts' -and $_.CommandLine.Replace('\','/').Contains($configPath.Replace('\','/')) }
if($active){throw 'This controller configuration is already running. Inspect the existing process rather than starting a duplicate.'}
$loaderUri=([System.Uri]$loaderPath).AbsoluteUri
$workerArguments=@('--import',('"{0}"' -f $loaderUri),('"{0}"' -f (Join-Path $controllerRoot 'src\main.ts')),('"{0}"' -f $configPath))
$workerProcess=Start-Process -FilePath $nodeExecutable -ArgumentList $workerArguments -WorkingDirectory $controllerRoot -WindowStyle Hidden -RedirectStandardOutput $outPath -RedirectStandardError $errPath -PassThru
if($workerProcess.WaitForExit(1500)){throw ('Controller exited during startup. Inspect '+$errPath)}
$workerProcess.PriorityClass='BelowNormal'
@{pid=$workerProcess.Id;startedAt=(Get-Date).ToUniversalTime().ToString('o');config=$configPath;stdout=$outPath;stderr=$errPath} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $settings.dataDirectory 'process.json') -Encoding utf8
Write-Output ('Controller started as process '+$workerProcess.Id+'. Readiness is reported by the application.')
