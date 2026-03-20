#!/bin/bash
# Electron Protocol Manager for Marshall
# Manages per-worktree protocol registration (marshall-<branch>://)

set -e

LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
MARSHALL_WORKTREES_DIR="$HOME/.superset/worktrees/marshall"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get the protocol for the current worktree
get_current_protocol() {
    if [ -n "$BETTER_AUTH_ELECTRON_PROTOCOL" ]; then
        echo "$BETTER_AUTH_ELECTRON_PROTOCOL"
    else
        node "$SCRIPT_DIR/get-electron-protocol.mjs" 2>/dev/null || echo "marshall"
    fi
}

PROTOCOL="$(get_current_protocol)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
    echo "Electron Protocol Manager for Marshall"
    echo ""
    echo "Each worktree uses a unique protocol based on its git branch:"
    echo "  - Protected branches (main, master): marshall://"
    echo "  - Feature branches: marshall-<branch-slug>://"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  status    Show current protocol and running Electron processes"
    echo "  clean     Kill all Marshall Electron processes and unregister from Launch Services"
    echo "  register  Register current worktree's Electron as protocol handler"
    echo "  reset     Clean + register (recommended before starting dev)"
    echo "  help      Show this help message"
    echo ""
}

show_status() {
    echo -e "${BLUE}=== Marshall Protocol Status ===${NC}"
    echo ""

    # Show current worktree's protocol
    echo -e "${YELLOW}Current worktree protocol:${NC}"
    echo -e "  ${GREEN}${PROTOCOL}://${NC}"
    echo ""

    # Show running Electron processes
    echo -e "${YELLOW}Running Marshall Electron processes:${NC}"
    local procs=$(ps aux | grep -E "Electron.*marshall" | grep -v grep | grep -v "electron-protocol" || true)
    if [ -z "$procs" ]; then
        echo -e "  ${GREEN}None${NC}"
    else
        echo "$procs" | while read line; do
            # Extract worktree name from path
            worktree=$(echo "$line" | grep -oE "marshall/[^/]+/" | head -1 | sed 's/marshall\///' | sed 's/\///')
            pid=$(echo "$line" | awk '{print $2}')
            echo -e "  ${RED}PID $pid${NC}: $worktree"
        done
    fi
    echo ""

    # Show registered Electron apps
    echo -e "${YELLOW}Registered Marshall Electron apps in Launch Services:${NC}"
    local registered=$($LSREGISTER -dump 2>/dev/null | grep -E "path:.*marshall.*Electron\.app$" | grep -v "Helper" || true)
    if [ -z "$registered" ]; then
        echo -e "  ${GREEN}None${NC}"
    else
        echo "$registered" | while read line; do
            worktree=$(echo "$line" | grep -oE "marshall/[^/]+/" | head -1 | sed 's/marshall\///' | sed 's/\///')
            echo -e "  - $worktree"
        done
    fi
    echo ""
}

clean_all() {
    echo -e "${BLUE}=== Cleaning Marshall Electron Registrations ===${NC}"
    echo ""

    # Kill all Marshall Electron processes
    echo -e "${YELLOW}Killing Marshall Electron processes...${NC}"
    pkill -f "Electron.*marshall" 2>/dev/null || true
    pkill -f "electron-vite" 2>/dev/null || true
    pkill -f "@marshall" 2>/dev/null || true
    sleep 1
    echo -e "${GREEN}Done${NC}"
    echo ""

    # Unregister all Marshall Electron apps
    echo -e "${YELLOW}Unregistering Electron apps from Launch Services...${NC}"
    local count=0
    for path in $(find "$MARSHALL_WORKTREES_DIR" -name "Electron.app" -type d 2>/dev/null); do
        $LSREGISTER -u "$path" 2>/dev/null || true
        ((count++)) || true
    done

    # Also unregister any mounted DMGs
    for dmg in /Volumes/Marshall*/Marshall.app; do
        if [ -d "$dmg" ]; then
            $LSREGISTER -u "$dmg" 2>/dev/null || true
            ((count++)) || true
        fi
    done

    echo -e "${GREEN}Unregistered $count Electron apps${NC}"
    echo ""
}

register_current() {
    echo -e "${BLUE}=== Registering Current Worktree ===${NC}"
    echo ""

    # Find Electron.app in current directory or parent
    local electron_path=""
    local search_dir="$(pwd)"

    # Search up to 3 levels up
    for i in 1 2 3; do
        local candidate="$search_dir/node_modules/.bun/electron@30.5.1/node_modules/electron/dist/Electron.app"
        if [ -d "$candidate" ]; then
            electron_path="$candidate"
            break
        fi
        search_dir="$(dirname "$search_dir")"
    done

    if [ -z "$electron_path" ]; then
        echo -e "${RED}Error: Could not find Electron.app in current worktree${NC}"
        echo "Make sure you've run 'bun install' first."
        exit 1
    fi

    # Get worktree name
    local worktree=$(echo "$electron_path" | grep -oE "marshall/[^/]+/" | head -1 | sed 's/marshall\///' | sed 's/\///')

    echo -e "${YELLOW}Registering:${NC} $worktree"
    $LSREGISTER -f "$electron_path"
    echo -e "${GREEN}Done${NC}"
    echo ""
    echo -e "The ${BLUE}$PROTOCOL://${NC} protocol is now registered to this worktree."
    echo ""
}

reset_all() {
    clean_all
    register_current
    echo -e "${GREEN}Ready! Run 'bun run dev' to start the app.${NC}"
    echo -e "Protocol: ${BLUE}${PROTOCOL}://${NC}"
}

# Main
case "${1:-}" in
    status)
        show_status
        ;;
    clean)
        clean_all
        ;;
    register)
        register_current
        ;;
    reset)
        reset_all
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        show_help
        exit 1
        ;;
esac
