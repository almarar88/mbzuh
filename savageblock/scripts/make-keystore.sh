#!/usr/bin/env bash
# Generates the permanent upload keystore for SavageBlock and prints the values to paste
# into GitHub Actions secrets. Run once; keep the .jks somewhere safe outside the repo.
set -euo pipefail

OUT="${1:-savageblock-upload.jks}"
ALIAS="savageblock"

if [ -f "$OUT" ]; then
  echo "❌ $OUT موجود مسبقًا. احذفه أو مرّر اسمًا آخر." >&2
  exit 1
fi

read -r -s -p "كلمة مرور المخزن (store password): " STORE_PASS; echo
read -r -s -p "كلمة مرور المفتاح (key password, اضغط Enter لاستخدام نفس السابقة): " KEY_PASS; echo
KEY_PASS="${KEY_PASS:-$STORE_PASS}"

keytool -genkeypair -v \
  -keystore "$OUT" -storetype PKCS12 \
  -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$STORE_PASS" -keypass "$KEY_PASS" \
  -dname "CN=SavageBlock, OU=Alcode, O=Alcode, C=SA"

echo
echo "✅ تم إنشاء $OUT"
echo
echo "أضف هذه الأسرار في GitHub → Settings → Secrets and variables → Actions:"
echo "  SAVAGEBLOCK_KEY_ALIAS      = $ALIAS"
echo "  SAVAGEBLOCK_STORE_PASS     = (كلمة مرور المخزن)"
echo "  SAVAGEBLOCK_KEY_PASS       = (كلمة مرور المفتاح)"
echo "  SAVAGEBLOCK_KEYSTORE_BASE64 = (السطر التالي بالكامل)"
echo
base64 -w0 "$OUT" 2>/dev/null || base64 "$OUT" | tr -d '\n'
echo
echo
echo "⚠️  لا ترفع $OUT إلى المستودع. أضفه إلى .gitignore (موجود مسبقًا: *.jks)."
