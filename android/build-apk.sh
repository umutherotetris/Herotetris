#!/usr/bin/env bash
set -euo pipefail
umask 077

android_src=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=$(dirname "$android_src")
apk_out="${1:-$(dirname "$repo")/Hero-Portal-v162.apk}"
sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
sdk_jar="${ANDROID_JAR:-$sdk/platforms/android-36/android.jar}"
tools="${ANDROID_BUILD_TOOLS:-$sdk/build-tools/36.0.0}"

: "${HERO_KEYSTORE:?Set HERO_KEYSTORE to the private PKCS12 keystore path}"
: "${HERO_KEYPASS_FILE:?Set HERO_KEYPASS_FILE to a private file containing the keystore passphrase}"
alias_name="${HERO_KEY_ALIAS:-hero-portal}"
test -r "$HERO_KEYSTORE" && test -r "$HERO_KEYPASS_FILE" && test -r "$sdk_jar"
for tool in aapt2 d8 zipalign apksigner; do test -x "$tools/$tool"; done

work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/generated" "$work/classes" "$work/dex" "$work/res/mipmap-xxxhdpi"
cp -R -- "$android_src/res/." "$work/res/"
cp -- "$repo/assets/hero-icon-192-v158.png" "$work/res/mipmap-xxxhdpi/hero_portal.png"

"$tools/aapt2" compile --dir "$work/res" -o "$work/resources.zip"
"$tools/aapt2" link -o "$work/unsigned.apk" --manifest "$android_src/AndroidManifest.xml" \
    -I "$sdk_jar" --java "$work/generated" "$work/resources.zip"
source_path="$android_src/src/tr/heroyun/portal/PortalActivity.java"
resource_java="$work/generated/tr/heroyun/portal/R.java"
if [[ -n "${HERO_ECJ_JAR:-}" ]]; then
    java -jar "$HERO_ECJ_JAR" -1.8 -proc:none -encoding UTF-8 -bootclasspath "$sdk_jar" \
        -d "$work/classes" "$resource_java" "$source_path"
else
    javac -source 8 -target 8 -encoding UTF-8 -bootclasspath "$sdk_jar" \
        -d "$work/classes" "$resource_java" "$source_path"
fi
(
    cd "$work/classes"
    zip -qr "$work/classes.jar" .
)
"$tools/d8" --min-api 23 --lib "$sdk_jar" --output "$work/dex" "$work/classes.jar"
(
    cd "$work/dex"
    zip -q -0 "$work/unsigned.apk" classes.dex
)
"$tools/zipalign" -f -p 4 "$work/unsigned.apk" "$work/aligned.apk"
"$tools/apksigner" sign --ks "$HERO_KEYSTORE" --ks-type PKCS12 --ks-key-alias "$alias_name" \
    --ks-pass "file:$HERO_KEYPASS_FILE" \
    --out "$work/signed.apk" "$work/aligned.apk"
"$tools/apksigner" verify --verbose --print-certs "$work/signed.apk"
"$tools/zipalign" -c -p 4 "$work/signed.apk"
"$tools/aapt2" dump badging "$work/signed.apk"
install -m 644 -- "$work/signed.apk" "$apk_out"
sha256sum -- "$apk_out"
