param(
  [ValidateSet('Both', 'Claude', 'Codex')][string]$Provider = 'Both',
  [string]$Engine = 'podman',
  [string]$Container = 'orca',
  [string]$AWSProfile = '062518125967_Bedrock',
  [string]$AWSRegion = 'us-east-2',
  [string]$ClaudeModel = 'us.anthropic.claude-opus-5-5',
  [string]$CodexModel = 'gpt-6.1-sol-global',
  [string]$CodexCatalogPath = (Join-Path $env:USERPROFILE '.codex/accela-models.json'),
  [string]$CodexBaseUrl = 'https://ai-support-apim-vnet.azure-api.net/openai',
  [string]$CodexAudience = 'api://f2d4f682-0844-4997-92f9-1a4f5b33e6f4'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'resolve-engine.ps1')
$Engine = Resolve-OrcaContainerEngine $Engine
$records = @{}
if ($Provider -in @('Both', 'Claude')) {
  $awsCommand = Get-Command aws -ErrorAction SilentlyContinue
  $awsPath = if ($awsCommand) { $awsCommand.Source } else { Join-Path $env:ProgramFiles 'Amazon/AWSCLIV2/aws.exe' }
  if (!(Test-Path -LiteralPath $awsPath)) { throw 'Install AWS CLI and sign in to the selected Bedrock profile first.' }
  $identity = & $awsPath sts get-caller-identity --profile $AWSProfile --region $AWSRegion --query Account --output text 2>$null
  if ($LASTEXITCODE -ne 0 -or !$identity) { throw "AWS profile $AWSProfile is not authenticated; refresh it through your usual AWS sign-in." }
  $credentialJson = & $awsPath configure export-credentials --profile $AWSProfile --format process 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Could not export the selected temporary AWS session.' }
  $records.claude = @{ credentials = ($credentialJson | ConvertFrom-Json); region = $AWSRegion; model = $ClaudeModel }
}
if ($Provider -in @('Both', 'Codex')) {
  $azCommand = Get-Command az -ErrorAction SilentlyContinue
  $azPath = if ($azCommand) { $azCommand.Source } else { Join-Path $env:ProgramFiles 'Microsoft SDKs/Azure/CLI2/wbin/az.cmd' }
  if (!(Test-Path -LiteralPath $azPath)) { throw 'Install Azure CLI and sign in to the Accela tenant first.' }
  $tokenJson = & $azPath account get-access-token --resource $CodexAudience --output json 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Refresh your organization Azure CLI sign-in before configuring Codex.' }
  $tokenRecord = $tokenJson | ConvertFrom-Json
  if (!$tokenRecord.expires_on) { throw 'Azure CLI must supply the UTC expires_on field; update Azure CLI.' }
  $records.codex = @{ accessToken = $tokenRecord.accessToken; expires_on = [long]$tokenRecord.expires_on; base_url = $CodexBaseUrl; model = $CodexModel }
  if (Test-Path -LiteralPath $CodexCatalogPath) {
    $records.codex.model_catalog = Get-Content -LiteralPath $CodexCatalogPath -Raw | ConvertFrom-Json
  }
}
$records | ConvertTo-Json -Depth 64 -Compress | & $Engine exec -i --user 1000:1000 $Container /usr/bin/python3 /opt/orca/agent-runtimes/runtime-auth.py import
if ($LASTEXITCODE -ne 0) { throw 'Container runtime authentication import failed.' }
$records.Clear()
$credentialJson = $null
$tokenJson = $null
$tokenRecord = $null
