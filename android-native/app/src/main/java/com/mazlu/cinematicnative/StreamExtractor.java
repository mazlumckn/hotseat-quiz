package com.mazlu.cinematicnative;

import android.content.Context;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

final class StreamExtractor {
    static final class Result {
        final String status;
        final String url;
        final String message;

        Result(String status, String url, String message) {
            this.status = status;
            this.url = url;
            this.message = message;
        }
    }

    Result extract(Context context, int id, String mediaType) throws Exception {
        Map<String, String> params = new HashMap<>();
        params.put("id", String.valueOf(id));
        params.put("type", mediaType == null || mediaType.isEmpty() ? "movie" : mediaType);
        params.put("s", "1");
        params.put("e", "1");
        String url = BackendConfig.buildUrl(context, "/api/extract", params);

        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(45000);
        connection.setRequestProperty("Accept", "text/event-stream");
        connection.setRequestProperty("Cache-Control", "no-cache");

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.startsWith("data: ")) continue;
                String jsonLine = line.substring(6).trim();
                if (jsonLine.isEmpty()) continue;
                JSONObject obj = new JSONObject(jsonLine);
                String status = obj.optString("status", "");
                if ("ready".equals(status) || "fallback".equals(status) || "error".equals(status)) {
                    return new Result(status, obj.optString("url", ""), obj.optString("message", ""));
                }
            }
        } finally {
            connection.disconnect();
        }
        return new Result("error", "", "Stream sonucu alinamadi");
    }
}
