#requires -Version 5.1
param(
    [switch]$Create,
    [string]$Name = "AI & ML Tools",
    [string]$Description = "Machine learning, deep learning, and AI-powered tools and frameworks",
    [switch]$List,
    [switch]$AddRepo,
    [string]$ListId,
    [string]$Owner,
    [string]$Repo
)

function gql($q) {
    $tok = gh auth token
    $body = @{query=$q} | ConvertTo-Json -Compress
    $hdr = @{Authorization="Bearer $tok"; "Content-Type"="application/json"}
    $r = Invoke-RestMethod -Uri "https://api.github.com/graphql" -Method Post -Headers $hdr -Body $body
    return $r
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "      GitHub List Manager" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "GitHub CLI (gh) not found. Install from: https://cli.github.com/"
    exit 1
}

# Test user scope
Write-Host "Checking GitHub token scope..." -NoNewline
$test = gql '{ viewer { id } }'
if ($test.errors -and ($test.errors.message -like "*INSUFFICIENT_SCOPES*")) {
    Write-Host " MISSING" -ForegroundColor Red
    Write-Host ""
    Write-Host "Your token is missing the 'user' scope required for list management." -ForegroundColor Yellow
    Write-Host "Run this command in your terminal:" -ForegroundColor White
    Write-Host "  gh auth refresh -h github.com -s user" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then follow the browser flow at https://github.com/login/device" -ForegroundColor Gray
    Write-Host ""
    Write-Host "After refreshing, run this script again." -ForegroundColor White
    exit 1
}
Write-Host " OK (user scope granted)" -ForegroundColor Green
Write-Host ""

if ($Create) {
    Write-Host "Creating list: '$Name'..." -ForegroundColor Cyan
    $query = 'mutation { createUserList(input: {name: "' + $Name + '", description: "' + $Description + '"}) { list { id name description } } }'
    $result = gql $query
    if ($result.errors) {
        Write-Error "Failed: $($result.errors[0].message)"
        exit 1
    }
    $list = $result.data.createUserList.list
    Write-Host "Created successfully!" -ForegroundColor Green
    Write-Host "  ID: $($list.id)" -ForegroundColor Gray
    Write-Host "  Name: $($list.name)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To add repositories:" -ForegroundColor White
    Write-Host "  .\github-lists.ps1 -AddRepo -ListId '$($list.id)' -Owner 'owner' -Repo 'repo'" -ForegroundColor Cyan
}

if ($List) {
    Write-Host "Fetching your lists..." -ForegroundColor Cyan
    $result = gql '{ viewer { lists(first: 100) { nodes { id name description items { totalCount } } } } } }'
    $lists = $result.data.viewer.lists.nodes
    if ($lists.Count -eq 0) {
        Write-Host "You have no lists yet." -ForegroundColor Yellow
        Write-Host "Create one with: .\github-lists.ps1 -Create" -ForegroundColor Cyan
    } else {
        Write-Host "Found $($lists.Count) list(s):" -ForegroundColor Green
        foreach ($l in $lists) {
            Write-Host "  $($l.name) ($($l.items.totalCount) repos)" -ForegroundColor White
            Write-Host "    ID: $($l.id)" -ForegroundColor Gray
            if ($l.description) { Write-Host "    $($l.description)" -ForegroundColor DarkGray }
        }
    }
}

if ($AddRepo) {
    if (-not $ListId -or -not $Owner -or -not $Repo) {
        Write-Error "Usage: .\github-lists.ps1 -AddRepo -ListId 'ID' -Owner 'owner' -Repo 'repo'"
        exit 1
    }
    Write-Host "Adding $Owner/$Repo..." -ForegroundColor Cyan
    $repoResult = gql "{ repository(owner: `"$Owner`", name: `"$Repo`") { id } }"
    $repoId = $repoResult.data.repository.id
    $addResult = gql "mutation { addListItems(input: {listId: `"$ListId`", itemIds: [`"$repoId`"]}) { list { id name } } }"
    Write-Host "Added successfully!" -ForegroundColor Green
}

if (-not $Create -and -not $List -and -not $AddRepo) {
    Write-Host "Usage:" -ForegroundColor White
    Write-Host "  .\github-lists.ps1 -Create" -ForegroundColor Cyan
    Write-Host "  .\github-lists.ps1 -Create -Name 'My List'" -ForegroundColor Cyan
    Write-Host "  .\github-lists.ps1 -List" -ForegroundColor Cyan
    Write-Host "  .\github-lists.ps1 -AddRepo -ListId 'ID' -Owner 'o' -Repo 'r'" -ForegroundColor Cyan
}
