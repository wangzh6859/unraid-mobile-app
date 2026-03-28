package com.example.unraidmanager

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.progressindicator.CircularProgressIndicator
import com.jcraft.jsch.JSch
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Properties

class MainActivity : AppCompatActivity() {
    // ==========================================
    // 请再次确认你的 Unraid 账号密码
    // ==========================================
    private val host = "192.168.1.100"  // 你的 IP
    private val user = "root"           // 你的用户名
    private val password = "your_password" // 你的密码

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 隐藏顶部默认的丑陋导航栏
        supportActionBar?.hide() 
        setContentView(R.layout.activity_main)

        val btnRefresh = findViewById<Button>(R.id.btnRefresh)
        val tvUptime = findViewById<TextView>(R.id.tvUptime)
        
        val progressCpu = findViewById<CircularProgressIndicator>(R.id.progressCpu)
        val tvCpuPercent = findViewById<TextView>(R.id.tvCpuPercent)
        
        val progressMem = findViewById<CircularProgressIndicator>(R.id.progressMem)
        val tvMemPercent = findViewById<TextView>(R.id.tvMemPercent)

        btnRefresh.setOnClickListener {
            btnRefresh.text = "正在连接..."
            btnRefresh.isEnabled = false

            CoroutineScope(Dispatchers.IO).launch {
                // 1. 获取运行时间
                val uptime = executeSshCommand("uptime -p").replace("up", "运行时间:").trim()
                
                // 2. 尝试获取 CPU 负载 (这里用简单的 top 命令提取)
                val cpuRaw = executeSshCommand("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'").trim()
                val cpuValue = cpuRaw.toFloatOrNull()?.toInt() ?: 0

                // 3. 尝试获取内存使用率
                val memRaw = executeSshCommand("free -m | awk 'NR==2{printf \"%.2f\", $3*100/$2 }'").trim()
                val memValue = memRaw.toFloatOrNull()?.toInt() ?: 0

                // 切换回主线程更新漂亮的 UI
                withContext(Dispatchers.Main) {
                    tvUptime.text = uptime
                    
                    progressCpu.setProgressCompat(cpuValue, true)
                    tvCpuPercent.text = "$cpuValue%"
                    
                    progressMem.setProgressCompat(memValue, true)
                    tvMemPercent.text = "$memValue%"

                    btnRefresh.text = "点击获取实时数据"
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
            val config = Properties()
            config.put("StrictHostKeyChecking", "no")
            session.setConfig(config)
            session.connect(5000)

            val channel = session.openChannel("exec") as com.jcraft.jsch.ChannelExec
            channel.setCommand(command)
            val inStream = channel.inputStream
            channel.connect()

            val reader = inStream.bufferedReader()
            val output = reader.readText()

            channel.disconnect()
            session.disconnect()

            output
        } catch (e: Exception) {
            "Error"
        }
    }
}