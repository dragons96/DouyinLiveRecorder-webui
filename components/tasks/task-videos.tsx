import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Video, Download, Eye, BarChart4, Info } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RecordingTask } from "@/types";

interface TaskVideosProps {
  taskId: string;
  canManageVideos?: boolean;
}

type VideoFile = {
  id: string;
  filename: string;
  originalFilename: string | null;
  filePath: string;
  fileSize: number;
  fileType: string;
  recordName: string;
  metadata: string | null;
  uploadedAt: string;
  url: string;
  formattedSize: string;
};

type VideoMetadata = {
  recordUrl: string | null;
  deviceId: string | null;
  uploadTime: string;
  [key: string]: any;
};

type VideoStats = {
  totalVideos: number;
  totalSizeBytes: number;
  totalSizeMB: number;
  videosByType: Array<{
    fileType: string;
    count: number;
    totalSize: number;
  }>;
  recentVideos: Array<{
    id: string;
    filename: string;
    fileType: string;
    fileSize: number;
    uploadedAt: string;
  }>;
};

export function TaskVideos({ taskId, canManageVideos = false }: TaskVideosProps) {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  // 获取任务相关的视频文件
  const fetchVideos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/videos`);
      
      if (!response.ok) {
        throw new Error(`获取视频失败: ${response.status}`);
      }
      
      const data = await response.json();
      setVideos(data);
    } catch (error: any) {
      console.error("获取视频时出错:", error);
      setError(error.message || "获取视频时出错");
      toast.error(error.message || "获取视频时出错");
    } finally {
      setIsLoading(false);
    }
  };

  // 获取视频统计信息
  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/videos/stats`);
      
      if (!response.ok) {
        throw new Error(`获取统计信息失败: ${response.status}`);
      }
      
      const data = await response.json();
      setStats(data);
    } catch (error: any) {
      console.error("获取统计信息时出错:", error);
      toast.error(error.message || "获取统计信息时出错");
    } finally {
      setIsLoadingStats(false);
    }
  };

  // 组件挂载时获取视频列表和统计信息
  useEffect(() => {
    fetchVideos();
    fetchStats();
  }, [taskId]);

  // 获取视频文件类型的颜色
  const getVideoTypeBadge = (fileType: string) => {
    switch (fileType.toUpperCase()) {
      case 'MP4':
        return <Badge className="bg-blue-500">MP4</Badge>;
      case 'TS':
        return <Badge className="bg-green-500">TS</Badge>;
      case 'FLV':
        return <Badge className="bg-purple-500">FLV</Badge>;
      default:
        return <Badge>{fileType}</Badge>;
    }
  };

  // 解析视频元数据
  const parseMetadata = (metadataStr: string | null): VideoMetadata | null => {
    if (!metadataStr) return null;
    try {
      return JSON.parse(metadataStr);
    } catch (error) {
      console.error("解析元数据失败:", error);
      return null;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg font-medium">录制视频文件</CardTitle>
            {stats && (
              <CardDescription>
                共 {stats.totalVideos} 个文件，总大小 {stats.totalSizeMB.toFixed(2)} MB
              </CardDescription>
            )}
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setShowStats(!showStats);
                if (!stats && !isLoadingStats) {
                  fetchStats();
                }
              }}
              disabled={isLoadingStats}
            >
              {isLoadingStats ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <BarChart4 className="h-4 w-4 mr-1" />
              )}
              {showStats ? '隐藏统计' : '显示统计'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                fetchVideos();
                fetchStats();
              }}
              disabled={isLoading || isLoadingStats}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              刷新
            </Button>
          </div>
        </CardHeader>
        
        {showStats && stats && (
          <CardContent className="border-b pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="text-sm font-medium mb-2">文件类型分布</h3>
                <div className="space-y-2">
                  {stats.videosByType.length > 0 ? (
                    stats.videosByType.map((item: any) => (
                      <div key={item.fileType} className="flex justify-between items-center">
                        <div className="flex items-center">
                          {getVideoTypeBadge(item.fileType)}
                          <span className="ml-2">{item.count} 个文件</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {(item.totalSize / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无数据</p>
                  )}
                </div>
              </div>
              
              <div className="md:col-span-2">
                <h3 className="text-sm font-medium mb-2">最近上传</h3>
                <div className="space-y-2">
                  {stats.recentVideos.length > 0 ? (
                    stats.recentVideos.map((video) => (
                      <div key={video.id} className="flex justify-between items-center text-sm">
                        <div className="flex items-center">
                          <span className="truncate max-w-56">{video.filename}</span>
                          {getVideoTypeBadge(video.fileType)}
                        </div>
                        <div className="flex items-center text-muted-foreground">
                          <span>{(video.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                          <span className="mx-2">•</span>
                          <span>{formatDateTime(video.uploadedAt, false, true) as string}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无数据</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        )}
        
        <CardContent>
          {isLoading && videos.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-red-500 mb-2">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchVideos}>
                <RefreshCw className="h-4 w-4 mr-1" />
                重试
              </Button>
            </div>
          ) : videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Video className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">暂无录制视频文件</p>
              <p className="text-sm text-muted-foreground mt-1">录制完成后的视频将在这里显示</p>
            </div>
          ) : (
            <div className="space-y-4">
              {videos.map((video) => {
                const metadata = parseMetadata(video.metadata);
                return (
                  <div 
                    key={video.id} 
                    className="flex flex-col border rounded-md p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate" title={video.originalFilename || video.filename}>
                            {video.originalFilename || video.filename}
                          </h3>
                          {getVideoTypeBadge(video.fileType)}
                          {metadata && metadata.recordUrl && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1 max-w-xs">
                                  <p><strong>录制URL:</strong> {metadata.recordUrl}</p>
                                  {metadata.deviceId && <p><strong>设备ID:</strong> {metadata.deviceId}</p>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          上传时间: {formatDateTime(video.uploadedAt, false, true) as string}
                        </p>
                        {metadata && metadata.recordUrl && (
                          <p className="text-xs text-muted-foreground truncate" title={metadata.recordUrl}>
                            源URL: {metadata.recordUrl}
                          </p>
                        )}
                      </div>
                      <div className="text-sm bg-muted px-2 py-1 rounded">
                        {video.formattedSize}
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 mt-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        asChild
                      >
                        <a href={video.url} target="_blank" rel="noopener noreferrer">
                          <Eye className="h-4 w-4 mr-1" />
                          播放
                        </a>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        asChild
                      >
                        <a href={`${video.url}?download=true`} download>
                          <Download className="h-4 w-4 mr-1" />
                          下载
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 