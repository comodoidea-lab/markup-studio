#!/bin/zsh
cd "$(dirname "$0")"
echo "Markup is running at http://127.0.0.1:4173"
python3 server.py
