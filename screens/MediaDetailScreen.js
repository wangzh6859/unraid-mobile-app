import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Modal, Share } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation'; // 💡 引入屏幕旋转控制
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { XMLParser } from 'fast-xml-parser';
import base64 from 'base-64';
import { ChevronLeft, Play, Film, MonitorPlay, X, Settings2, Video as VideoIcon, AudioLines, Subtitles, Info, ExternalLink } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');
const VIDEO_FORMATS = /\.(mkv|mp4|avi|ts|rmvb|flv|wmv|m2ts|vob|mov|webm|iso)$/i;
const MIN_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB 过滤

export default function MediaDetailScreen({ route, navigation }) {
  const { movie } = route.params;
  const [authHeader, setAuthHeader] = useState('');
  const [davOrigin, setDavOrigin] = useState('');
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [nfoDetails, setNfoDetails] = useState(movie.nfo || null);
  
  // 💡 播放器与控制台状态
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackStats, setPlaybackStats] = useState({ position: 0, duration: 0, isBuffering: false });
  
  const videoRef = useRef(null);
  const playbackStatusRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const url = await AsyncStorage.getItem('@media_dav_url');
      const user = await AsyncStorage.getItem('@media_dav_user');
      const pass = await AsyncStorage.getItem('@media_dav_pass');
      if (url && user && pass) {
        const auth = `Basic ${base64.encode(`${user}:${pass}`)}`;
        setAuthHeader(auth); setDavOrigin(url.match(/^(https?:\/\/[^\/]+)/)[1]);
        scanEpisodes(url.match(/^(https?:\/\/[^\/]+)/)[1], auth, movie.path);
        
        if (!movie.nfo?.fileinfo && movie.path) {
           fetchDetailedNfo(url.match(/^(https?:\/\/[^\/]+)/)[1], auth, movie.path);
        }
      }
    } catch (error) { console.error(error); }
  };

  const fetchDetailedNfo = async (origin, auth, rootPath) => {
    try {
      const res = await fetch(origin + rootPath, { method: 'PROPFIND', headers: { 'Authorization': auth, 'Depth': '1' } });
      const items = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true }).parse(await res.text())?.multistatus?.response || [];
      const files = Array.isArray(items) ? items : [items];
      const nfoFile = files.find(i => i.href.toLowerCase().endsWith('.nfo'));
      if (nfoFile) {
        const nfoRes = await fetch(origin + nfoFile.href, { headers: { 'Authorization': auth }});
        const parsed = new XMLParser({ ignoreAttributes: true }).parse(await nfoRes.text());
        setNfoDetails(parsed.movie || parsed.tvshow || parsed.episodedetails || parsed.video || movie.nfo);
      }
    } catch(e) {}
  };

  const scanEpisodes = async (origin, auth, rootPath) => {
    setLoadingEpisodes(true); let found = []; let queue = [rootPath]; let depthMap = { [rootPath]: 0 }; 
    try {
      while (queue.length > 0) {
        const currentPath = queue.shift(); const currentDepth = depthMap[currentPath];
        if (currentDepth > 2) continue; 
        const res = await fetch(origin + currentPath, { method: 'PROPFIND', headers: { 'Authorization': auth, 'Depth': '1' } });
        const items = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true }).parse(await res.text())?.multistatus?.response || [];
        const files = Array.isArray(items) ? items : [items];
        files.forEach(i => {
          let href = i.href.replace(/https?:\/\/[^\/]+/, '');
          let props = i.propstat?.prop || {}; let isFolder = props.resourcetype?.collection === '';
          if (isFolder && href !== currentPath && href !== currentPath.slice(0, -1)) {
            const cleanHref = href.endsWith('/') ? href : href + '/'; queue.push(cleanHref); depthMap[cleanHref] = currentDepth + 1;
          } else if (VIDEO_FORMATS.test(href)) {
            const size = Number(props.getcontentlength || 0);
            if (size >= MIN_VIDEO_SIZE) {
              found.push({ title: decodeURIComponent(href.split('/').pop()).replace(VIDEO_FORMATS, ''), url: origin + href, size: size });
            }
          }
        });
      }
      setEpisodes(found.sort((a, b) => a.title.localeCompare(b.title)));
    } catch (e) { } finally { setLoadingEpisodes(false); }
  };

  // 💡 修复：全屏自动横屏逻辑
  const onFullscreenUpdate = async ({ fullscreenUpdate }) => {
    // 0 = PLAYER_WILL_PRESENT (即将全屏), 1 = PLAYER_DID_PRESENT (已经全屏)
    if (fullscreenUpdate === 0 || fullscreenUpdate === 1) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } 
    // 2 = PLAYER_WILL_DISMISS (即将退出全屏), 3 = PLAYER_DID_DISMISS (已经退出全屏)
    else if (fullscreenUpdate === 2 || fullscreenUpdate === 3) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  };

  const closePlayerAndSaveProgress = async () => {
    // 退出播放器时，确保屏幕转回竖屏
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    
    const status = playbackStatusRef.current;
    if (status && activeVideoUrl) {
      const percent = (status.positionMillis / status.durationMillis) * 100;
      if (percent > 1 && percent < 95) {
        const progressRecord = { id: movie.id, title: movie.title, posterUrl: movie.posterUrl, percent: percent.toFixed(1), positionMillis: status.positionMillis, videoUrl: activeVideoUrl };
        try {
          let history = JSON.parse(await AsyncStorage.getItem('@media_playback_progress') || '[]');
          history = history.filter(h => h.id !== movie.id); history.unshift(progressRecord);
          if (history.length > 15) history.pop(); await AsyncStorage.setItem('@media_playback_progress', JSON.stringify(history));
        } catch(e) {}
      }
    }
    setActiveVideoUrl(null); playbackStatusRef.current = null;
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (millis) => {
    if (!millis) return "00:00";
    const totalSeconds = Math.floor(millis / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderInfoRow = (label, value) => {
    if (!value) return null;
    return (
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        <Text style={{ color: '#9ca3af', width: 80, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: '#e5e7eb', flex: 1, fontSize: 13 }}>{value}</Text>
      </View>
    );
  };

  // 💡 极客级数据面板渲染 (在简介下方显示)
  const renderGeekPanel = () => {
    const stream = nfoDetails?.fileinfo?.streamdetails;
    if (!stream) return null;

    const v = stream.video;
    const aList = Array.isArray(stream.audio) ? stream.audio : (stream.audio ? [stream.audio] : []);
    const sList = Array.isArray(stream.subtitle) ? stream.subtitle : (stream.subtitle ? [stream.subtitle] : []);

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 15 }}>
        {v && (
          <View style={styles.geekCard}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15}}>
              <VideoIcon color="#ffffff" size={18} /><Text style={styles.geekTitle}>视频</Text>
            </View>
            {renderInfoRow('分辨率', `${v.width}x${v.height}`)}
            {renderInfoRow('编码格式', v.codec?.toUpperCase())}
            {renderInfoRow('比特率', v.bitrate ? `${(v.bitrate/1000).toFixed(1)} Mbps` : '未知')}
            {renderInfoRow('帧速率', v.framerate ? `${v.framerate} fps` : '未知')}
            {renderInfoRow('宽高比', v.aspect)}
          </View>
        )}
        {aList.length > 0 && (
          <View style={styles.geekCard}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15}}>
              <AudioLines color="#ffffff" size={18} /><Text style={styles.geekTitle}>音频</Text>
            </View>
            {aList.map((a, i) => (
              <View key={i} style={{marginBottom: 10, paddingBottom: 10, borderBottomWidth: i===aList.length-1?0:1, borderBottomColor:'#374151'}}>
                {renderInfoRow(`音轨 ${i+1}`, a.language || '未知')}
                {renderInfoRow('编码', a.codec?.toUpperCase())}
                {renderInfoRow('声道', a.channels ? `${a.channels} ch` : '未知')}
              </View>
            ))}
          </View>
        )}
        {sList.length > 0 && (
          <View style={styles.geekCard}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15}}>
              <Subtitles color="#ffffff" size={18} /><Text style={styles.geekTitle}>字幕</Text>
            </View>
            {sList.map((s, i) => (
              <View key={i} style={{marginBottom: 4}}>
                {renderInfoRow(`字幕 ${i+1}`, s.language || '未知')}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  // 💡 播放器设置面板中的流信息
  const renderStreamDetailsForModal = () => {
    const stream = nfoDetails?.fileinfo?.streamdetails;
    if (!stream) return <Text style={styles.consoleText}>未找到媒体流数据</Text>;

    const audios = Array.isArray(stream.audio) ? stream.audio : (stream.audio ? [stream.audio] : []);
    const subs = Array.isArray(stream.subtitle) ? stream.subtitle : (stream.subtitle ? [stream.subtitle] : []);

    return (
      <View>
        <View style={styles.consoleRow}><AudioLines color="#9ca3af" size={18} /><Text style={styles.consoleTitle}>内嵌音轨 ({audios.length})</Text></View>
        {audios.length > 0 ? audios.map((a, i) => (
          <TouchableOpacity key={i} style={styles.consoleItem} onPress={() => Alert.alert('提示', '切换 MKV 内嵌音轨建议使用第三方专业播放器。')}>
            <Text style={styles.consoleItemText}>Track {i+1}: {a.codec?.toUpperCase()} {a.channels}Ch ({a.language||'未知'})</Text>
          </TouchableOpacity>
        )) : <Text style={styles.consoleText}>无独立音轨数据</Text>}

        <View style={[styles.consoleRow, { marginTop: 20 }]}><Subtitles color="#9ca3af" size={18} /><Text style={styles.consoleTitle}>内嵌字幕 ({subs.length})</Text></View>
        {subs.length > 0 ? subs.map((s, i) => (
          <TouchableOpacity key={i} style={styles.consoleItem} onPress={() => Alert.alert('提示', '内嵌软字幕渲染建议使用第三方专业播放器。')}>
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
            {/* 💡 这里是播放器的悬浮顶栏：有关闭按钮和设置按钮 */}
            <View style={styles.playerTopBar}>
              <TouchableOpacity style={styles.iconBtnLayer} onPress={closePlayerAndSaveProgress}>
                <X color="#ffffff" size={28} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtnLayer} onPress={() => setShowSettings(true)}>
                <Settings2 color="#ffffff" size={26} />
              </TouchableOpacity>
            </View>

            <Video
              ref={videoRef} style={styles.videoView} source={{ uri: activeVideoUrl, headers: { 'Authorization': authHeader } }}
              useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay
              onFullscreenUpdate={onFullscreenUpdate} // 💡 绑定全屏旋转事件
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
                  </View>

                  {/* 渲染音轨和字幕列表 */}
                  {renderStreamDetailsForModal()}

                  {/* 调用第三方播放器方案 */}
                  <TouchableOpacity style={styles.externalBtn} onPress={() => {
                    // 把账号密码拼进 URL 里，方便第三方播放器直接解析
                    const originAuth = `http://${username}:${password}@${davOrigin.replace('http://', '').replace('https://', '')}`;
                    const fullUrl = activeVideoUrl.replace(davOrigin, originAuth);
                    Share.share({ message: fullUrl });
                  }}>
                    <ExternalLink color="#ffffff" size={18} style={{marginRight: 8}}/>
                    <Text style={{color:'#fff', fontWeight:'bold'}}>发送给第三方播放器解码</Text>
                  </TouchableOpacity>
                  <Text style={{color:'#6b7280', fontSize: 11, textAlign:'center', marginTop:8, marginBottom: 40}}>受原生限制，多音轨与内嵌字幕推荐使用 VLC 或 Infuse 播放。</Text>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      )}

      {/* 详情页主视图 */}
      <ScrollView style={styles.scrollView} bounces={false}>
        <View style={styles.heroSection}>
          {movie.posterUrl ? <Image source={{ uri: movie.posterUrl, headers: { 'Authorization': authHeader } }} style={styles.backdropImage} /> : <View style={[styles.backdropImage, { backgroundColor: '#1f2937' }]} />}
          <BlurView intensity={80} tint="dark" style={styles.blurOverlay} />
          <View style={styles.heroGradient} />
          <TouchableOpacity style={styles.backBtn} onPress={() => { navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs') }}><ChevronLeft color="#ffffff" size={32} /></TouchableOpacity>

          <View style={styles.heroContent}>
            {movie.posterUrl ? <Image source={{ uri: movie.posterUrl, headers: { 'Authorization': authHeader } }} style={styles.mainPoster} /> : <View style={[styles.mainPoster, styles.fallbackPoster]}><Film color="#4b5563" size={48} /></View>}
            <View style={styles.heroTextContainer}>
              <Text style={styles.title} numberOfLines={2}>{nfoDetails?.title || movie.title}</Text>
              <View style={styles.metaRow}>
                {nfoDetails?.year && <Text style={styles.metaText}>{nfoDetails.year}</Text>}
                {nfoDetails?.rating && nfoDetails.rating !== '0.0' && <View style={styles.ratingBadge}><Text style={styles.ratingText}>{nfoDetails.rating}</Text></View>}
                <Text style={styles.typeBadge}>{movie.type === 'movie' ? '电影' : movie.type === 'tv' ? '剧集' : '动漫'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.plotTitle}>剧情简介</Text>
          <Text style={styles.plotText}>{nfoDetails?.plot || '暂无简介'}</Text>
          
          {/* 💡 这里就是复刻你截图中的横向三列极客面板！ */}
          {renderGeekPanel()}
        </View>

        <View style={styles.episodesSection}>
          <Text style={styles.plotTitle}>{movie.type === 'movie' ? '播放影片' : '选集播放'}</Text>
          {loadingEpisodes ? (
            <View style={styles.centerBox}><ActivityIndicator color="#3b82f6" size="large" /><Text style={{color:'#9ca3af', marginTop:10}}>正在匹配媒体流...</Text></View>
          ) : episodes.length === 0 ? (
            <View style={styles.centerBox}><MonitorPlay color="#4b5563" size={48} /><Text style={{color:'#9ca3af', marginTop:10}}>未找到支持的视频文件 (可能小于100MB或格式不支持)</Text></View>
          ) : (
            episodes.map((ep, index) => (
              <TouchableOpacity key={index} style={styles.episodeCard} onPress={() => handlePlay(ep.url)}>
                <View style={styles.episodeIconBox}><Play color="#ffffff" size={20} fill="#ffffff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.episodeTitle} numberOfLines={2}>{ep.title}</Text>
                  <Text style={styles.episodeSub}>{formatBytes(ep.size)}</Text>
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
  
  // 💡 极客横向卡片样式
  geekCard: { backgroundColor: 'rgba(31, 41, 55, 0.6)', padding: 16, borderRadius: 12, width: 220, marginRight: 12, borderWidth: 1, borderColor: 'rgba(55, 65, 81, 0.8)' },
  geekTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },

  episodesSection: { padding: 20, paddingTop: 0, paddingBottom: 50 },
  centerBox: { padding: 40, alignItems: 'center' },
  episodeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 3 },
  episodeIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  episodeTitle: { color: '#e5e7eb', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  episodeSub: { color: '#6b7280', fontSize: 12 },
  
  // 💡 播放器与控制台样式
  playerWrapper: { position: 'absolute', top: 0, left: 0, width: width, height: height, zIndex: 999, backgroundColor: '#000', justifyContent: 'center' },
  playerContainer: { flex: 1, justifyContent: 'center', position: 'relative' },
  playerTopBar: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 0, width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 1000 },
  iconBtnLayer: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  videoView: { width: '100%', height: height * 0.4 }, 
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  consolePanel: { backgroundColor: '#1f2937', height: height * 0.65, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  consoleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#374151' },
  statsCard: { backgroundColor: '#111827', padding: 16, borderRadius: 12, marginBottom: 20 },
  consoleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  consoleTitle: { color: '#e5e7eb', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  consoleText: { color: '#9ca3af', fontSize: 14, marginBottom: 6 },
  consoleItem: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#374151', borderRadius: 8, marginBottom: 8 },
  consoleItemText: { color: '#e5e7eb', fontSize: 14, fontWeight: '500' },
  
  externalBtn: { flexDirection: 'row', backgroundColor: '#8b5cf6', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20 }
});