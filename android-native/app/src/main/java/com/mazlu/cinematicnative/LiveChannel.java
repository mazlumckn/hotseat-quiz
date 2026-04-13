package com.mazlu.cinematicnative;

import java.util.ArrayList;
import java.util.List;

final class LiveChannel {
    final String name;
    final String url;
    final String logo;
    final String group;
    final List<String> backupUrls;

    LiveChannel(String name, String url, String logo, String group, List<String> backupUrls) {
        this.name = name;
        this.url = url;
        this.logo = logo;
        this.group = group;
        this.backupUrls = backupUrls == null ? new ArrayList<>() : backupUrls;
    }
}
