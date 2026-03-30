import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Modal, Clipboard, Share } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { XMLParser } from 'fast-xml-parser';
import base64 from 'base-64';
import { ChevronLeft, Play, Film, MonitorPlay, X, Settings2, AudioLines, Subtitles, Info, ExternalLink } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');
const VIDEO_FORMATS = /\.(mkv|mp4|avi|ts|rmvb|flv|wmv|m2ts|vob|mov|webm|iso)$/i;

export default function MediaDetailScreen({ route, navigation }) {
  const { movie } = route.params;
  const [authHeader, setAuthHeader] = useState('');
  const [davOrigin, setDavOrigin] = useState('');
  
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  
  // 播放器状态
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [showSettings, setShowSettings] = useState(false); // 控制台显示状态
  const [playbackStats, setPlaybackStats] = useState({ position: 0, duration: 0, isBuffering: false });
  
  const videoRef = useRef(null);
  const playbackStatusRef = useRef(null);

  useEffect(() => { loadAuthAndEpisodes(); }, []);

  const loadAuthAndEpisodes = async () => {
    try {
      const url = await AsyncStorage.getItem('@media_dav_url');
      const user = await AsyncStorage.getItem('@media_dav_user');
      const pass = await AsyncStorage.getItem('@media_dav_pass');
      
      if (url && user && pass) {
        const auth = `Basic ${base64.encode(`${user}:${pass}`)}`;
        setAuthHeader(auth);
        const origin = url.match(/^(https?:\/\/[^\/]+)/)[1];
        setDavOrigin(origin);
        scanEpisodes(origin, auth, movie.path);
      }
    } catch (error) { console.error(error); }
  };

  const scanEpisodes = async (origin, auth, rootPath) => {
    setLoadingEpisodes(true);
    let foundEpisodes = [];
    let queue = [rootPath];
    let depthMap = { [rootPath]: 0 }; 

    try {
      while (queue.length > 0) {
        const currentPath = queue.shift();
        const currentDepth = depthMap[currentPath];
        if (currentDepth > 2) continue; 

        const res = await fetch(origin + currentPath, { method: 'PROPFIND', headers: { 'Authorization': auth, 'Depth': '1' } });
        const items = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true }).parse(await res.text())?.multistatus?.response || [];
        const files = Array.isArray(items) ? items : [items];

        files.forEach(i => {
          let href = i.href.replace(/https?:\/\/[^\/]+/, '');
          let props = i.propstat?.prop || {};
          let isFolder = props.resourcetype?.collection === '';
          
          if (isFolder && href !== currentPath && href !== currentPath.slice(0, -1)) {
            const cleanHref = href.endsWith('/') ? href : href + '/';
            queue.push(cleanHref); depthMap[cleanHref] = currentDepth + 1;
          } else if (VIDEO_FORMATS.test(href)) {
            let filename = decodeURIComponent(href.split('/').pop());
            foundEpisodes.push({ title: filename.replace(VIDEO_FORMATS, ''), url: origin + href, size: props.getcontentlength || 0 });
          }
        });
      }
      setEpisodes(foundEpisodes.sort((a, b) => a.title.localeCompare(b.title)));
    } catch (e) { console.log(e); } finally { setLoadingEpisodes(false); }
  };

  const handlePlay = (videoUrl) => { setActiveVideoUrl(videoUrl); };

  const closePlayerAndSaveProgress = async () => {
    const status = playbackStatusRef.current;
    if (status && activeVideoUrl) {
      const percent = (status.positionMillis / status.durationMillis) * 100;
      if (percent > 1 && percent < 95) {
        const progressRecord = {
          id: movie.id, title: movie.title, posterUrl: movie.posterUrl,
          percent: percent.toFixed(1), positionMillis: status.positionMillis, videoUrl: activeVideoUrl,
        };
        try {
          let history = JSON.parse(await AsyncStorage.getItem('@media_playback_progress') || '[]');
          history = history.filter(h => h.id !== movie.id);
          history.unshift(progressRecord);
          if (history.length > 15) history.pop();
          await AsyncStorage.setItem('@media_playback_progress', JSON.stringify(history));
        } catch(e) {}
      }
    }
    setActiveVideoUrl(null); playbackStatusRef.current = null;
  };

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs'); 
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化时间
  const formatTime = (millis) => {
    if (!millis) return "00:00";
    const totalSeconds = Math.floor(millis / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 渲染流信息面板
  const renderStreamDetails = () => {
    const stream = movie.nfo?.fileinfo?.streamdetails;
    if (!stream) return <Text style={styles.consoleText}>未找到 NFO 媒体流数据</Text>;

    const audios = Array.isArray(stream.audio) ? stream.audio : (stream.audio ? [stream.audio] : []);
    const subs = Array.isArray(stream.subtitle) ? stream.subtitle : (stream.subtitle ? [stream.subtitle] : []);

    return (
      <View>
        <View style={styles.consoleRow}>
          <AudioLines color="#9ca3af" size={18} /><Text style={styles.consoleTitle}>内嵌音轨 ({audios.length})</Text>
        </View>
        {audios.length > 0 ? audios.map((a, i) => (
          <TouchableOpacity key={i} style={styles.consoleItem} onPress={() => Alert.alert('提示', '受限于原生播放器限制，切换 MKV 内嵌音轨建议使用第三方播放器。')}>
            <Text style={styles.consoleItemText}>Track {i+1}: {a.codec?.toUpperCase()} {a.channels}Ch ({a.language||'未知'})</Text>
          </TouchableOpacity>
        )) : <Text style={styles.consoleText}>无独立音轨数据</Text>}

        <View style={[styles.consoleRow, { marginTop: 20 }]}>
          <Subtitles color="#9ca3af" size={18} /><Text style={styles.consoleTitle}>内嵌字幕 ({subs.length})</Text>
        </View>
        {subs.length > 0 ? subs.map((s, i) => (
          <TouchableOpacity key={i} style={styles.consoleItem} onPress={() => Alert.alert('提示', '内嵌软字幕渲染需要专业解码器支持。')}>
            <Text style={styles.consoleItemText}>Sub {i+1}: {s.language||'未知'}</Text>
          </TouchableOpacity>
        )) : <Text style={styles.consoleText}>无内嵌字幕</Text>}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 🎬 播放器与覆盖层 */}
      {activeVideoUrl && (
        <View style={styles.playerWrapper}>
          <View style={styles.playerContainer}>
            {/* 顶栏控制 */}
            <View style={styles.playerTopBar}>
              <TouchableOpacity style={styles.iconBtnLayer} onPress={closePlayerAndSaveProgress}><X color="#ffffff" size={28} /></TouchableOpacity>
              <TouchableOpacity style={styles.iconBtnLayer} onPress={() => setShowSettings(true)}><Settings2 color="#ffffff" size={26} /></TouchableOpacity>
            </View>

            <Video
              ref={videoRef} style={styles.videoView} 
              source={{ uri: activeVideoUrl, headers: { 'Authorization': authHeader } }}
              useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay
              onPlaybackStatusUpdate={(status) => { 
                if (status.isLoaded) {
                  playbackStatusRef.current = status;
                  setPlaybackStats({ position: status.positionMillis, duration: status.durationMillis, isBuffering: status.isBuffering });
                } 
              }}
              positionMillis={movie.positionMillis || 0} 
            />
          </View>

          {/* ⚙️ 播放控制台 (半透明 Modal) */}
          <Modal visible={showSettings} transparent={true} animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.consolePanel}>
                <View style={styles.consoleHeader}>
                  <Text style={{color:'#fff', fontSize:18, fontWeight:'bold'}}>播放控制台</Text>
                  <TouchableOpacity onPress={() => setShowSettings(false)}><X color="#9ca3af" size={24} /></TouchableOpacity>
                </View>

                <ScrollView style={{ padding: 20 }}>
                  <View style={styles.statsCard}>
                    <View style={styles.consoleRow}><Info color="#3b82f6" size={18} /><Text style={styles.consoleTitle}>实时状态</Text></View>
                    <Text style={styles.consoleText}>进度: {formatTime(playbackStats.position)} / {formatTime(playbackStats.duration)}</Text>
                    <Text style={styles.consoleText}>缓冲状态: {playbackStats.isBuffering ? '🔄 缓冲中...' : '✅ 流畅'}</Text>
                    {movie.nfo?.fileinfo?.streamdetails?.video && (
                      <Text style={styles.consoleText}>视频流: {movie.nfo.fileinfo.streamdetails.video.codec?.toUpperCase()} {movie.nfo.fileinfo.streamdetails.video.width}x{movie.nfo.fileinfo.streamdetails.video.height}</Text>
                    )}
                  </View>

                  {renderStreamDetails()}

                  {/* 调用第三方播放器方案 */}
                  <TouchableOpacity style={styles.externalBtn} onPress={() => {
                    const fullUrlUrlWithAuth = activeVideoUrl.replace('http://', `http://${username}:${password}@`).replace('https://', `https://${username}:${password}@`);
                    Share.share({ message: fullUrlUrlWithAuth });
                  }}>
                    <ExternalLink color="#ffffff" size={18} style={{marginRight: 8}}/>
                    <Text style={{color:'#fff', fontWeight:'bold'}}>复制直链给第三方播放器 (推荐)</Text>
                  </TouchableOpacity>
                  <Text style={{color:'#6b7280', fontSize: 11, textAlign:'center', marginTop:8}}>对于 4K HDR 或多音轨 MKV，推荐复制链接到 VLC 或 Infuse 中播放以获得完美解码体验。</Text>

                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      )}

      {/* 以下为原有的详情页 ScrollView (未修改) */}
      <ScrollView style={styles.scrollView} bounces={false}>
        <View style={styles.heroSection}>
          {movie.posterUrl ? <Image source={{ uri: movie.posterUrl, headers: { 'Authorization': authHeader } }} style={styles.backdropImage} /> : <View style={[styles.backdropImage, { backgroundColor: '#1f2937' }]} />}
          <BlurView intensity={80} tint="dark" style={styles.blurOverlay} />
          <View style={styles.heroGradient} />
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}><ChevronLeft color="#ffffff" size={32} /></TouchableOpacity>

          <View style={styles.heroContent}>
            {movie.posterUrl ? <Image source={{ uri: movie.posterUrl, headers: { 'Authorization': authHeader } }} style={styles.mainPoster} /> : <View style={[styles.mainPoster, styles.fallbackPoster]}><Film color="#4b5563" size={48} /></View>}
            <View style={styles.heroTextContainer}>
              <Text style={styles.title} numberOfLines={2}>{movie.title}</Text>
              <View style={styles.metaRow}>
                {movie.nfo?.year && <Text style={styles.metaText}>{movie.nfo.year}</Text>}
                {movie.nfo?.rating && movie.nfo.rating !== '0.0' && <View style={styles.ratingBadge}><Text style={styles.ratingText}>{movie.nfo.rating}</Text></View>}
                <Text style={styles.typeBadge}>{movie.type === 'movie' ? '电影' : movie.type === 'tv' ? '剧集' : '动漫'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.plotTitle}>剧情简介</Text>
          <Text style={styles.plotText}>{movie.nfo?.plot || '暂无简介'}</Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.plotTitle}>媒体信息</Text>
          <View style={styles.mediaInfoCard}>
            <Text style={styles.mediaInfoText} numberOfLines={2}>📁 路径: {decodeURIComponent(movie.path)}</Text>
            {episodes.length > 0 && <Text style={styles.mediaInfoText}>💾 大小: {formatBytes(episodes.reduce((acc, ep) => acc + Number(ep.size || 0), 0))}</Text>}
            {movie.nfo?.fileinfo?.streamdetails?.video && (
              <Text style={styles.mediaInfoText}>🎬 视频: {movie.nfo.fileinfo.streamdetails.video.codec?.toUpperCase()} {movie.nfo.fileinfo.streamdetails.video.width}x{movie.nfo.fileinfo.streamdetails.video.height}</Text>
            )}
          </View>
        </View>

        <View style={styles.episodesSection}>
          <Text style={styles.plotTitle}>{movie.type === 'movie' ? '播放影片' : '选集播放'}</Text>
          {loadingEpisodes ? (
            <View style={styles.centerBox}><ActivityIndicator color="#3b82f6" size="large" /><Text style={{color:'#9ca3af', marginTop:10}}>正在匹配媒体流...</Text></View>
          ) : episodes.length === 0 ? (
            <View style={styles.centerBox}><MonitorPlay color="#4b5563" size={48} /><Text style={{color:'#9ca3af', marginTop:10}}>未找到支持的视频文件</Text></View>
          ) : (
            episodes.map((ep, index) => (
              <TouchableOpacity key={index} style={styles.episodeCard} onPress={() => handlePlay(ep.url)}>
                <View style={styles.episodeIconBox}><Play color="#ffffff" size={20} fill="#ffffff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.episodeTitle} numberOfLines={2}>{ep.title}</Text>
                  <Text style={styles.episodeSub}>{formatBytes(ep.size)} · WebDAV 直播</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' }, scrollView: { flex: 1 },
  heroSection: { height: 350, position: 'relative', justifyContent: 'flex-end', padding: 20 },
  backdropImage: { position: 'absolute', top: 0, left: 0, width: width, height: 350, resizeMode: 'cover' },
  blurOverlay: { position: 'absolute', top: 0, left: 0, width: width, height: 350 },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, width: width, height: 150, backgroundColor: 'rgba(17, 24, 39, 0.8)' }, 
  backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 16, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  heroContent: { flexDirection: 'row', alignItems: 'flex-end', zIndex: 5 },
  mainPoster: { width: 120, height: 180, borderRadius: 12, borderWidth: 2, borderColor: '#374151', elevation: 10 },
  fallbackPoster: { backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center' },
  heroTextContainer: { flex: 1, marginLeft: 16, marginBottom: 10 },
  title: { color: '#ffffff', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { color: '#e5e7eb', fontSize: 14, marginRight: 12, fontWeight: 'bold' },
  ratingBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 12 },
  ratingText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  typeBadge: { borderWidth: 1, borderColor: '#6b7280', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, color: '#9ca3af', fontSize: 12 },
  
  infoSection: { padding: 20, paddingTop: 10 },
  plotTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  plotText: { color: '#9ca3af', fontSize: 14, lineHeight: 22 },
  mediaInfoCard: { backgroundColor: '#1f2937', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#374151' },
  mediaInfoText: { color: '#e5e7eb', fontSize: 13, marginBottom: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  episodesSection: { padding: 20, paddingTop: 0, paddingBottom: 50 },
  centerBox: { padding: 40, alignItems: 'center' },
  episodeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 3 },
  episodeIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  episodeTitle: { color: '#e5e7eb', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  episodeSub: { color: '#6b7280', fontSize: 12 },
  
  // 播放器与控制台相关样式
  playerWrapper: { position: 'absolute', top: 0, left: 0, width: width, height: height, zIndex: 999, backgroundColor: '#000' },
  playerContainer: { flex: 1, justifyContent: 'center' },
  playerTopBar: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 0, width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 1000 },
  iconBtnLayer: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  videoView: { width: '100%', height: height * 0.4 }, 
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  consolePanel: { backgroundColor: '#1f2937', height: height * 0.6, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  consoleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#374151' },
  statsCard: { backgroundColor: '#111827', padding: 16, borderRadius: 12, marginBottom: 20 },
  consoleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  consoleTitle: { color: '#e5e7eb', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  consoleText: { color: '#9ca3af', fontSize: 14, marginBottom: 6 },
  consoleItem: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#374151', borderRadius: 8, marginBottom: 8 },
  consoleItemText: { color: '#e5e7eb', fontSize: 14, fontWeight: '500' },
  
  externalBtn: { flexDirection: 'row', backgroundColor: '#8b5cf6', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 30 }
});