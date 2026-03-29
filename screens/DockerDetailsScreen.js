import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Box, Cpu, Database } from 'lucide-react-native';

export default function DockerDetailsScreen() {
  const [dockers, setDockers] = useState([]);
  const [loading, setLoading] = useState(true);

  // 根据名字生成固定的炫彩背景色
  const getAvatarColor = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#2dd4bf', '#38bdf8', '#818cf8', '#a78bfa', '#e879f9', '#f43f5e'];
    return colors[Math.abs(hash) % colors.length];
  };

  // 1. 获取数据的核心逻辑
  const fetchDockerData = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem('@server_url');
      const savedToken = await AsyncStorage.getItem('@api_token');
      if (!savedUrl || !savedToken) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${savedUrl}/api.php?token=${savedToken}&action=status`, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (data.dockers && data.dockers.list) {
        setDockers(data.dockers.list);
      }
    } catch (error) {
      console.log('获取 Docker 列表失败', error);
    } finally {
      setLoading(false);
    }
  };

  // 2. 两秒自动刷新机制
  useFocusEffect(
    useCallback(() => {
      fetchDockerData();
      const interval = setInterval(() => fetchDockerData(), 2000);
      return () => clearInterval(interval);
    }, [])
  );

  // 3. 启停控制逻辑
  const toggleDocker = async (name, currentStatus) => {
    try {
      const savedUrl = await AsyncStorage.getItem('@server_url');
      const savedToken = await AsyncStorage.getItem('@api_token');
      const action = currentStatus === 'running' ? 'stop_docker' : 'start_docker';
      
      const response = await fetch(`${savedUrl}/api.php?token=${savedToken}&action=${action}&target=${name}`);
      const result = await response.json();
      
      if (result.status === 'success') {
        fetchDockerData(); // 成功后立刻刷新状态
      } else {
        Alert.alert('操作失败', '无法改变容器状态');
      }
    } catch (error) {
      Alert.alert('请求失败', '网络连接异常');
    }
  };

  if (loading && dockers.length === 0) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {dockers.length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyText}>没有找到任何 Docker 容器</Text></View>
      ) : (
        dockers.map((docker, index) => (
          <View key={index} style={styles.card}>
            {/* 左侧：炫彩头像 */}
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(docker.name) }]}>
              <Text style={styles.avatarText}>{docker.name.substring(0, 2).toUpperCase()}</Text>
            </View>
            
            {/* 中间：容器信息与资源占用 */}
            <View style={styles.infoContainer}>
              <Text style={styles.nameText} numberOfLines={1}>{docker.name}</Text>
              <Text style={styles.imageText} numberOfLines={1}>{docker.image}</Text>
              
              {/* 仅在运行时显示资源 */}
              {docker.status === 'running' && (
                <View style={styles.statsRow}>
                  <View style={styles.statBadge}>
                    <Cpu size={12} color="#f59e0b" />
                    <Text style={styles.statText}>{docker.cpu}</Text>
                  </View>
                  <View style={styles.statBadge}>
                    <Database size={12} color="#10b981" />
                    <Text style={styles.statText}>{docker.memory}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* 右侧：状态指示灯与开关 */}
            <View style={styles.controlContainer}>
              <View style={[styles.statusDot, { backgroundColor: docker.status === 'running' ? '#10b981' : '#ef4444' }]} />
              <Switch
                trackColor={{ false: '#374151', true: '#34d399' }}
                thumbColor={'#ffffff'}
                onValueChange={() => toggleDocker(docker.name, docker.status)}
                value={docker.status === 'running'}
              />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', minHeight: 400 },
  emptyText: { color: '#9ca3af', fontSize: 16 },
  card: { flexDirection: 'row', backgroundColor: '#1f2937', borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  infoContainer: { flex: 1, marginRight: 10 },
  nameText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  imageText: { color: '#6b7280', fontSize: 12, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#374151', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4 },
  statText: { color: '#d1d5db', fontSize: 11, fontWeight: 'bold' },
  controlContainer: { alignItems: 'flex-end', justifyContent: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
});