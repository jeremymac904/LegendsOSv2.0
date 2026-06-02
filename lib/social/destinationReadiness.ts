import type { SocialChannel } from "@/types/database";

export interface SocialDestinationRow {
  platform: SocialChannel | string;
  status: string | null;
  is_publish_enabled: boolean;
}

export interface SocialPublishGate {
  has_any_selected_destination: boolean;
  channels: Record<
    SocialChannel,
    {
      selected: boolean;
      publish_enabled: boolean;
    }
  >;
}

function emptyChannelState() {
  return { selected: false, publish_enabled: false };
}

export function buildSocialPublishGate(
  rows: SocialDestinationRow[]
): SocialPublishGate {
  const channels: SocialPublishGate["channels"] = {
    facebook: emptyChannelState(),
    instagram: emptyChannelState(),
    google_business_profile: emptyChannelState(),
    youtube: emptyChannelState(),
  };

  for (const row of rows) {
    if (!(row.platform in channels)) continue;
    const key = row.platform as SocialChannel;
    channels[key].selected = true;
    channels[key].publish_enabled =
      channels[key].publish_enabled || (row.status === "connected" && row.is_publish_enabled);
  }

  return {
    has_any_selected_destination: rows.length > 0,
    channels,
  };
}
