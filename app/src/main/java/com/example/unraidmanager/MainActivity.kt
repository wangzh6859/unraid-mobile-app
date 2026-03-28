package com.example.unraidmanager

import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.jcraft.jsch.JSch
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Properties

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()

        // 🛡️ 加入防闪退保护：如果加载界面出错，会被这里捕获
        try {
            setContentView(R.layout.activity_main)

            val bottomNav = findViewById<BottomNavigationView>(R.id.bottom_nav)
            if (bottomNav == null) {
                Toast.makeText(this, "错误: 找不到底部导航栏，请检查 activity_main.xml", Toast.LENGTH_LONG).show()
                return
            }

            if (savedInstanceState == null) {
                supportFragmentManager.beginTransaction()
                    .replace(R.id.fragment_container, HomeFragment())
                    .commit()
            }

            bottomNav.setOnItemSelectedListener { item ->
                val selectedFragment: Fragment = when (item.itemId) {
                    R.id.nav_home -> HomeFragment()
                    R.id.nav_files -> PlaceholderFragment("文件管理页面\n(建设中...)")
                    R.id.nav_media -> PlaceholderFragment("影音中心页面\n(建设中...)")
                    R.id.nav_settings -> PlaceholderFragment("系统设置页面\n(建设中...)")
                    else -> HomeFragment()
                }
                supportFragmentManager.beginTransaction()
                    .replace(R.id.fragment_container, selectedFragment)
                    .commit()
                true
            }
        } catch (e: Exception) {
            // 🛡️ 发生任何崩溃都会变成提示弹窗
            Toast.makeText(this, "主界面加载崩溃: ${e.message}", Toast.LENGTH_LONG).show()
            Log.e("MainActivity", "Error", e)
        }
    }
}

// ==========================================
// 首页逻辑
// ==========================================
class HomeFragment : Fragment() {
    private var host = ""
    private var user = ""
    private var password = ""

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
        // 🛡️ 防闪退保护：检查布局文件是否正确
        return try {
            inflater.inflate(R.layout.fragment_home, container, false)
        } catch (e: Exception) {
            Toast.makeText(context, "加载首页布局失败: ${e.message}", Toast.LENGTH_LONG).show()
            null
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        try {
            val sharedPref = requireActivity().getSharedPreferences("UnraidPrefs", Context.MODE_PRIVATE)
            host = sharedPref.getString("HOST", "") ?: ""
            user = sharedPref.getString("USER", "") ?: ""
            password = sharedPref.getString("PASSWORD", "") ?: ""

            val tvUptime = view.findViewById<TextView>(R.id.tvUptime)
            val tvCpu = view.findViewById<TextView>(R.id.tvCpu)
            val tvMem = view.findViewById<TextView>(R.id.tvMem)
            val btnRefresh = view.findViewById<Button>(R.id.btnRefresh)
            
            view.findViewById<Button>(R.id.btnDocker)?.setOnClickListener {
                Toast.makeText(context, "即将进入 Docker 管理页面", Toast.LENGTH_SHORT).show()
            }
            view.findViewById<Button>(R.id.btnVm)?.setOnClickListener {
                Toast.makeText(context, "即将进入 虚拟机 管理页面", Toast.LENGTH_SHORT).show()
            }

            btnRefresh?.setOnClickListener {
                if (host.isEmpty()) {
                    Toast.makeText(context, "未找到服务器配置，请重新登录", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }

                btnRefresh.text = "正在获取..."
                btnRefresh.isEnabled = false

                CoroutineScope(Dispatchers.IO).launch {
                    val uptime = executeSshCommand("uptime -p").replace("up", "运行时间:").trim()
                    val cpuRaw = executeSshCommand("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'").trim()
                    val memRaw = executeSshCommand("free -m | awk 'NR==2{printf \"%.0f\", $3*100/$2 }'").trim()

                    withContext(Dispatchers.Main) {
                        tvUptime?.text = uptime
                        tvCpu?.text = "${cpuRaw.toFloatOrNull()?.toInt() ?: 0}%"
                        tvMem?.text = "${memRaw.toFloatOrNull()?.toInt() ?: 0}%"
                        btnRefresh.text = "刷新数据"
                        btnRefresh.isEnabled = true
                    }
                }
            }
        } catch (e: Exception) {
            Toast.makeText(context, "首页代码运行错误: ${e.message}", Toast.LENGTH_LONG).show()
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
            "Error: ${e.message}"
        }
    }
}

// ==========================================
// 占位页面
// ==========================================
class PlaceholderFragment(private val text: String) : Fragment() {
    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return TextView(context).apply {
            this.text = this@PlaceholderFragment.text
            textSize = 24f
            setTextColor(Color.GRAY)
            gravity = Gravity.CENTER
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
    }
}