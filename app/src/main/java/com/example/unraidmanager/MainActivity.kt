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

            val swipeRefresh = view.findViewById<androidx.swiperefreshlayout.widget.SwipeRefreshLayout>(R.id.swipeRefresh)
            val tvUptime = view.findViewById<TextView>(R.id.tvUptime)
            val tvCpu = view.findViewById<TextView>(R.id.tvCpu)
            val tvMem = view.findViewById<TextView>(R.id.tvMem)
            val statusDot = view.findViewById<View>(R.id.statusDot)
            
            view.findViewById<Button>(R.id.btnDocker)?.setOnClickListener {
                Toast.makeText(context, "即将进入 Docker 管理页面", Toast.LENGTH_SHORT).show()
            }
            view.findViewById<Button>(R.id.btnVm)?.setOnClickListener {
                Toast.makeText(context, "即将进入 虚拟机 管理页面", Toast.LENGTH_SHORT).show()
            }

            // 提取出的获取数据逻辑函数
            fun fetchServerData() {
                if (host.isEmpty()) {
                    Toast.makeText(context, "未找到服务器配置", Toast.LENGTH_SHORT).show()
                    swipeRefresh.isRefreshing = false
                    return
                }

                // 刷新时，指示灯变成灰色
                statusDot.background.setTint(Color.parseColor("#E0E0E0"))

                CoroutineScope(Dispatchers.IO).launch {
                    val uptimeResult = executeSshCommand("uptime -p")
                    
                    // 如果返回的结果以 Error 开头，说明连接失败
                    val isSuccess = !uptimeResult.startsWith("Error")
                    
                    val uptime = if (isSuccess) uptimeResult.replace("up", "运行时间:").trim() else "连接失败"
                    val cpuRaw = if (isSuccess) executeSshCommand("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'").trim() else "--"
                    val memRaw = if (isSuccess) executeSshCommand("free -m | awk 'NR==2{printf \"%.0f\", $3*100/$2 }'").trim() else "--"

                    withContext(Dispatchers.Main) {
                        tvUptime?.text = uptime
                        tvCpu?.text = if (isSuccess) "${cpuRaw.toFloatOrNull()?.toInt() ?: 0}%" else "--%"
                        tvMem?.text = if (isSuccess) "${memRaw.toFloatOrNull()?.toInt() ?: 0}%" else "--%"
                        
                        // 🌟 核心：成功变绿灯，失败变红灯
                        if (isSuccess) {
                            statusDot.background.setTint(Color.parseColor("#4CAF50")) // 绿色
                        } else {
                            statusDot.background.setTint(Color.parseColor("#F44336")) // 红色
                            Toast.makeText(context, uptimeResult, Toast.LENGTH_LONG).show() // 弹出具体报错
                        }
                        
                        // 停止下拉刷新的转圈动画
                        swipeRefresh.isRefreshing = false
                    }
                }
            }

            // 监听下拉动作
            swipeRefresh.setOnRefreshListener {
                fetchServerData()
            }

            // 页面刚打开时，自动触发一次刷新
            swipeRefresh.isRefreshing = true
            fetchServerData()

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