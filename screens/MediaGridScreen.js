import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, FlatList, Image, Alert, Dimensions, TextInput, KeyboardAvoidingView, Platform, Modal, Pressable, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { XMLParser } from 'fast-xml-parser';
import base64 from 'base-64';
import { PlayCircle, RefreshCw, Film, Server, User, Key, Plus, FolderHeart, LogOut, Folder, ChevronRight, CheckCircle2, X, Trash2, Clock, FolderPlus } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const POSTER_WIDTH = (width - 48) / 3; 
const POSTER_HEIGHT = POSTER_WIDTH * 1.5; 

export default function MediaGridScreen({ navigation }) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [davUrl, setDavUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [libraries, setLibraries] = useState([]); 
  const [movieList, setMovieList] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]); // 继续观看列表
  const [activeTab, setActiveTab] = useState('all'); 
  
  const [isScanning, setIsScanning] = useState(false); // 💡 后台扫描状态
  const [scanProgress, setScanProgress] = useState(''); // 💡 临时进度显示
  const [loading, setLoading] = useState(true);

  // 弹窗状态
  const [showAddLibModal, setShowAddLibModal] = useState(false);
  const [browserMode, setBrowserMode] = useState('create'); // 'create' | 'add_path'
  const [targetLibId, setTargetLibId] = useState(null);
  
  const [browserPath, setBrowserPath] = useState('/'); 
  const [browserFolders, setBrowserFolders] = useState([]); 
  const [browserLoading, setBrowserLoading] = useState(false);
  const [newLibName, setNewLibName] = useState('');
  const [newLibType, setNewLibType] = useState('movie'); 

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem('@media_dav_url');
      const savedUser = await AsyncStorage.getItem('@media_dav_user');
      const savedPass = await AsyncStorage.getItem('@media_dav_pass');
      const savedLibs = await AsyncStorage.getItem('@media_libraries');
      const savedCache = await AsyncStorage.getItem('@media_movie_cache');
      const savedProgress = await AsyncStorage.getItem('@media_playback_progress');
      
      if (savedUrl && savedUser && savedPass) {
        setDavUrl(savedUrl); setUsername(savedUser); setPassword(savedPass);
        setIsConfigured(true);
        setLibraries(savedLibs ? JSON.parse(savedLibs) : []);
        setMovieList(savedCache ? JSON.parse(savedCache) : []);
        setContinueWatching(savedProgress ? JSON.parse(savedProgress) : []);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // ==========================================
  // 📁 增强版文件夹浏览器 (支持多目录绑定)
  // ==========================================
  const fetchBrowserFolders = async (targetPath) => {
    setBrowserLoading(true);
    try {
      const originMatch = davUrl.match(/^(https?:\/\/[^\/]+)/);
      const auth = `Basic ${base64.encode(`${username}:${password}`)}`;
      const response = await fetch(originMatch[1] + targetPath, { method: 'PROPFIND', headers: { 'Authorization': auth, 'Depth': '1' } });
      const xmlText = await response.text();
      const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true });
      const result = parser.parse(xmlText);
      let responses = result?.multistatus?.response || [];
      if (!Array.isArray(responses)) responses = [responses];
      let folders = responses.filter(res => {
        let href = res.href.replace(/https?:\/\/[^\/]+/, '');
        return res.propstat?.prop?.resourcetype?.collection === '' && href !== targetPath && href !== targetPath + '/';
      }).map(res => ({ name: decodeURIComponent(res.href.replace(/https?:\/\/[^\/]+/, '').split('/').filter(Boolean).pop()), path: res.href.replace(/https?:\/\/[^\/]+/, '') }));
      setBrowserFolders(folders.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) { console.error(error); } finally { setBrowserLoading(false); }
  };

  const handleSaveLibrary = async () => {
    let updatedLibs = [...libraries];
    if (browserMode === 'create') {
      if (!newLibName.trim()) return Alert.alert('提示', '请输入名称');
      updatedLibs.push({ id: Date.now().toString(), name: newLibName.trim(), type: newLibType, paths: [browserPath] });
    } else {
      updatedLibs = updatedLibs.map(lib => lib.id === targetLibId ? { ...lib, paths: [...new Set([...lib.paths, browserPath])] } : lib);
    }
    setLibraries(updatedLibs);
    await AsyncStorage.setItem('@media_libraries', JSON.stringify(updatedLibs));
    setShowAddLibModal(false);
    startBackgroundScan(updatedLibs); // 💡 触发后台扫描
  };

  const deleteLibrary = (id) => {
    Alert.alert('删除媒体库', '确定要删除此分类吗？视频文件不会被删除。', [
      { text: '取消' },
      { text: '确定', style: 'destructive', onPress: async () => {
        const updated = libraries.filter(l => l.id !== id);
        setLibraries(updated);
        await AsyncStorage.setItem('@media_libraries', JSON.stringify(updated));
        setMovieList(prev => prev.filter(m => m.libraryId !== id));
      }}
    ]);
  };

  // ==========================================
  // 🎬 后台异步扫描引擎 (带进度提示)
  // ==========================================
  const startBackgroundScan = async (libsToScan) => {
    if (isScanning) return;
    setIsScanning(true);
    let allMovies = [];
    const auth = `Basic ${base64.encode(`${username}:${password}`)}`;
    const origin = davUrl.match(/^(https?:\/\/[^\/]+)/)[1];

    try {
      for (const lib of libsToScan) {
        for (const path of lib.paths) {
          let queue = [path.endsWith('/') ? path : path + '/'];
          while (queue.length > 0) {
            const currentPath = queue.shift();
            setScanProgress(`${lib.name}: ${decodeURIComponent(currentPath).split('/').pop() || '...'}`);
            
            try {
              const res = await fetch(origin + currentPath, { method: 'PROPFIND', headers: { 'Authorization': auth, 'Depth': '1' } });
              const xml = await res.text();
              const result = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true }).parse(xml);
              let items = result?.multistatus?.response || [];
              if (!Array.isArray(items)) items = [items];

              let vids = items.filter(i => /\.(mkv|mp4|avi|iso)$/i.test(i.href));
              if (vids.length > 0) {
                let movie = { id: `${lib.id}-${allMovies.length}`, libraryId: lib.id, title: decodeURIComponent(currentPath.split('/').filter(Boolean).pop()), videoUrl: origin + vids[0].href, posterUrl: null, nfo: null };
                // 探测 NFO 和 海报 (简化逻辑提高扫描速度)
                items.forEach(i => {
                    const h = i.href.toLowerCase();
                    if (h.endsWith('.nfo')) movie.nfo_path = origin + i.href;
                    if (h.includes('poster') || h.includes('folder')) movie.posterUrl = origin + i.href;
                });
                allMovies.push(movie);
              }
              items.forEach(i => {
                  if (i.propstat?.prop?.resourcetype?.collection === '' && i.href.replace(/https?:\/\/[^\/]+/, '') !== currentPath) 
                    queue.push(i.href.replace(/https?:\/\/[^\/]+/, '').endsWith('/') ? i.href.replace(/https?:\/\/[^\/]+/, '') : i.href.replace(/https?:\/\/[^\/]+/, '') + '/');
              });
            } catch (e) {}
          }
        }
      }
      setMovieList(allMovies);
      await AsyncStorage.setItem('@media_movie_cache', JSON.stringify(allMovies));
    } finally {
      setIsScanning(false);
      setScanProgress('');
    }
  };

  const renderMovieItem = ({ item }) => (
    <TouchableOpacity style={styles.posterCard} onPress={() => navigation.navigate('Player', { movie: item })}>
      <View style={styles.posterShadow}>
        <Image source={{ uri: item.posterUrl, headers: { 'Authorization': `Basic ${base64.encode(`${username}:${password}`)}` } }} style={styles.posterImage} />
      </View>
      <Text style={styles.movieTitle} numberOfLines={1}>{item.title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
            <Text style={styles.headerTitle}>我的影音</Text>
            {isScanning && <Text style={styles.scanStatus} numberOfLines={1}>⏳ {scanProgress}</Text>}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => { setBrowserMode('create'); openBrowserModal(); }} style={styles.iconBtn}><Plus color="#ffffff" size={24} /></TouchableOpacity>
          <TouchableOpacity onPress={() => startBackgroundScan(libraries)} style={styles.iconBtn}>
            {isScanning ? <ActivityIndicator size="small" color="#3b82f6" /> : <RefreshCw color="#ffffff" size={22} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}><LogOut color="#ef4444" size={22} /></TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 继续观看模块 */}
        {continueWatching.length > 0 && (
            <View style={styles.section}>
                <View style={styles.sectionHeader}><Clock color="#f59e0b" size={18} /><Text style={styles.sectionTitle}>继续观看</Text></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 16 }}>
                    {continueWatching.map((item, idx) => (
                        <TouchableOpacity key={idx} style={styles.continueCard}>
                            <Image source={{ uri: item.posterUrl }} style={styles.continueImage} />
                            <View style={styles.progressBar}><View style={[styles.progressInner, { width: `${item.percent}%` }]} /></View>
                            <Text style={styles.continueText} numberOfLines={1}>{item.title}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        )}

        {/* 媒体库管理及分类 */}
        <View style={styles.tabContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                <TouchableOpacity onPress={() => setActiveTab('all')} style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}><Text style={styles.tabText}>全部</Text></TouchableOpacity>
                {libraries.map(lib => (
                    <TouchableOpacity 
                        key={lib.id} 
                        onLongPress={() => deleteLibrary(lib.id)}
                        onPress={() => setActiveTab(lib.id)} 
                        style={[styles.tabBtn, activeTab === lib.id && styles.tabBtnActive]}
                    >
                        <Text style={styles.tabText}>{lib.name}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        {/* 列表渲染 */}
        <FlatList
          data={movieList.filter(m => activeTab === 'all' || m.libraryId === activeTab)}
          renderItem={renderMovieItem}
          keyExtractor={item => item.id}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
        />
      </ScrollView>

      {/* 📁 改进版文件夹浏览器弹窗 */}
      <Modal visible={showAddLibModal} animationType="slide">
        <View style={styles.browserModal}>
          <View style={styles.browserHeader}>
            <Text style={styles.browserTitle}>{browserMode === 'create' ? '新建媒体库' : '添加文件夹'}</Text>
            <TouchableOpacity onPress={() => setShowAddLibModal(false)}><X color="#ffffff" size={28} /></TouchableOpacity>
          </View>
          <View style={styles.browserPathRow}>
            <TouchableOpacity onPress={goUpFolder}><ChevronRight color="#3b82f6" size={24} style={{ transform: [{ rotate: '180deg' }] }} /></TouchableOpacity>
            <Text style={styles.browserPathText} numberOfLines={1}>{decodeURIComponent(browserPath)}</Text>
          </View>
          <ScrollView style={{ flex: 1 }}>
            {browserLoading ? <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} /> : 
              browserFolders.map((f, i) => (
                <TouchableOpacity key={i} style={styles.browserItem} onPress={() => { setBrowserPath(f.path); fetchBrowserFolders(f.path); }}>
                  <Folder color="#3b82f6" size={22} /><Text style={styles.browserItemText}>{f.name}</Text>
                </TouchableOpacity>
              ))
            }
          </ScrollView>
          <View style={styles.browserFooter}>
             {browserMode === 'create' && <TextInput style={styles.modalInput} placeholder="媒体库名称" placeholderTextColor="#6b7280" value={newLibName} onChangeText={setNewLibName} />}
             <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveLibrary}><Text style={styles.modalConfirmText}>确认并扫描该路径</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: '#1f2937' },
  headerTitle: { color: '#ffffff', fontSize: 20, fontWeight: 'bold' },
  scanStatus: { color: '#3b82f6', fontSize: 11, marginTop: 2, width: 150 },
  iconBtn: { marginLeft: 16 },
  
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginLeft: 16, marginBottom: 12 },
  sectionTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginLeft: 6 },
  continueCard: { width: 140, marginRight: 12 },
  continueImage: { width: 140, height: 80, borderRadius: 8, backgroundColor: '#374151' },
  progressBar: { height: 3, backgroundColor: '#374151', width: '100%', marginTop: 4 },
  progressInner: { height: '100%', backgroundColor: '#f59e0b' },
  continueText: { color: '#e5e7eb', fontSize: 12, marginTop: 4 },

  tabContainer: { marginVertical: 16 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1f2937', marginRight: 8, borderWidth: 1, borderColor: '#374151' },
  tabBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  tabText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },

  listContent: { paddingHorizontal: 12 },
  columnWrapper: { justifyContent: 'flex-start' },
  posterCard: { width: POSTER_WIDTH, marginBottom: 16, marginRight: 12 },
  posterImage: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: 8, backgroundColor: '#1f2937' },
  movieTitle: { color: '#ffffff', fontSize: 12, marginTop: 6 },

  browserModal: { flex: 1, backgroundColor: '#111827' },
  browserHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: '#1f2937' },
  browserTitle: { color: '#ffffff', fontSize: 18 },
  browserPathRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#1f2937' },
  browserPathText: { color: '#3b82f6', marginLeft: 8, fontSize: 14 },
  browserItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  browserItemText: { color: '#ffffff', marginLeft: 12 },
  browserFooter: { padding: 20, backgroundColor: '#1f2937' },
  modalInput: { backgroundColor: '#374151', color: '#ffffff', padding: 12, borderRadius: 8, marginBottom: 12 },
  modalConfirmBtn: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 8, alignItems: 'center' },
  modalConfirmText: { color: '#ffffff', fontWeight: 'bold' }
});