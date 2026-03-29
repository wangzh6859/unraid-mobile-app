import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SmartDetailsScreen({ route }) {
  const { device, name } = route.params; // 接收传过来的 sda, sdb 等设备号
  const [smartData, setSmartData] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSmart = async () => {
      try {
        const savedUrl = await AsyncStorage.getItem('@server_url');
        const savedToken = await AsyncStorage.getItem('@api_token');
        const response = await fetch(`${savedUrl}/api.php?token=${savedToken}&action=smart_info&target=${device}`);
        const result = await response.json();
        setSmartData(result.data || '未能获取到 S.M.A.R.T. 数据，请检查设备。');
      } catch (error) {
        setSmartData('网络错误，无法连接到 Unraid。');
      } finally {
        setLoading(false);
      }
    };
    fetchSmart();
  }, [device]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#10b981" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerBox}>
        <Text style={styles.titleText}>S.M.A.R.T. 报告 - {name} ({device})</Text>
      </View>
      <View style={styles.terminalBox}>
        <Text style={styles.terminalText}>{smartData}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' }, // 纯黑背景
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  headerBox: { backgroundColor: '#1f2937', padding: 12, borderRadius: 8, marginBottom: 16 },
  titleText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  terminalBox: { flex: 1 },
  // 终端风格的绿字输出
  terminalText: { color: '#10b981', fontFamily: 'monospace', fontSize: 12, lineHeight: 18 }, 
});