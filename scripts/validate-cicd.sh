#!/bin/sh

echo "validate-cicd.sh is retired: it validates obsolete workflows and may mutate the workspace."
echo "Use npm run quality:fast for local feedback, npm run quality:full for certification,"
echo "or npm run quality:release for package conformance."
exit 2
