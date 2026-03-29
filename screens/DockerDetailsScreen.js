import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Switch, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Cpu, Database, RotateCw } from 'lucide-react-native';

export default function DockerDetailsScreen() {
  const [dockers, setDockers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortRule, setSortRule] = useState('name'); // 'name' | 'status' | 'cpu'

  const getAvatarColor = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#2dd4bf', '#38bdf8', '#818cf8', '#a78bfa', '#e879f9', '#f43f5e'];
    return colors[Math.abs(hash) % colors.length];
  };

  const fetchDockerData = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem('@server_url');
      const savedToken = await AsyncStorage.getItem('@api_token');
      if (!savedUrl || !savedToken) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
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

  // ⭐️ 核心修复：防雪崩递归轮询
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      let timerId = null;
      const pollData = async () => {
        if (!isActive) return;
        await fetchDockerData();
        if (isActive) {
          timerId = setTimeout(pollData, 3000); // 等上一次完全结束，再等 3 秒发下一次，极其稳定！
        }
      };
      pollData();
      return () => { isActive = false; if (timerId) clearTimeout(timerId); };
    }, [])
  );

  // 启停控制
  const toggleDocker = async (name, currentStatus) => {
    try {
      const savedUrl = await AsyncStorage.getItem('@server_url');
      const savedToken = await AsyncStorage.getItem('@api_token');
      const action = currentStatus === 'running' ? 'stop_docker' : 'start_docker';
      const response = await fetch(`${savedUrl}/api.php?token=${savedToken}&action=${action}&target=${name}`);
      const result = await response.json();
      if (result.status === 'success') fetchDockerData();
    } catch (error) { Alert.alert('失败', '网络异常'); }
  };

  // 重启控制
  const restartDocker = async (name) => {
    Alert.alert('确认重启', `确定要重启容器 ${name} 吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '重启', style: 'destructive', onPress: async () => {
          try {
            const savedUrl = await AsyncStorage.getItem('@server_url');
            const savedToken = await AsyncStorage.getItem('@api_token');
            const response = await fetch(`${savedUrl}/api.php?token=${savedToken}&action=restart_docker&target=${name}`);
            const result = await response.json();
            if (result.status === 'success') fetchDockerData();
          } catch (error) { Alert.alert('失败', '网络异常'); }
        }
      }
    ]);
  };

  // 动态排序算法
  const sortedDockers = [...dockers].sort((a, b) => {
    if (sortRule === 'status') {
      return (a.status === 'running' ? -1 : 1) - (b.status === 'running' ? -1 : 1);
    } else if (sortRule === 'cpu') {
      const cpuA = parseFloat(a.cpu.replace('%', '')) || 0;
      const cpuB = parseFloat(b.cpu.replace('%', '')) || 0;
      return cpuB - cpuA; // CPU高的排前面
    }
    return a.name.localeCompare(b.name); // 默认名称排序
  });

  if (loading && dockers.length === 0) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* 排序筛选栏 */}
      <View style={styles.sortBar}>
        <Text style={styles.sortLabel}>排序:</Text>
        <TouchableOpacity style={[styles.sortBtn, sortRule === 'name' && styles.sortBtnActive]} onPress={() => setSortRule('name')}><Text style={styles.sortBtnText}>名称</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.sortBtn, sortRule === 'status' && styles.sortBtnActive]} onPress={() => setSortRule('status')}><Text style={styles.sortBtnText}>状态</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.sortBtn, sortRule === 'cpu' && styles.sortBtnActive]} onPress={() => setSortRule('cpu')}><Text style={styles.sortBtnText}>CPU</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {sortedDockers.map((docker, index) => (
          <View key={index} style={styles.card}>
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(docker.name) }]}><Text style={styles.avatarText}>{docker.name.substring(0, 2).toUpperCase()}</Text></View>
            
            <View style={styles.infoContainer}>
              <Text style={styles.nameText} numberOfLines={1}>{docker.name}</Text>
              {docker.status === 'running' && (
                <View style={styles.statsRow}>
                  <View style={styles.statBadge}><Cpu size={12} color="#f59e0b" /><Text style={styles.statText}>{docker.cpu}</Text></View>
                  <View style={styles.statBadge}><Database size={12} color="#10b981" /><Text style={styles.statText}>{docker.memory}</Text></View>
                </View>
              )}
            </View>

            <View style={styles.controlContainer}>
              <View style={[styles.statusDot, { backgroundColor: docker.status === 'running' ? '#10b981' : '#ef4444' }]} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {docker.status === 'running' && (
                  <TouchableOpacity onPress={() => restartDocker(docker.name)} style={styles.restartBtn}>
                    <RotateCw size={18} color="#ffffff" />
                  </TouchableOpacity>
                )}
                <Switch trackColor={{ false: '#374151', true: '#34d399' }} thumbColor={'#ffffff'} onValueChange={() => toggleDocker(docker.name, docker.status)} value={docker.status === 'running'} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  sortBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1f2937', borderBottomWidth: 1, borderBottomColor: '#374151' },
  sortLabel: { color: '#9ca3af', marginRight: 12, fontSize: 14 },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#374151', marginRight: 8 },
  sortBtnActive: { backgroundColor: '#3b82f6' },
  sortBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' },
  card: { flexDirection: 'row', backgroundColor: '#1f2937', borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  infoContainer: { flex: 1, marginRight: 8 },
  nameText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#374151', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4 },
  statText: { color: '#d1d5db', fontSize: 11, fontWeight: 'bold' },
  controlContainer: { alignItems: 'flex-end', justifyContent: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 12 },
  restartBtn: { backgroundColor: '#6366f1', padding: 6, borderRadius: 8 },
});