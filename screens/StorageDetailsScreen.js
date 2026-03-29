import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { HardDrive, Server } from 'lucide-react-native';

export default function StorageDetailsScreen() {
  const [disks, setDisks] = useState([]);
  const [loading, setLoading] = useState(true);

  // 格式化字节大小
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const fetchStorageData = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem('@server_url');
      const savedToken = await AsyncStorage.getItem('@api_token');
      if (!savedUrl || !savedToken) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${savedUrl}/api.php?token=${savedToken}&action=status`, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (data.storage && data.storage.disks) {
        // 过滤掉可能是系统底层的无效挂载点，并按名称排序
        const validDisks = data.storage.disks
          .filter(disk => disk.total > 0)
          .sort((a, b) => a.name.localeCompare(b.name));
        setDisks(validDisks);
      }
    } catch (error) {
      console.log('获取存储详情失败', error);
    } finally {
      setLoading(false);
    }
  };

  // 防雪崩递归轮询 (每 5 秒刷新一次就足够了，硬盘容量变化没那么快)
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      let timerId = null;
      const pollData = async () => {
        if (!isActive) return;
        await fetchStorageData();
        if (isActive) timerId = setTimeout(pollData, 5000);
      };
      pollData();
      return () => { isActive = false; if (timerId) clearTimeout(timerId); };
    }, [])
  );

  if (loading && disks.length === 0) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#10b981" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {disks.length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyText}>未找到磁盘信息</Text></View>
      ) : (
        disks.map((disk, index) => {
          // 判断是否是缓存盘 (通常名字里带有 cache)
          const isCache = disk.name.toLowerCase().includes('cache');
          // 超过 85% 标红报警，其他显示绿色或蓝色
          const isWarning = disk.percentage > 85;
          const barColor = isWarning ? '#ef4444' : (isCache ? '#3b82f6' : '#10b981');

          return (
            <View key={index} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.titleRow}>
                  {isCache ? <Server size={22} color="#3b82f6" /> : <HardDrive size={22} color="#10b981" />}
                  <Text style={styles.diskName}>{disk.name}</Text>
                </View>
                <Text style={[styles.percentageText, { color: barColor }]}>{disk.percentage}%</Text>
              </View>

              <Text style={styles.detailText}>
                已用 {formatBytes(disk.used)} / 总共 {formatBytes(disk.total)}
              </Text>

              <View style={styles.track}>
                <View style={[styles.bar, { width: `${disk.percentage}%`, backgroundColor: barColor }]} />
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', minHeight: 400 },
  emptyText: { color: '#9ca3af', fontSize: 16 },
  card: { backgroundColor: '#1f2937', borderRadius: 16, padding: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  diskName: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  percentageText: { fontSize: 20, fontWeight: 'bold' },
  detailText: { color: '#9ca3af', fontSize: 13, marginBottom: 12 },
  track: { height: 10, backgroundColor: '#374151', borderRadius: 5, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 5 },
});