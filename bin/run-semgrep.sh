#!/usr/bin/env bash

export SEMGREP_RULES="
p/default
p/javascript
p/typescript
p/nodejs
p/comment
p/cwe-top-25
p/r2c-security-audit
p/owasp-top-ten
p/gitleaks
p/secrets
"

semgrep scan --error --metrics off