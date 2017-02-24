#!/bin/bash

wget -P /tmp/ https://raw.githubusercontent.com/uppik/uppik-js/master/src/uppik.js

curl -X POST --data-urlencode 'input@/tmp/uppik.js' https://javascript-minifier.com/raw > /tmp/uppik.min.js -v

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
mv /tmp/uppik.min.js $DIR/../lastest/
