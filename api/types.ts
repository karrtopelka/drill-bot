export type TiktokAPIResponse = {
  status: "success" | "error";
  message?: string;
  result?: {
      type: "video" | "image";
      id: string;
      createTime: number;
      description: string;
      author: AuthorTiktokAPI;
      statistics: StatisticsTiktokAPI;
      hashtag: string[];
      isTurnOffComment: boolean;
      isADS: boolean;
      cover?: string[];
      dynamicCover?: string[];
      originCover?: string[];
      video?: VideoTiktokAPI;
      images?: string[];
      music: MusicTiktokAPI;
  };
  resultNotParsed?: any;
};
export type AuthorTiktokAPI = {
  uid: number;
  username: string;
  nickname: string;
  signature: string;
  region: string;
  avatarThumb: string[];
  avatarMedium: string[];
  url: string;
};
export type StatisticsTiktokAPI = {
  playCount: number;
  downloadCount: number;
  shareCount: number;
  commentCount: number;
  diggCount: number;
  collectCount: number;
  forwardCount: number;
  whatsappShareCount: number;
  loseCount: number;
  loseCommentCount: number;
  repostCount: number;
};
export type VideoTiktokAPI = {
  ratio: string;
  duration: number;
  playAddr: string[];
  downloadAddr: string[];
  cover: string[];
  dynamicCover: string[];
  originCover: string[];
};
export type MusicTiktokAPI = {
  id: number;
  title: string;
  author: string;
  album: string;
  playUrl: string[];
  coverLarge: string[];
  coverMedium: string[];
  coverThumb: string[];
  duration: number;
  isCommerceMusic: boolean;
  isOriginalSound: boolean;
  isAuthorArtist: boolean;
};
export type ResponseParserTiktokAPI = {
  content?: any;
  statistics?: StatisticsTiktokAPI;
  author?: AuthorTiktokAPI;
  music?: MusicTiktokAPI;
};

export type SSSTikFetchTT = {
  status: "success" | "error";
  message?: string;
  result?: string;
};
export type SSSTikResponse = {
  status: "success" | "error";
  message?: string;
  result?: {
      type: "image" | "video" | "music";
      desc?: string;
      author?: AuthorSSSTik;
      statistics?: StatisticsSSSTik;
      images?: string[];
      video?: string;
      music?: string;
      direct?: string;
  };
};
export type AuthorSSSTik = {
  avatar: string;
  nickname: string;
};
export type StatisticsSSSTik = {
  likeCount: string;
  commentCount: string;
  shareCount: string;
};

export type GetMusicalDownReuqest = {
  status: "success" | "error";
  request?: {
      [key: string]: string;
  };
  message?: string;
  cookie?: string;
};
export type MusicalDownResponse = {
  status: "success" | "error";
  message?: string;
  result?: {
      type: "video" | "image";
      desc?: string;
      author?: {
          avatar?: string;
          nickname?: string;
      };
      music?: string;
      images?: string[];
      videoHD?: string;
      videoWatermark?: string;
  };
};
export type GetMusicalDownMusic = {
  status: "success" | "error";
  result?: string;
};

export type TiktokDownloaderResponse<T extends "v1" | "v2" | "v3"> = T extends "v1" ? TiktokAPIResponse : T extends "v2" ? SSSTikResponse : T extends "v3" ? MusicalDownResponse : TiktokAPIResponse;
