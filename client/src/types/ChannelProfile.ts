export interface ChannelProfile {
  id: number;
  profile_name: string;
  series_name?: string;
  is_default: boolean;
  destination_path?: string;
  naming_template: string;
  season_number: number;
  episode_counter: number;
  generate_nfo: boolean;
  enabled: boolean;
  filters: ProfileFilter[];
}

export interface ProfileFilter {
  id?: number;
  filter_type: 'title_regex' | 'title_contains' | 'duration_range';
  filter_value: string;
  priority: number;
}