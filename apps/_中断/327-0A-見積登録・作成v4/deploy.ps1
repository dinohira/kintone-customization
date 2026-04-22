$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$baseUrl = "https://asamikogyo.cybozu.com"
$auth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("d_inohira@asami-k.co.jp:asami2024"))
$appId = "327"

$filePath = Join-Path $PSScriptRoot "desktop\js\material-selector.js"
Write-Host "Step 1: Uploading $filePath ..."

$httpClient = New-Object System.Net.Http.HttpClient
$httpClient.DefaultRequestHeaders.Add("X-Cybozu-Authorization", $auth)

$multipart = New-Object System.Net.Http.MultipartFormDataContent
$fileStream = [System.IO.File]::OpenRead($filePath)
$fileContent = New-Object System.Net.Http.StreamContent($fileStream)
$fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/javascript")
$multipart.Add($fileContent, "file", "material-selector.js")

$uploadResp = $httpClient.PostAsync("$baseUrl/k/v1/file.json", $multipart).Result
$uploadBody = $uploadResp.Content.ReadAsStringAsync().Result
$fileStream.Close()
$httpClient.Dispose()

Write-Host "Upload response: $uploadBody"

Add-Type -AssemblyName System.Web.Extensions
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$uploadJson = $serializer.DeserializeObject($uploadBody)
$fileKey = $uploadJson["fileKey"]
Write-Host "File Key: $fileKey"

Write-Host "Step 2: Updating customization..."
$customizeBody = '{"app":"' + $appId + '","scope":"ALL","desktop":{"js":[{"type":"FILE","file":{"fileKey":"' + $fileKey + '"}}],"css":[]}}'

$resp2 = Invoke-RestMethod -Uri "$baseUrl/k/v1/preview/app/customize.json" -Method Put -ContentType "application/json; charset=utf-8" -Headers @{"X-Cybozu-Authorization"=$auth} -Body ([Text.Encoding]::UTF8.GetBytes($customizeBody))
Write-Host "Customization updated. Revision: $($resp2.revision)"

Write-Host "Step 3: Deploying..."
$deployBody = '{"apps":[{"app":"' + $appId + '"}]}'
$resp3 = Invoke-RestMethod -Uri "$baseUrl/k/v1/preview/app/deploy.json" -Method Post -ContentType "application/json; charset=utf-8" -Headers @{"X-Cybozu-Authorization"=$auth} -Body ([Text.Encoding]::UTF8.GetBytes($deployBody))
Write-Host "Deploy complete!"
