name: Auto Build and Release

on:
  push:
    branches: [ main ] # 只要推送到 main 分支就触发

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0 # 获取所有历史记录以读取标签

      # --- 1. 自动计算下一个版本号 ---
      - name: Determine Next Version
        id: next_version
        run: |
          # 获取最新的 tag，如果没有则默认为 v1.0.0
          LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v1.0.0")
          echo "当前版本: $LATEST_TAG"
          
          # 提取数字部分并加 1 (例如 v1.0.5 -> 5 + 1 = 6)
          VERSION_FIX=$(echo $LATEST_TAG | cut -d. -f3)
          NEXT_FIX=$((VERSION_FIX + 1))
          NEXT_TAG="$(echo $LATEST_TAG | cut -d. -f1,2).$NEXT_FIX"
          
          echo "新版本: $NEXT_TAG"
          echo "tag=$NEXT_TAG" >> $GITHUB_OUTPUT

      # --- 2. 恢复或生成签名 (保持固定) ---
      - name: Restore Keystore Cache
        id: cache-keystore
        uses: actions/cache@v3
        with:
          path: my.keystore
          key: keystore-permanent-v1

      - name: Generate Keystore if not exists
        if: steps.cache-keystore.outputs.cache-hit != 'true'
        run: |
          keytool -genkey -noprompt -keystore my.keystore -alias unraid_alias \
          -storepass "secret_pass_123" -keypass "secret_pass_123" \
          -dname "CN=UnraidApp" -keyalg RSA -keysize 2048 -validity 10000

      # --- 3. 编译 APK ---
      - name: Build with Buildozer
        uses: ArtemSerebrennkov/buildozer-action@v1
        with:
          command: buildozer android release
        env:
          VERSION: ${{ steps.next_version.outputs.tag }}
          ANDROID_KEYSTORE_PASSWORD: "secret_pass_123"
          ANDROID_KEY_ALIAS: "unraid_alias"
          ANDROID_KEY_PASSWORD: "secret_pass_123"

      # --- 4. 自动创建 Release 并推送新 Tag ---
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: bin/*.apk
          tag_name: ${{ steps.next_version.outputs.tag }}
          name: Release ${{ steps.next_version.outputs.tag }}
          body: "自动构建版本: ${{ steps.next_version.outputs.tag }}"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}