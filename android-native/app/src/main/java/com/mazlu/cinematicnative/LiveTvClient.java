package com.mazlu.cinematicnative;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;

final class LiveTvClient {
    List<LiveChannel> fetch(Context context) throws Exception {
        String url = BackendConfig.buildUrl(context, "/api/live-channels", null);
        JSONObject root = NetJson.get(url);
        if (!root.optBoolean("ok", false)) {
            throw new IllegalStateException(root.optString("error", "Canli TV verisi alinamadi"));
        }

        JSONObject groups = root.optJSONObject("groups");
        if (groups == null) return new ArrayList<>();

        List<LiveChannel> channels = new ArrayList<>();
        Iterator<String> keys = groups.keys();
        while (keys.hasNext()) {
            String group = keys.next();
            JSONArray items = groups.optJSONArray(group);
            if (items == null) continue;
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                String streamUrl = item.optString("url", "");
                if (streamUrl.isEmpty()) continue;

                List<String> backups = new ArrayList<>();
                JSONArray backupArr = item.optJSONArray("backupUrls");
                if (backupArr != null) {
                    for (int j = 0; j < backupArr.length(); j++) {
                        String b = backupArr.optString(j, "");
                        if (!b.isEmpty()) backups.add(b);
                    }
                }

                channels.add(new LiveChannel(
                        item.optString("name", "Canli TV"),
                        streamUrl,
                        item.optString("logo", ""),
                        group,
                        backups
                ));
            }
        }

        Collections.sort(channels, (a, b) -> a.name.compareToIgnoreCase(b.name));
        return channels;
    }
}
