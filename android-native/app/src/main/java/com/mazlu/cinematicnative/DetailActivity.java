package com.mazlu.cinematicnative;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DetailActivity extends Activity {
    private final ImageLoader images = new ImageLoader();
    private final StreamExtractor extractor = new StreamExtractor();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private TextView watchlistButton;
    private Movie movie;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Ui.BG);
        getWindow().setNavigationBarColor(Ui.BG);

        movie = Movie.from(getIntent());

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Ui.BG);
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(18), dp(18), dp(18), dp(28));
        scroll.addView(body);
        setContentView(scroll);

        TextView back = Ui.text(body, "<  Back", 14, Ui.CYAN, Typeface.BOLD);
        back.setPadding(0, 0, 0, dp(16));
        back.setOnClickListener(v -> finish());
        body.addView(back);

        ImageView backdrop = new ImageView(this);
        backdrop.setScaleType(ImageView.ScaleType.CENTER_CROP);
        backdrop.setBackground(Ui.rounded(Ui.SURFACE, 16, body));
        body.addView(backdrop, new LinearLayout.LayoutParams(-1, dp(250)));
        images.load(TmdbClient.IMAGE_ORIGINAL + movie.backdropPath, backdrop);

        TextView title = Ui.text(body, value(movie.title), 28, Ui.TEXT, Typeface.BOLD);
        title.setPadding(0, dp(22), 0, dp(10));
        body.addView(title);

        String meta = (movie.releaseDate == null || movie.releaseDate.isEmpty() ? "New" : movie.releaseDate)
                + " | " + value(movie.mediaType).toUpperCase()
                + " | " + String.format("%.1f", movie.rating);
        TextView details = Ui.text(body, meta, 13, Ui.MUTED, Typeface.BOLD);
        body.addView(details);

        TextView watch = Ui.text(body, "Watch Now", 15, Ui.BG, Typeface.BOLD);
        watch.setGravity(Gravity.CENTER);
        watch.setBackground(Ui.rounded(Ui.CYAN, 8, body));
        LinearLayout.LayoutParams watchParams = new LinearLayout.LayoutParams(-1, dp(50));
        watchParams.setMargins(0, dp(22), 0, dp(12));
        body.addView(watch, watchParams);
        watch.setOnClickListener(v -> playMovie(movie, watch));

        watchlistButton = Ui.text(body, "", 14, Ui.TEXT, Typeface.BOLD);
        watchlistButton.setGravity(Gravity.CENTER);
        watchlistButton.setBackground(Ui.rounded(Ui.SURFACE_2, 8, body));
        LinearLayout.LayoutParams watchlistParams = new LinearLayout.LayoutParams(-1, dp(46));
        watchlistParams.setMargins(0, 0, 0, dp(20));
        body.addView(watchlistButton, watchlistParams);
        watchlistButton.setOnClickListener(v -> toggleWatchlist());
        refreshWatchlistButton();

        TextView overview = Ui.text(body, value(movie.overview), 15, Ui.TEXT, Typeface.NORMAL);
        overview.setLineSpacing(dp(3), 1f);
        body.addView(overview);
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshWatchlistButton();
    }

    private void playMovie(Movie movie, TextView watchButton) {
        watchButton.setEnabled(false);
        watchButton.setText("Stream araniyor...");
        executor.execute(() -> {
            try {
                StreamExtractor.Result result = extractor.extract(this, movie.id, movie.mediaType);
                runOnUiThread(() -> {
                    watchButton.setEnabled(true);
                    watchButton.setText("Watch Now");
                    handleExtractResult(result, movie.title);
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    watchButton.setEnabled(true);
                    watchButton.setText("Watch Now");
                    Toast.makeText(this, "Stream alinamadi: " + e.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void handleExtractResult(StreamExtractor.Result result, String title) {
        if (result == null || result.url == null || result.url.isEmpty()) {
            Toast.makeText(this, "Stream bulunamadi", Toast.LENGTH_SHORT).show();
            return;
        }
        if ("ready".equals(result.status)) {
            Intent intent = new Intent(this, PlayerActivity.class);
            intent.putExtra("title", title);
            intent.putExtra("streamUrl", result.url);
            startActivity(intent);
            return;
        }
        if ("fallback".equals(result.status)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(result.url)));
                Toast.makeText(this, "Fallback acildi", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Fallback acilamadi", Toast.LENGTH_SHORT).show();
            }
            return;
        }
        String msg = result.message == null || result.message.isEmpty() ? "Bilinmeyen hata" : result.message;
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    private void toggleWatchlist() {
        boolean added = WatchlistStore.toggle(this, movie);
        refreshWatchlistButton();
        Toast.makeText(this, added ? "My List'e eklendi" : "My List'ten kaldirildi", Toast.LENGTH_SHORT).show();
    }

    private void refreshWatchlistButton() {
        if (watchlistButton == null || movie == null) return;
        boolean inList = WatchlistStore.contains(this, movie.id, movie.mediaType);
        watchlistButton.setText(inList ? "My List'ten Kaldir" : "My List'e Ekle");
    }

    private String value(String text) {
        return text == null || text.isEmpty() ? "Unknown" : text;
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executor.shutdownNow();
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }
}
