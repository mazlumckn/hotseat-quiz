package com.mazlu.cinematicnative;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

import java.util.Map;

final class BackendConfig {
    private static final String PREF = "cinematic_native_cfg";
    private static final String KEY_API_BASE = "api_base";
    private static final String FALLBACK_API_BASE = "http://127.0.0.1:3001";

    private BackendConfig() {}

    static String getApiBase(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        String value = prefs.getString(KEY_API_BASE, defaultApiBase());
        return sanitizeApiBase(value);
    }

    static void setApiBase(Context context, String value) {
        String clean = sanitizeApiBase(value);
        context.getSharedPreferences(PREF, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_API_BASE, clean)
                .apply();
    }

    static String sanitizeApiBase(String raw) {
        String userValue = sanitizeOrNull(raw);
        if (userValue != null) return userValue;
        return defaultApiBase();
    }

    static String buildUrl(Context context, String path, Map<String, String> params) {
        String base = getApiBase(context);
        String cleanPath = path == null ? "" : path.trim();
        while (cleanPath.startsWith("/")) cleanPath = cleanPath.substring(1);

        Uri.Builder builder = Uri.parse(base + "/" + cleanPath).buildUpon();
        if (params != null) {
            for (Map.Entry<String, String> entry : params.entrySet()) {
                if (entry.getValue() == null || entry.getValue().trim().isEmpty()) continue;
                builder.appendQueryParameter(entry.getKey(), entry.getValue());
            }
        }
        return builder.build().toString();
    }

    static String getBundledApiBase() {
        return defaultApiBase();
    }

    private static String defaultApiBase() {
        String configured = sanitizeOrNull(BuildConfig.DEFAULT_API_BASE);
        return configured != null ? configured : FALLBACK_API_BASE;
    }

    private static String sanitizeOrNull(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) return null;
        while (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        if (!value.startsWith("http://") && !value.startsWith("https://")) return null;
        return value;
    }
}
