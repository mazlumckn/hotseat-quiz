package com.mazlu.cinematicnative;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

final class TmdbClient {
    static final String IMAGE_W500 = "https://image.tmdb.org/t/p/w500";
    static final String IMAGE_ORIGINAL = "https://image.tmdb.org/t/p/original";

    private static final String KEY = "8265bd1679663a7ea12ac168da84d2e8";
    private static final String BASE = "https://api.themoviedb.org/3";

    List<Movie> list(String path) throws Exception {
        String sep = path.contains("?") ? "&" : "?";
        JSONObject root = get(BASE + path + sep + "api_key=" + KEY);
        JSONArray results = root.getJSONArray("results");
        List<Movie> movies = new ArrayList<>();
        for (int i = 0; i < Math.min(results.length(), 20); i++) {
            JSONObject item = results.getJSONObject(i);
            String mediaType = item.optString("media_type", path.contains("/tv/") ? "tv" : "movie");
            String title = item.optString("title", item.optString("name", "Untitled"));
            String release = item.optString("release_date", item.optString("first_air_date", ""));
            movies.add(new Movie(
                    item.optInt("id"),
                    title,
                    item.optString("overview", ""),
                    item.optString("poster_path", ""),
                    item.optString("backdrop_path", ""),
                    mediaType,
                    item.optDouble("vote_average", 0),
                    release
            ));
        }
        return movies;
    }

    private JSONObject get(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(12000);
        connection.setRequestProperty("Accept", "application/json");
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder body = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
            return new JSONObject(body.toString());
        } finally {
            connection.disconnect();
        }
    }
}
