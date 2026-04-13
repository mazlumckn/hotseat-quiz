package com.mazlu.cinematicnative;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

final class WatchlistStore {
    private static final String PREF = "cinematic_native_watchlist";
    private static final String KEY_ITEMS = "items";

    private WatchlistStore() {}

    static List<Movie> all(Context context) {
        String json = prefs(context).getString(KEY_ITEMS, "[]");
        try {
            JSONArray arr = new JSONArray(json);
            List<Movie> list = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject item = arr.optJSONObject(i);
                if (item == null) continue;
                list.add(fromJson(item));
            }
            Collections.reverse(list);
            return list;
        } catch (Exception ignored) {
            return new ArrayList<>();
        }
    }

    static boolean contains(Context context, int id, String mediaType) {
        List<Movie> list = all(context);
        for (Movie movie : list) {
            if (movie.id == id && sameType(movie.mediaType, mediaType)) return true;
        }
        return false;
    }

    static boolean toggle(Context context, Movie movie) {
        List<Movie> list = all(context);
        int index = -1;
        for (int i = 0; i < list.size(); i++) {
            Movie item = list.get(i);
            if (item.id == movie.id && sameType(item.mediaType, movie.mediaType)) {
                index = i;
                break;
            }
        }

        boolean added;
        if (index >= 0) {
            list.remove(index);
            added = false;
        } else {
            list.add(movie);
            added = true;
        }
        save(context, list);
        return added;
    }

    static void clear(Context context) {
        prefs(context).edit().putString(KEY_ITEMS, "[]").apply();
    }

    private static void save(Context context, List<Movie> list) {
        JSONArray arr = new JSONArray();
        for (Movie movie : list) arr.put(toJson(movie));
        prefs(context).edit().putString(KEY_ITEMS, arr.toString()).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    private static JSONObject toJson(Movie movie) {
        JSONObject obj = new JSONObject();
        try {
            obj.put("id", movie.id);
            obj.put("title", movie.title);
            obj.put("overview", movie.overview);
            obj.put("posterPath", movie.posterPath);
            obj.put("backdropPath", movie.backdropPath);
            obj.put("mediaType", movie.mediaType);
            obj.put("rating", movie.rating);
            obj.put("releaseDate", movie.releaseDate);
        } catch (Exception ignored) {}
        return obj;
    }

    private static Movie fromJson(JSONObject obj) {
        return new Movie(
                obj.optInt("id"),
                obj.optString("title", "Untitled"),
                obj.optString("overview", ""),
                obj.optString("posterPath", ""),
                obj.optString("backdropPath", ""),
                obj.optString("mediaType", "movie"),
                obj.optDouble("rating", 0),
                obj.optString("releaseDate", "")
        );
    }

    private static boolean sameType(String a, String b) {
        String x = a == null ? "" : a.trim().toLowerCase();
        String y = b == null ? "" : b.trim().toLowerCase();
        return x.equals(y);
    }
}
