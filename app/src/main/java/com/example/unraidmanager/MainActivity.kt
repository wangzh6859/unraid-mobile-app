package com.example.unraidmanager

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.jcraft.jsch.JSch
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Properties

class MainActivity : AppCompatActivity() {
    // ==========================================
    // 配置区域：请在这里填入你 Unraid 服务器的真实信息
    // ==========================================
    private val host = "192.168.1.100"  // 你的 Unraid IP
    private val user = "root"           // 默认用户名
    private val password = "your_password" // 你的密码

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val btnRefresh = findViewById<Button>(R.id.btnRefresh)
        val tvStatus = findViewById<TextView>(R.id.tvStatus)

        btnRefresh.setOnClickListener {
            tvStatus.text = "正在连接服务器..."
            btnRefresh.isEnabled = false

            // 使用 Kotlin 协程在后台线程执行网络请求，防止界面卡死
            CoroutineScope(Dispatchers.IO).launch {
                // 执行获取运行时间和内存的 Linux 命令
                val result = executeSshCommand("uptime -p\necho '---'\nfree -m | grep Mem")
                
                // 切换回主线程更新界面 UI
                withContext(Dispatchers.Main) {
                    tvStatus.text = result
                    btnRefresh.isEnabled = true
                }
            }
        }
    }

    private fun executeSshCommand(command: String): String {
        return try {
            val jsch = JSch()
            val session = jsch.getSession(user, host, 22)
            session.setPassword(password)
            
            // 忽略未知的 SSH 密钥警告
            val config = Properties()
            config.put("StrictHostKeyChecking", "no")
            session.setConfig(config)
            session.connect(5000) // 5秒超时

            // 打开执行命令的通道
            val channel = session.openChannel("exec") as com.jcraft.jsch.ChannelExec
            channel.setCommand(command)
            val inStream = channel.inputStream
            channel.connect()

            // 读取服务器返回的结果
            val reader = inStream.bufferedReader()
            val output = reader.readText()

            channel.disconnect()
            session.disconnect()

            "✅ 连接成功！\n\n$output"
        } catch (e: Exception) {
            "❌ 连接失败:\n${e.message}"
        }
    }
}