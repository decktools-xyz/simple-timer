sudo pnpm run build

# TOKEN=$(curl -s http://127.0.0.1:1337/auth/token)
# wscat -c "ws://127.0.0.1:1337/ws?auth=$TOKEN" -x '{"type":0,"route":"loader/reload_plugin","args":["Simple Timer"],"id":10000}'
