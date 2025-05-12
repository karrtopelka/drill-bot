declare module 'ruhend-scraper' {
  export function ttdl(url: string): Promise<{
    region: string
    title: string
    avatar: string
    author: string
    username: string
    comment: string
    views: string
    cover: string
    like: string
    bookmark: string
    published: string
    video: string
    video_wm: string
    video_hd: string
    music: string
    duration: string
  }>;
}
