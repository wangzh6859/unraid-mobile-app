[app]

# (str) 应用标题
title = UnraidManager

# (str) 包名 (与签名绑定，请勿随意修改以保证覆盖安装)
package.name = unraidapp

# (str) 域名
package.domain = org.auto.dev

# (str) 源代码所在目录
source.dir = .

# (list) 包含的文件扩展名
source.include_exts = py,png,jpg,kv,atlas

# (str) 应用版本 (此处由 GitHub Action 脚本自动改写，保持默认即可)
version = 1.0.1

# (list) 应用依赖 (核心：Python3, Kivy, KivyMD 以及网络请求库)
requirements = python3,kivy==2.2.1,kivymd==1.1.1,requests,urllib3,charset-normalizer,idna,openssl

# (str) 支持的屏幕方向 (landscape, portrait 或 all)
orientation = portrait

# (bool) 是否全屏
fullscreen = 0

# =================================================
# Android 配置
# =================================================

# (int) Android API 级别 (通常 31-33 比较稳定)
android.api = 31

# (int) 最低支持的 Android 版本
android.minapi = 21

# (int) Android SDK 版本
android.sdk = 31

# (str) Android NDK 版本
android.ndk = 25b

# (bool) 是否跳过更新检查
android.skip_update = False

# (bool) 是否接受 SDK 许可证
android.accept_sdk_license = True

# (str) 架构 (先只打 64 位，提高成功率并减小体积)
android.archs = arm64-v8a

# (str) 签名文件路径 (对应 Action 脚本生成的文件名)
android.keystore = ./my.keystore

# (str) 签名文件密码 (需与 Action 脚本一致)
android.keystore_password = permanent_password_123

# (str) 别名
android.keyalias = unraid_alias

# (str) 别名密码
android.keyalias_password = permanent_password_123

# (list) 权限
android.permissions = INTERNET, WRITE_EXTERNAL_STORAGE

# =================================================
# 打包器配置
# =================================================

[buildozer]

# (int) 日志级别 (0 = 错误, 1 = 信息, 2 = 调试)
log_level = 2

# (int) 是否在报错时停止
warn_on_root = 1

# (str) 临时目录
# build_dir = ./.buildozer

# (str) 输出目录 (APK 存放位置)
bin_dir = ./bin