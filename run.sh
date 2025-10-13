export PORT=3000
export WINCC_URL=https://WINCCV81SRV1:34568/WinccRestService
export WINCC_USR=system
export WINCC_PWD=manager
export WINCC_SKIP_CERTIFICATE_VALIDATION=true
export WINCC_ALLOW_ORIGIN='*'
export NODE_TLS_REJECT_UNAUTHORIZED=0

node index.js
