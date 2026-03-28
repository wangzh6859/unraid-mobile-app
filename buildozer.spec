[app]
title = UnraidManager
package.name = UNRAID
package.domain = org.auto.dev
source.dir = .
# 这里的 VERSION 对应上面 Action 里的 env.VERSION
version = %(VERSION)s

android.keystore = ./my.keystore
android.keystore_password = secret_pass_123
android.keyalias = unraid_alias
android.keyalias_password = secret_pass_123