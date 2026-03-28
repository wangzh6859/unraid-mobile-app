from kivymd.app import MDApp
from kivymd.uix.screen import MDScreen
from kivymd.uix.bottomnavigation import MDBottomNavigation, MDBottomNavigationItem
from kivymd.uix.label import MDLabel
from kivymd.uix.boxlayout import MDBoxLayout

class UnraidApp(MDApp):
    def build(self):
        self.theme_cls.primary_palette = "BlueGray"
        self.theme_cls.theme_style = "Dark"
        
        screen = MDScreen()
        nav = MDBottomNavigation()

        # 首页
        item1 = MDBottomNavigationItem(name='home', text='首页', icon='home')
        layout1 = MDBoxLayout(orientation='vertical', padding=20)
        layout1.add_widget(MDLabel(text="Unraid 监控中心", halign="center", font_style="H4"))
        layout1.add_widget(MDLabel(text="正在连接服务器...", halign="center"))
        item1.add_widget(layout1)
        
        # 文件
        item2 = MDBottomNavigationItem(name='files', text='文件', icon='file-tree')
        item2.add_widget(MDLabel(text="文件管理（开发中）", halign="center"))

        # 影音
        item3 = MDBottomNavigationItem(name='media', text='影音', icon='play-circle')
        item3.add_widget(MDLabel(text="影音控制（开发中）", halign="center"))

        # 设置
        item4 = MDBottomNavigationItem(name='settings', text='设置', icon='cog')
        item4.add_widget(MDLabel(text="配置服务器 IP", halign="center"))

        nav.add_widget(item1)
        nav.add_widget(item2)
        nav.add_widget(item3)
        nav.add_widget(item4)
        screen.add_widget(nav)
        return screen

if __name__ == '__main__':
    UnraidApp().run()