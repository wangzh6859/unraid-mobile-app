from kivymd.app import MDApp
from kivymd.uix.screen import MDScreen
from kivymd.uix.bottomnavigation import MDBottomNavigation, MDBottomNavigationItem
from kivymd.uix.label import MDLabel
import requests # 用于获取 Unraid 数据

class UnraidApp(MDApp):
    def build(self):
        self.theme_cls.primary_palette = "DeepOrange"
        
        # 基础布局：包含底部导航
        screen = MDScreen()
        nav = MDBottomNavigation()

        # 1. 首页 (Dashboard)
        item1 = MDBottomNavigationItem(name='home', text='首页', icon='home')
        item1.add_widget(MDLabel(text="CPU: 15% \n内存: 4GB/16GB", halign="center"))
        
        # 2. 文件 (Files)
        item2 = MDBottomNavigationItem(name='files', text='文件', icon='file-tree')
        item2.add_widget(MDLabel(text="文件列表加载中...", halign="center"))

        # 3. 影音 (Media)
        item3 = MDBottomNavigationItem(name='media', text='影音', icon='play-circle')
        item3.add_widget(MDLabel(text="Plex / Emby 快捷方式", halign="center"))

        # 4. 设置 (Settings)
        item4 = MDBottomNavigationItem(name='settings', text='设置', icon='cog')
        item4.add_widget(MDLabel(text="服务器 IP 地址设置", halign="center"))

        nav.add_widget(item1)
        nav.add_widget(item2)
        nav.add_widget(item3)
        nav.add_widget(item4)
        screen.add_widget(nav)
        return screen

if __name__ == '__main__':
    UnraidApp().run()
