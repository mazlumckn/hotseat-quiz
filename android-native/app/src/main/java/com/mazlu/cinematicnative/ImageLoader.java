package com.mazlu.cinematicnative;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.widget.ImageView;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class ImageLoader {
    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    private final Map<String, Bitmap> cache = new ConcurrentHashMap<>();

    void load(String url, ImageView imageView) {
        if (url == null || url.isEmpty()) return;
        Bitmap cached = cache.get(url);
        if (cached != null) {
            imageView.setImageBitmap(cached);
            return;
        }
        executor.execute(() -> {
            try {
                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(12000);
                try (InputStream stream = connection.getInputStream()) {
                    Bitmap bitmap = BitmapFactory.decodeStream(stream);
                    if (bitmap != null) {
                        cache.put(url, bitmap);
                        imageView.post(() -> imageView.setImageBitmap(bitmap));
                    }
                } finally {
                    connection.disconnect();
                }
            } catch (Exception ignored) {
            }
        });
    }
}
