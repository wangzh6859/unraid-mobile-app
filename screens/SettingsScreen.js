import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { Trash2, HardDrive, Settings as SettingsIcon, ShieldCheck, Info } from 'lucide-react-native';

export default function SettingsScreen() {
  const [cacheSize, setCacheSize] = useState('计算中...');
  const [isClearing, setIsClearing] = useState(false);

  // 格式化字节
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 核心引擎：深度扫描 Cache 文件夹计算体积
  const getCacheSize = async () => {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      let totalSize = 0;
      
      for (const file of files) {
        const fileInfo = await FileSystem.getInfoAsync(cacheDir + file);
        if (!fileInfo.isDirectory && fileInfo.size) {
          totalSize += fileInfo.size;
        }
      }
      setCacheSize(formatBytes(totalSize));
    } catch (error) {
      setCacheSize('0 B');
    }
  };

  // 每次切到设置页，自动重新计算一次
  useFocusEffect(
    useCallback(() => {
      getCacheSize();
    }, [])
  );

  // 核心引擎：一键粉碎缓存
  const clearCache = async () => {
    Alert.alert('清理缓存', '确定要清除所有预览图片和传输生成的临时垃圾文件吗？', [
      { text: '取消', style: 'cancel' },
      { 
        text: '彻底清除', 
        style: 'destructive', 
        onPress: async () => {
          setIsClearing(true);
          try {
            const cacheDir = FileSystem.cacheDirectory;
            const files = await FileSystem.readDirectoryAsync(cacheDir);
            for (const file of files) {
              await FileSystem.deleteAsync(cacheDir + file, { idempotent: true });
            }
            await getCacheSize(); // 重新计算，此时应该变成 0B
            Alert.alert('清理完成', '存储空间已释放！');
          } catch (error) {
            Alert.alert('清理失败', error.message);
          } finally {
            setIsClearing(false);
          }
        } 
      }
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* 头部装饰 */}
      <View style={styles.header}>
        <SettingsIcon color="#3b82f6" size={48} style={{ marginBottom: 12 }} />
        <Text style={styles.title}>系统设置</Text>
        <Text style={styles.subtitle}>Version 1.0.0 (Pro)</Text>
      </View>

      {/* 存储与缓存面板 */}
      <Text style={styles.sectionTitle}>存储管理</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconBox}><HardDrive color="#10b981" size={20} /></View>
          <View style={styles.infoBox}>
            <Text style={styles.rowTitle}>本地缓存占用</Text>
            <Text style={styles.rowSub}>预览图片与临时文件</Text>
          </View>
          <Text style={styles.valueText}>{cacheSize}</Text>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.row} onPress={clearCache} disabled={isClearing}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            {isClearing ? <ActivityIndicator color="#ef4444" size="small" /> : <Trash2 color="#ef4444" size={20} />}
          </View>
          <View style={styles.infoBox}>
            <Text style={[styles.rowTitle, { color: '#ef4444' }]}>一键清理缓存</Text>
            <Text style={styles.rowSub}>释放手机存储空间</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 安全与隐私面板 (占位展示) */}
      <Text style={styles.sectionTitle}>安全与隐私</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}><ShieldCheck color="#3b82f6" size={20} /></View>
          <View style={styles.infoBox}>
            <Text style={styles.rowTitle}>原生沙盒隔离 (SAF)</Text>
            <Text style={styles.rowSub}>已开启·按需授权访问</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}><Info color="#f59e0b" size={20} /></View>
          <View style={styles.infoBox}>
            <Text style={styles.rowTitle}>通信加密状态</Text>
            <Text style={styles.rowSub}>HTTP Basic Auth 混合编码</Text>
          </View>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginVertical: 30 },
  title: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#6b7280', fontSize: 14, marginTop: 4 },
  
  sectionTitle: { color: '#9ca3af', fontSize: 14, fontWeight: 'bold', marginLeft: 8, marginBottom: 8, marginTop: 16 },
  card: { backgroundColor: '#1f2937', borderRadius: 16, overflow: 'hidden', elevation: 3 },
  
  row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(16, 185, 129, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  infoBox: { flex: 1, justifyContent: 'center' },
  rowTitle: { color: '#e5e7eb', fontSize: 16, fontWeight: '500', marginBottom: 4 },
  rowSub: { color: '#6b7280', fontSize: 13 },
  valueText: { color: '#10b981', fontSize: 16, fontWeight: 'bold' },
  
  divider: { height: 1, backgroundColor: '#374151', marginLeft: 72 },
});