package com.example.unraidmanager

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class LoginActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide() // 隐藏顶部栏

        // 打开本地配置读取器
        val sharedPref = getSharedPreferences("UnraidPrefs", Context.MODE_PRIVATE)
        val savedHost = sharedPref.getString("HOST", "")

        // 【核心逻辑】：如果之前已经存过 IP 了，直接跳过登录页，进入主界面！
        if (!savedHost.isNullOrEmpty()) {
            startActivity(Intent(this, MainActivity::class.java))
            finish() // 关掉当前登录页
            return
        }

        setContentView(R.layout.activity_login)

        val etHost = findViewById<EditText>(R.id.etHost)
        val etUser = findViewById<EditText>(R.id.etUser)
        val etPassword = findViewById<EditText>(R.id.etPassword)
        val btnLogin = findViewById<Button>(R.id.btnLogin)

        btnLogin.setOnClickListener {
            val host = etHost.text.toString().trim()
            val user = etUser.text.toString().trim()
            val password = etPassword.text.toString().trim()

            // 检查是不是有没有填写的项
            if (host.isEmpty() || user.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "请完整填写所有信息", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // 把输入的信息存到本地手机里
            sharedPref.edit().apply {
                putString("HOST", host)
                putString("USER", user)
                putString("PASSWORD", password)
                apply() // 异步保存
            }

            // 保存成功后，跳转到主界面
            Toast.makeText(this, "配置已保存", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }
}