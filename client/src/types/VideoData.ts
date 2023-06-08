/*export interface VideoData {
  youtubeId: string;
  youTubeChannelName: string;
  youTubeVideoName: string;
  duration: number;
}*/

export interface VideoData {
  id: number;
  youtubeId: string;
  youTubeChannelName: string;
  youTubeVideoName: string;
  timeCreated: string;
  originalDate: string;
  duration: number;
  description: string;
}
