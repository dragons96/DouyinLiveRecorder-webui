"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { formatBytes, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Play, Download, FileVideo, Info, ExternalLink, AlertTriangle } from "lucide-react"
import Hls from "hls.js"
import type { ErrorData, ErrorTypes } from "hls.js"

interface VideoFile {
  id: string
  filename: string
  originalFilename: string
  fileSize: number
  fileType: string
  recordName: string
  createdAt: string
  taskName: string | null
  periodInfo: {
    id: string
    startedAt: string
    endedAt: string | null
  } | null
  metadata: {
    recordUrl: string | null
    deviceId: string | null
    uploadTime: string
  } | null
}

interface TaskVideosProps {
  taskId: string
  className?: string
}

// 视频播放器组件类型定义
type VideoPlayerProps = {
  video: VideoFile; 
  videoRef: React.RefObject<HTMLVideoElement>;
  hlsRef: React.RefObject<Hls | null>;
  playbackError: boolean;
  onClose: () => void;
}

// 排序方向
type SortDirection = 'asc' | 'desc';

export function TaskVideos({ taskId, className }: TaskVideosProps) {
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null)
  const [videoDialogOpen, setVideoDialogOpen] = useState<boolean>(false)
  const [infoDialogOpen, setInfoDialogOpen] = useState<boolean>(false)
  const [playbackError, setPlaybackError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  
  // 筛选和分页状态
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRecordUrl, setSelectedRecordUrl] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [sortField, setSortField] = useState<'filename' | 'fileSize' | 'createdAt'>('filename')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [recordUrls, setRecordUrls] = useState<string[]>([])
  
  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true)
      try {
        // 构建查询参数
        const params = new URLSearchParams({
          page: currentPage.toString(),
          pageSize: itemsPerPage.toString(),
          sortField: sortField,
          sortDirection: sortDirection
        })
        
        if (searchTerm) {
          params.append('searchTerm', searchTerm)
        }
        
        if (selectedRecordUrl) {
          params.append('recordUrl', selectedRecordUrl)
        }
        
        const response = await fetch(`/api/videos/task/${taskId}?${params.toString()}`)
        if (!response.ok) {
          throw new Error(`获取视频失败: ${response.statusText}`)
        }
        
        const data = await response.json()
        if (data.success) {
          setVideos(data.data)
          
          // 更新分页信息
          if (data.pagination) {
            setTotalItems(data.pagination.totalCount)
            setTotalPages(data.pagination.totalPages)
          }
          
          // 更新筛选选项
          if (data.filterOptions?.recordUrls) {
            setRecordUrls(data.filterOptions.recordUrls)
          }
        } else {
          throw new Error(data.error || "获取视频失败")
        }
      } catch (err: any) {
        setError(err.message || "获取视频时出错")
        console.error("获取视频出错:", err)
      } finally {
        setLoading(false)
      }
    }

    if (taskId) {
      fetchVideos()
    }
  }, [taskId, currentPage, itemsPerPage, searchTerm, selectedRecordUrl, sortField, sortDirection])
  
  // 处理页面切换
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }
  
  // 处理每页显示数量变化
  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items)
    setCurrentPage(1) // 重置到第一页
  }
  
  // 处理排序切换
  const handleSortChange = (field: 'filename' | 'fileSize' | 'createdAt') => {
    if (field === sortField) {
      // 如果点击的是当前排序字段，则切换排序方向
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // 如果点击的是新字段，则设置新字段并默认升序
      setSortField(field)
      setSortDirection('asc')
    }
  }
  
  // 处理搜索
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1) // 搜索时重置到第一页
  }
  
  // 处理视频链接选择变化
  const handleRecordUrlChange = (url: string) => {
    setSelectedRecordUrl(url)
    setCurrentPage(1) // 筛选变化时重置到第一页
  }

  const handlePlayVideo = (video: VideoFile) => {
    setSelectedVideo(video)
    setVideoDialogOpen(true)
    setPlaybackError(false)
    
    // 使用setTimeout确保状态已更新且DOM已渲染
    setTimeout(() => {
      if (videoRef.current) {
        console.log('初始化视频播放器');
        // 直接初始化视频播放，不再使用自定义事件
        const videoElement = videoRef.current;
        
        // 根据文件类型选择播放方式
        if (video.fileType?.toLowerCase() === 'ts' && Hls.isSupported()) {
          console.log('使用HLS播放TS文件');
          
          // 如果已存在HLS实例，先销毁它
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          
          const hls = new Hls({
            debug: true,
            fragLoadingTimeOut: 120000,
            manifestLoadingTimeOut: 120000,
            levelLoadingTimeOut: 120000,
          });
          
          const m3u8Url = getVideoM3u8Url(video.id);
          console.log('加载HLS m3u8:', m3u8Url);
          
          hls.loadSource(m3u8Url);
          hls.attachMedia(videoElement);
          
          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            console.log('HLS媒体已附加');
            videoElement.play().catch(err => {
              console.error('自动播放失败:', err);
            });
          });
          
          hlsRef.current = hls;
        } else {
          // 对于非TS文件或不支持HLS的情况，使用标准HTML5播放
          const videoUrl = getVideoStreamUrl(video.id);
          console.log('使用标准播放:', videoUrl);
          videoElement.src = videoUrl;
          videoElement.load();
          videoElement.play().catch(err => {
            console.error('自动播放失败:', err);
          });
        }
      }
    }, 300); // 增加延迟确保对话框已完全打开
  }

  const handleViewInfo = (video: VideoFile) => {
    setSelectedVideo(video)
    setInfoDialogOpen(true)
  }

  const handleDownload = (video: VideoFile) => {
    // 创建下载链接
    const link = document.createElement("a")
    link.href = `/api/videos/stream/${video.id}`
    link.setAttribute("download", video.originalFilename || video.recordName || video.filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 获取视频流URL
  const getVideoStreamUrl = (videoId: string): string => {
    // 我们只需要普通的URL，不再需要force_mp4参数
    return `/api/videos/stream/${videoId}`;
  }

  // 获取视频m3u8 URL (用于HLS播放)
  const getVideoM3u8Url = (videoId: string): string => {
    return `/api/videos/m3u8/${videoId}`;
  }

  // 处理视频播放错误
  const handleVideoError = () => {
    setPlaybackError(true)
  }

  // 渲染视频文件类型徽章
  const renderFileTypeBadge = (fileType: string) => {
    const type = fileType.toLowerCase()
    let variant: "default" | "secondary" | "outline" | "destructive" = "outline"
    
    if (type === "flv" || type === "raw") {
      variant = "default"
    } else if (type === "mp4" || type === "converted") {
      variant = "secondary"
    } else if (type === "ts") {
      variant = "destructive" // 使用红色突出显示TS格式
    }
    
    return <Badge variant={variant}>{fileType}</Badge>
  }

  // 获取视频播放UI组件
  const renderPlaybackModeControls = () => {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium mb-1">播放模式</div>
        <div className="flex flex-wrap gap-2">
          <Button 
            size="sm" 
            variant="default"
            onClick={() => handlePlayVideo(selectedVideo!)}
          >
            自动播放
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          自动模式：在浏览器中播放视频
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={handlePreviousVideo}
            disabled={!canPlayPreviousVideo()}
          >
            上一个视频
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleNextVideo}
            disabled={!canPlayNextVideo()}
          >
            下一个视频
          </Button>
        </div>
      </div>
    );
  }

  // 检查是否可以播放上一个视频
  const canPlayPreviousVideo = (): boolean => {
    if (!selectedVideo || videos.length === 0) return false;
    const currentIndex = videos.findIndex(video => video.id === selectedVideo.id);
    // 第一页的第一个视频不能再往前
    return !(currentIndex === 0 && currentPage === 1);
  }
  
  // 检查是否可以播放下一个视频
  const canPlayNextVideo = (): boolean => {
    if (!selectedVideo || videos.length === 0) return false;
    const currentIndex = videos.findIndex(video => video.id === selectedVideo.id);
    // 最后一页的最后一个视频不能再往后
    return !(currentIndex === videos.length - 1 && currentPage === totalPages);
  }
  
  // 处理上一个视频播放
  const handlePreviousVideo = async () => {
    if (!selectedVideo || videos.length === 0) return;
    
    const currentIndex = videos.findIndex(video => video.id === selectedVideo.id);
    if (currentIndex > 0) {
      // 当前页内有上一个视频
      const previousVideo = videos[currentIndex - 1];
      handlePlayVideo(previousVideo);
    } else if (currentPage > 1) {
      // 需要加载上一页
      try {
        setLoading(true);
        const previousPage = currentPage - 1;
        
        // 构建查询参数
        const params = new URLSearchParams({
          page: previousPage.toString(),
          pageSize: itemsPerPage.toString(),
          sortField: sortField,
          sortDirection: sortDirection
        });
        
        if (searchTerm) {
          params.append('searchTerm', searchTerm);
        }
        
        if (selectedRecordUrl) {
          params.append('recordUrl', selectedRecordUrl);
        }
        
        const response = await fetch(`/api/videos/task/${taskId}?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`获取上一页视频失败: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data.success) {
          // 更新页码和视频列表
          setCurrentPage(previousPage);
          setVideos(data.data);
          
          if (data.pagination) {
            setTotalItems(data.pagination.totalCount);
            setTotalPages(data.pagination.totalPages);
          }
          
          // 选择最后一个视频
          if (data.data.length > 0) {
            const lastVideo = data.data[data.data.length - 1];
            setSelectedVideo(lastVideo);
            
            // 使用setTimeout确保状态已更新且DOM已渲染
            setTimeout(() => {
              if (videoRef.current) {
                console.log('加载上一页最后一个视频');
                const videoElement = videoRef.current;
                
                // 根据文件类型选择播放方式
                if (lastVideo.fileType?.toLowerCase() === 'ts' && Hls.isSupported()) {
                  console.log('使用HLS播放TS文件');
                  
                  // 如果已存在HLS实例，先销毁它
                  if (hlsRef.current) {
                    hlsRef.current.destroy();
                    hlsRef.current = null;
                  }
                  
                  const hls = new Hls({
                    debug: true,
                    fragLoadingTimeOut: 120000,
                    manifestLoadingTimeOut: 120000,
                    levelLoadingTimeOut: 120000,
                  });
                  
                  const m3u8Url = getVideoM3u8Url(lastVideo.id);
                  console.log('加载HLS m3u8:', m3u8Url);
                  
                  hls.loadSource(m3u8Url);
                  hls.attachMedia(videoElement);
                  
                  hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                    console.log('HLS媒体已附加');
                    videoElement.play().catch(err => {
                      console.error('自动播放失败:', err);
                    });
                  });
                  
                  hlsRef.current = hls;
                } else {
                  // 对于非TS文件或不支持HLS的情况，使用标准HTML5播放
                  const videoUrl = getVideoStreamUrl(lastVideo.id);
                  console.log('使用标准播放:', videoUrl);
                  videoElement.src = videoUrl;
                  videoElement.load();
                  videoElement.play().catch(err => {
                    console.error('自动播放失败:', err);
                  });
                }
              }
            }, 300);
          }
        } else {
          throw new Error(data.error || "获取上一页视频失败");
        }
      } catch (err: any) {
        console.error("获取上一页视频出错:", err);
        setError(err.message || "获取视频时出错");
      } finally {
        setLoading(false);
      }
    }
  }
  
  // 处理下一个视频播放
  const handleNextVideo = async () => {
    if (!selectedVideo || videos.length === 0) return;
    
    const currentIndex = videos.findIndex(video => video.id === selectedVideo.id);
    if (currentIndex !== -1 && currentIndex < videos.length - 1) {
      // 当前页内有下一个视频
      const nextVideo = videos[currentIndex + 1];
      handlePlayVideo(nextVideo);
    } else if (currentPage < totalPages) {
      // 需要加载下一页
      try {
        setLoading(true);
        const nextPage = currentPage + 1;
        
        // 构建查询参数
        const params = new URLSearchParams({
          page: nextPage.toString(),
          pageSize: itemsPerPage.toString(),
          sortField: sortField,
          sortDirection: sortDirection
        });
        
        if (searchTerm) {
          params.append('searchTerm', searchTerm);
        }
        
        if (selectedRecordUrl) {
          params.append('recordUrl', selectedRecordUrl);
        }
        
        const response = await fetch(`/api/videos/task/${taskId}?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`获取下一页视频失败: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data.success) {
          // 更新页码和视频列表
          setCurrentPage(nextPage);
          setVideos(data.data);
          
          if (data.pagination) {
            setTotalItems(data.pagination.totalCount);
            setTotalPages(data.pagination.totalPages);
          }
          
          // 选择第一个视频
          if (data.data.length > 0) {
            const firstVideo = data.data[0];
            setSelectedVideo(firstVideo);
            
            // 使用setTimeout确保状态已更新且DOM已渲染
            setTimeout(() => {
              if (videoRef.current) {
                console.log('加载下一页第一个视频');
                const videoElement = videoRef.current;
                
                // 根据文件类型选择播放方式
                if (firstVideo.fileType?.toLowerCase() === 'ts' && Hls.isSupported()) {
                  console.log('使用HLS播放TS文件');
                  
                  // 如果已存在HLS实例，先销毁它
                  if (hlsRef.current) {
                    hlsRef.current.destroy();
                    hlsRef.current = null;
                  }
                  
                  const hls = new Hls({
                    debug: true,
                    fragLoadingTimeOut: 120000,
                    manifestLoadingTimeOut: 120000,
                    levelLoadingTimeOut: 120000,
                  });
                  
                  const m3u8Url = getVideoM3u8Url(firstVideo.id);
                  console.log('加载HLS m3u8:', m3u8Url);
                  
                  hls.loadSource(m3u8Url);
                  hls.attachMedia(videoElement);
                  
                  hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                    console.log('HLS媒体已附加');
                    videoElement.play().catch(err => {
                      console.error('自动播放失败:', err);
                    });
                  });
                  
                  hlsRef.current = hls;
                } else {
                  // 对于非TS文件或不支持HLS的情况，使用标准HTML5播放
                  const videoUrl = getVideoStreamUrl(firstVideo.id);
                  console.log('使用标准播放:', videoUrl);
                  videoElement.src = videoUrl;
                  videoElement.load();
                  videoElement.play().catch(err => {
                    console.error('自动播放失败:', err);
                  });
                }
              }
            }, 300);
          }
        } else {
          throw new Error(data.error || "获取下一页视频失败");
        }
      } catch (err: any) {
        console.error("获取下一页视频出错:", err);
        setError(err.message || "获取视频时出错");
      } finally {
        setLoading(false);
      }
    }
  }

  // 使用hls.js加载视频
  useEffect(() => {
    if (!selectedVideo || !videoRef.current) return;
    
    // 仅在视频对话框打开且之前没有初始化过播放器的情况下再初始化
    // 添加这个videoRef.current.src检查可避免重复初始化
    if (!videoDialogOpen || videoRef.current.src) return;
    
    console.log('useEffect中监听到状态变化，初始化视频播放: ', selectedVideo.fileType);
    
    const videoElement = videoRef.current;
    
    // 重置错误状态
    setPlaybackError(false);
    
    // 创建处理视频错误的函数
    const handleVideoError = (e: Event) => {
      console.error('视频元素错误事件:', e);
      // 尝试获取更详细的错误信息
      const videoEl = e.target as HTMLVideoElement;
      console.error('视频元素错误详情:', {
        error: videoEl.error,
        networkState: videoEl.networkState,
        readyState: videoEl.readyState,
        currentSrc: videoEl.currentSrc,
        paused: videoEl.paused
      });
      setPlaybackError(true);
    };
    
    // 监听视频错误事件
    videoElement.addEventListener('error', handleVideoError);
    
    // 返回清理函数
    return () => {
      console.log('清理视频播放器资源');
      videoElement.removeEventListener('error', handleVideoError);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedVideo, videoDialogOpen]);

  // 添加VideoPlayer组件
  function VideoPlayer({ video, videoRef, hlsRef, playbackError, onClose }: VideoPlayerProps) {
    // 显示播放错误状态
    if (playbackError) {
      return (
        <div className="flex flex-col items-center justify-center py-6 space-y-3">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <h3 className="text-lg font-semibold">播放错误</h3>
          <p className="text-center text-sm">无法播放该视频。可能是格式不支持或视频已损坏。</p>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => window.open(getVideoStreamUrl(video.id), '_blank')}>
              <ExternalLink className="mr-2 h-4 w-4" />
              在新窗口打开
            </Button>
            <Button asChild size="sm">
              <a 
                href={getVideoStreamUrl(video.id)} 
                download={video.originalFilename || video.recordName || video.filename}
              >
                <Download className="mr-2 h-4 w-4" />
                下载视频
              </a>
            </Button>
          </div>
          <Button variant="outline" onClick={onClose} size="sm">关闭</Button>
        </div>
      )
    }
    
    // 正常播放视频
    return (
      <div className="flex flex-col space-y-4">
        <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-contain"
            controls
            controlsList="nodownload"
            preload="auto"
            autoPlay
            onError={(e) => {
              // 注意：通常不需要在这里进行处理，因为我们已经添加了addEventListener
              // 但为了冗余起见，还是保留这个处理
              console.error('视频元素onError回调:', e);
            }}
            onLoadStart={() => console.log('视频开始加载')}
            onLoadedData={() => console.log('视频数据已加载')}
            onCanPlay={() => console.log('视频可以播放')}
          />
        </div>
        <div className="flex justify-between">
          <div>
            <h3 className="text-lg font-medium">
              {video.originalFilename || video.recordName || video.filename}
            </h3>
            <p className="text-muted-foreground">{formatBytes(video.fileSize)}</p>
          </div>
          <Button asChild>
            <a 
              href={getVideoStreamUrl(video.id)} 
              download={video.originalFilename || video.recordName || video.filename}
            >
              <Download className="mr-2 h-4 w-4" />
              下载视频
            </a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>录制视频列表</CardTitle>
        <CardDescription>任务录制的所有视频文件</CardDescription>
        
        {/* 搜索和过滤区域 */}
        <div className="mt-4 space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 视频链接下拉选择 */}
                <div>
                  <label htmlFor="recordUrl" className="text-sm font-medium block mb-1">视频链接</label>
                  <select
                    id="recordUrl"
                    value={selectedRecordUrl}
                    onChange={(e) => handleRecordUrlChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md border-input bg-background"
                  >
                    <option value="">全部视频链接</option>
                    {recordUrls.map((url) => (
                      <option key={url} value={url}>
                        {url.length > 50 ? `${url.substring(0, 50)}...` : url}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* 文件名搜索 */}
                <div>
                  <label htmlFor="searchTerm" className="text-sm font-medium block mb-1">文件名搜索</label>
                  <div className="flex">
                    <input
                      id="searchTerm"
                      type="text"
                      placeholder="搜索视频名称..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border rounded-l-md border-input bg-background"
                    />
                    <Button type="submit" className="rounded-l-none">搜索</Button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-end">
              <div className="flex items-center gap-2">
                <label htmlFor="itemsPerPage" className="text-sm whitespace-nowrap">每页显示:</label>
                <select 
                  id="itemsPerPage"
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="px-2 py-2 border rounded-md border-input bg-background"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </form>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-6">加载视频中...</div>
        ) : error ? (
          <div className="text-center py-6 text-destructive">{error}</div>
        ) : videos.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            {totalItems > 0 ? "没有找到匹配的视频" : "暂无视频文件"}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent/20 transition-colors"
                    onClick={() => handleSortChange('filename')}
                  >
                    文件名
                    {sortField === 'filename' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent/20 transition-colors"
                    onClick={() => handleSortChange('fileSize')}
                  >
                    大小
                    {sortField === 'fileSize' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent/20 transition-colors"
                    onClick={() => handleSortChange('createdAt')}
                  >
                    上传时间
                    {sortField === 'createdAt' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell className="font-medium">
                      {video.originalFilename || video.recordName || video.filename}
                      {video.metadata?.recordUrl && (
                        <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                          {video.metadata.recordUrl}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{renderFileTypeBadge(video.fileType)}</TableCell>
                    <TableCell>{formatBytes(video.fileSize)}</TableCell>
                    <TableCell>{formatDate(video.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handlePlayVideo(video)} 
                          title="播放视频"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDownload(video)} 
                          title="下载视频"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleViewInfo(video)} 
                          title="视频信息"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-muted-foreground">
                  显示 {totalItems} 个视频中的 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} 个
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  >
                    首页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    上一页
                  </Button>
                  <span className="px-3 py-1 border rounded-md text-sm flex items-center">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    下一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    末页
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* 视频播放对话框 */}
        <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-2">
              <DialogTitle>
                <div className="flex items-center gap-2">
                  <span>视频播放</span>
                  {selectedVideo && renderFileTypeBadge(selectedVideo.fileType)}
                </div>
              </DialogTitle>
              {selectedVideo && (
                <DialogDescription>
                  {selectedVideo.originalFilename || selectedVideo.recordName || selectedVideo.filename}
                  {selectedVideo.metadata?.recordUrl && (
                    <a 
                      href={selectedVideo.metadata.recordUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center text-primary text-sm hover:underline mt-1"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {selectedVideo.metadata.recordUrl}
                    </a>
                  )}
                </DialogDescription>
              )}
            </DialogHeader>
            
            {/* 播放模式选择 */}
            {renderPlaybackModeControls()}
            
            {/* 视频播放器或错误提示 */}
            <div className="mt-4">
              {selectedVideo && (
                <VideoPlayer 
                  video={selectedVideo}
                  videoRef={videoRef as React.RefObject<HTMLVideoElement>}
                  hlsRef={hlsRef} 
                  playbackError={playbackError} 
                  onClose={() => setVideoDialogOpen(false)} 
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* 视频信息对话框 */}
        <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>视频详细信息</DialogTitle>
            </DialogHeader>
            {selectedVideo && (
              <div className="grid gap-4 py-2">
                <div className="flex items-center justify-center mb-4">
                  <FileVideo className="h-16 w-16 text-primary" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="font-medium">文件名</div>
                  <div className="col-span-2 break-all">{selectedVideo.filename}</div>
                  
                  <div className="font-medium">原始文件名</div>
                  <div className="col-span-2 break-all">{selectedVideo.originalFilename || "-"}</div>
                  
                  <div className="font-medium">记录名称</div>
                  <div className="col-span-2">{selectedVideo.recordName || "-"}</div>
                  
                  <div className="font-medium">记录URL</div>
                  <div className="col-span-2 break-all">
                    {selectedVideo.metadata?.recordUrl ? (
                      <a 
                        href={selectedVideo.metadata.recordUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {selectedVideo.metadata.recordUrl}
                      </a>
                    ) : "-"}
                  </div>
                  
                  <div className="font-medium">文件类型</div>
                  <div className="col-span-2">{selectedVideo.fileType}</div>
                  
                  <div className="font-medium">文件大小</div>
                  <div className="col-span-2">{formatBytes(selectedVideo.fileSize)}</div>
                  
                  <div className="font-medium">上传时间</div>
                  <div className="col-span-2">{formatDate(selectedVideo.createdAt)}</div>
                  
                  <div className="font-medium">设备ID</div>
                  <div className="col-span-2 break-all">{selectedVideo.metadata?.deviceId || "-"}</div>
                  
                  <div className="font-medium">周期信息</div>
                  <div className="col-span-2">
                    {selectedVideo.periodInfo ? (
                      <>
                        开始: {formatDate(selectedVideo.periodInfo.startedAt)}
                        <br />
                        结束: {selectedVideo.periodInfo.endedAt ? formatDate(selectedVideo.periodInfo.endedAt) : "进行中"}
                      </>
                    ) : "-"}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
} 