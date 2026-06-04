#!/usr/bin/env bash
# GitHub List Manager
# Usage:
#   ./github-lists.sh create "AI & ML Tools"
#   ./github-lists.sh list
#   ./github-lists.sh add LIST_ID owner/repo

set -e

GH_TOKEN=$(gh auth token 2>/dev/null || true)
if [ -z "$GH_TOKEN" ]; then
    echo "❌ No GitHub token found. Run: gh auth login"
    exit 1
fi

GRAPHQL_API="https://api.github.com/graphql"

gql() {
    curl -s -X POST "$GRAPHQL_API" \
        -H "Authorization: Bearer $GH_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$1"
}

create_list() {
    NAME="${1:-AI & ML Tools}"
    DESC="${2:-Machine learning, deep learning, and AI-powered tools and frameworks}"
    
    echo "📝 Creating list: '$NAME'..."
    
    QUERY="{\"query\":\"mutation { createUserList(input: {name: \\\"$NAME\\\", description: \\\"$DESC\\\"}) { list { id name description isPublic } } }\"}"
    
    RESULT=$(gql "$QUERY")
    
    if echo "$RESULT" | grep -q "INSUFFICIENT_SCOPES"; then
        echo "❌ Your token is missing the 'user' scope."
        echo ""
        echo "Run this command:"
        echo "  gh auth refresh -h github.com -s user"
        echo ""
        echo "Then follow the browser flow at https://github.com/login/device"
        exit 1
    fi
    
    if echo "$RESULT" | grep -q '"errors"'; then
        echo "❌ Error: $(echo "$RESULT" | grep -o '"message":"[^"]*"' | head -1)"
        exit 1
    fi
    
    LIST_ID=$(echo "$RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    LIST_NAME=$(echo "$RESULT" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    echo "✅ Created successfully!"
    echo "   Name: $LIST_NAME"
    echo "   ID: $LIST_ID"
    echo ""
    echo "To add a repository:"
    echo "  ./github-lists.sh add $LIST_ID owner/repo-name"
}

list_lists() {
    echo "📋 Fetching your lists..."
    
    QUERY='{"query":"{ viewer { lists(first: 100) { nodes { id name description items { totalCount } } } } }"}'
    RESULT=$(gql "$QUERY")
    
    if echo "$RESULT" | grep -q "INSUFFICIENT_SCOPES"; then
        echo "❌ Missing 'user' scope. Run: gh auth refresh -h github.com -s user"
        exit 1
    fi
    
    # Parse and display lists
    echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
lists = data.get('data', {}).get('viewer', {}).get('lists', {}).get('nodes', [])
if not lists:
    print('You have no lists yet.')
    print('Create one with: ./github-lists.sh create')
else:
    print(f'Found {len(lists)} list(s):')
    for l in lists:
        print(f\"  {l['name']} ({l['items']['totalCount']} repos)\")
        print(f\"    ID: {l['id']}\")
        if l.get('description'):
            print(f\"    {l['description']}\")
" 2>/dev/null || echo "$RESULT"
}

add_repo() {
    LIST_ID="$1"
    REPO="$2"
    OWNER=$(echo "$REPO" | cut -d'/' -f1)
    NAME=$(echo "$REPO" | cut -d'/' -f2)
    
    echo "➕ Adding $OWNER/$NAME to list..."
    
    # Get repo node ID
    REPO_QUERY="{\"query\":\"{ repository(owner: \\\"$OWNER\\\", name: \\\"$NAME\\\") { id } }\"}"
    REPO_RESULT=$(gql "$REPO_QUERY")
    REPO_ID=$(echo "$REPO_RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -z "$REPO_ID" ]; then
        echo "❌ Repository not found: $OWNER/$NAME"
        exit 1
    fi
    
    ADD_QUERY="{\"query\":\"mutation { addListItems(input: {listId: \\\"$LIST_ID\\\", itemIds: [\\\"$REPO_ID\\\"]}) { list { id name } } }\"}"
    RESULT=$(gql "$ADD_QUERY")
    
    if echo "$RESULT" | grep -q '"errors"'; then
        echo "❌ Error adding repository"
        exit 1
    fi
    
    echo "✅ Added $OWNER/$NAME successfully!"
}

# Main
case "${1:-}" in
    create)
        create_list "${2:-}" "${3:-}"
        ;;
    list)
        list_lists
        ;;
    add)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: ./github-lists.sh add LIST_ID owner/repo"
            exit 1
        fi
        add_repo "$2" "$3"
        ;;
    *)
        echo "GitHub List Manager"
        echo ""
        echo "Usage:"
        echo "  ./github-lists.sh create [\"List Name\"] [\"Description\"]  # Create a new list"
        echo "  ./github-lists.sh list                                      # Show all your lists"
        echo "  ./github-lists.sh add LIST_ID owner/repo                  # Add repo to list"
        echo ""
        echo "Examples:"
        echo "  ./github-lists.sh create \"AI & ML Tools\""
        echo "  ./github-lists.sh list"
        echo "  ./github-lists.sh add YOUR_LIST_ID huseinzol05/Stock-Prediction-Models"
        ;;
esac
