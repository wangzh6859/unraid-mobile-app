import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Monitor } from 'lucide-react-native';

export default function VmDetailsScreen() {
  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVmData = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem('@server_url');
      const savedToken = await AsyncStorage.getItem('@api_token');
      if (!savedUrl || !savedToken) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${savedUrl}/api.php?token=${savedToken}&action=status`, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (data.vms && data.vms.list) {
        setVms(data.vms.list);
      }
    } catch (error) {
      console.log('获取 VM 列表失败', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchVmData();
      const interval = setInterval(() => fetchVmData(), 2000);
      return () => clearInterval(interval);
    }, [])
  );

  const toggleVm = async (name, currentStatus) => {
    try {
      const savedUrl = await AsyncStorage.getItem('@server_url');
      const savedToken = await AsyncStorage.getItem('@api_token');
      const action = currentStatus === 'running' ? 'stop_vm' : 'start_vm';
      
      const response = await fetch(`${savedUrl}/api.php?token=${savedToken}&action=${action}&target=${name}`);
      const result = await response.json();
      
      if (result.status === 'success') {
        fetchVmData();
      } else {
        Alert.alert('操作失败', '无法改变虚拟机状态');
      }
    } catch (error) {
      Alert.alert('请求失败', '网络连接异常');
    }
  };

  if (loading && vms.length === 0) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#ec4899" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {vms.length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyText}>没有找到任何虚拟机</Text></View>
      ) : (
        vms.map((vm, index) => (
          <View key={index} style={styles.card}>
            <View style={styles.iconWrapper}>
              <Monitor size={24} color="#ec4899" />
            </View>
            
            <View style={styles.infoContainer}>
              <Text style={styles.nameText} numberOfLines={1}>{vm.name}</Text>
              <Text style={[styles.statusText, { color: vm.status === 'running' ? '#10b981' : '#ef4444' }]}>
                {vm.status === 'running' ? '运行中' : '已停止'}
              </Text>
            </View>

            <Switch
              trackColor={{ false: '#374151', true: '#ec4899' }}
              thumbColor={'#ffffff'}
              onValueChange={() => toggleVm(vm.name, vm.status)}
              value={vm.status === 'running'}
            />
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
  iconWrapper: { width: 48, height: 48, backgroundColor: '#374151', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  infoContainer: { flex: 1, marginRight: 10 },
  nameText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
});