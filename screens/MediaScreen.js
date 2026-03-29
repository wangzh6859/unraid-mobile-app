import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Film, Save, RefreshCw, Home } from 'lucide-react-native';

// 注意：这里引入了 navigation，用于悬浮球的返回功能
export default function MediaScreen({ navigation }) {
  const [mediaUrl, setMediaUrl] = useState(null);
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const guessEmbyUrl = (unraidUrl) => {
    if (!unraidUrl) return '';
    const isIp = /^https?:\/\/\d{1,3}(\.\d{1,3}){3}/.test(unraidUrl);
    if (isIp) {
      return unraidUrl.replace(/:\d+$/, ':8096');
    } else {
      return unraidUrl.replace(/^(https?:\/\/)([^.:\/]+)/, '$1emby');
    }
  };

  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const savedMediaUrl = await AsyncStorage.getItem('@media_url');
        if (savedMediaUrl) {
          setMediaUrl(savedMediaUrl);
        } else {
          const savedUnraidUrl = await AsyncStorage.getItem('@server_url');
          if (savedUnraidUrl) setInputUrl(guessEmbyUrl(savedUnraidUrl));
        }
      } catch (e) {
        console.log('读取地址失败', e);
      } finally {
        setIsLoading(false);
      }
    };
    initializeMedia();
  }, []);

  const handleSaveUrl = async () => {
    if (!inputUrl) return;
    let cleanUrl = inputUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'http://' + cleanUrl;
    }
    try {
      await AsyncStorage.setItem('@media_url', cleanUrl);
      setMediaUrl(cleanUrl);
    } catch (e) { console.log('保存失败', e); }
  };

  const handleResetUrl = async () => {
    try {
      await AsyncStorage.removeItem('@media_url');
      setMediaUrl(null);
      const savedUnraidUrl = await AsyncStorage.getItem('@server_url');
      if (savedUnraidUrl) setInputUrl(guessEmbyUrl(savedUnraidUrl));
    } catch (e) { console.log('重置失败', e); }
  };

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#f59e0b" /></View>;

  // --- 引导配置页保持不变 ---
  if (!mediaUrl) {
    return (
      <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.setupCard}>
          <Film color="#f59e0b" size={48} style={{ alignSelf: 'center', marginBottom: 16 }} />
          <Text style={styles.setupTitle}>私人影音库</Text>
          <Text style={styles.setupSub}>已根据您的 Unraid 地址自动推算出 Emby 地址，请确认：</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="例如: https://emby.bbb.ccc:123"
              placeholderTextColor="#6b7280"
              value={inputUrl}
              onChangeText={setInputUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveUrl}>
            <Save color="#ffffff" size={20} />
            <Text style={styles.saveBtnText}>进入全屏影院</Text>
          </TouchableOpacity>
        </View>
        
        {/* 配置页也需要一个返回按钮，因为底部 Tab 没了 */}
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.navigate('首页')}>
          <Text style={styles.cancelBtnText}>暂不配置，返回首页</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  // --- 全屏无边框 WebView 模式 ---
  return (
    <View style={styles.webViewContainer}>
      {/* 核心：网页无缝内嵌，为了沉浸感去掉所有 Padding */}
      <WebView 
        source={{ uri: mediaUrl }} 
        style={styles.webView}
        showsVerticalScrollIndicator={false}
        startInLoadingState={true}
        renderLoading={() => <View style={styles.webViewLoader}><ActivityIndicator size="large" color="#f59e0b" /></View>}
      />

      {/* 绝对定位的磨砂半透明悬浮球 (FAB) */}
      <View style={styles.fabContainer}>
        {/* 返回首页悬浮球 */}
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('首页')}>
          <Home color="#ffffff" size={20} />
        </TouchableOpacity>
        
        {/* 重新配置悬浮球 */}
        <TouchableOpacity style={styles.fab} onPress={handleResetUrl}>
          <RefreshCw color="#ffffff" size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', padding: 20 },
  setupCard: { backgroundColor: '#1f2937', borderRadius: 16, padding: 24, elevation: 5 },
  setupTitle: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  setupSub: { color: '#9ca3af', fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  inputContainer: { backgroundColor: '#374151', borderRadius: 8, marginBottom: 20, paddingHorizontal: 12 },
  input: { color: '#ffffff', height: 50, fontSize: 16 },
  saveBtn: { flexDirection: 'row', backgroundColor: '#f59e0b', height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
  cancelBtn: { marginTop: 20, alignSelf: 'center', padding: 10 },
  cancelBtnText: { color: '#9ca3af', fontSize: 14 },
  
  // WebView 全屏样式
  webViewContainer: { flex: 1, backgroundColor: '#000000' },
  webView: { flex: 1, backgroundColor: '#000000', marginTop: Platform.OS === 'ios' ? 40 : 20 }, // 给系统状态栏留一点安全距离
  webViewLoader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },

  // 悬浮球群组样式
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 120, // 距离底部 120px，完美避开 Emby 的原生底栏
    alignItems: 'center',
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(31, 41, 55, 0.7)', // 极客风的半透明磨砂黑
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  }
});