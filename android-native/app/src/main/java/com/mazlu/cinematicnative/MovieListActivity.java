package com.mazlu.cinematicnative;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MovieListActivity extends Activity {
    private final ExecutorService executor = Executors.newFixedThreadPool(3);
    private final TmdbClient tmdb = new TmdbClient();
    private final ImageLoader images = new ImageLoader();
    private LinearLayout content;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Ui.BG);
        getWindow().setNavigationBarColor(Ui.BG);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Ui.BG);
        setContentView(root);

        root.addView(header());

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(18), dp(10), dp(18), dp(18));
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        root.addView(BottomNav.create(this, "Movies"));

        addSection("Trending Movies", "/trending/movie/day");
        addSection("Popular Movies", "/movie/popular");
        addSection("Top Rated", "/movie/top_rated");
        addSection("Popular Series", "/tv/popular");
    }

    private View header() {
        LinearLayout bar = new LinearLayout(this);
        bar.setPadding(dp(18), dp(18), dp(18), dp(10));
        bar.setGravity(Gravity.CENTER_VERTICAL);

        TextView title = Ui.text(bar, "Movies", 22, Ui.TEXT, Typeface.BOLD);
        bar.addView(title, new LinearLayout.LayoutParams(0, -2, 1));

        TextView refresh = Ui.text(bar, "Yenile", 12, Ui.BG, Typeface.BOLD);
        refresh.setGravity(Gravity.CENTER);
        refresh.setPadding(dp(12), dp(8), dp(12), dp(8));
        refresh.setBackground(Ui.rounded(Ui.CYAN, 8, bar));
        refresh.setOnClickListener(v -> refreshSections());
        bar.addView(refresh);
        return bar;
    }

    private void refreshSections() {
        content.removeAllViews();
        addSection("Trending Movies", "/trending/movie/day");
        addSection("Popular Movies", "/movie/popular");
        addSection("Top Rated", "/movie/top_rated");
        addSection("Popular Series", "/tv/popular");
    }

    private void addSection(String title, String endpoint) {
        TextView heading = Ui.text(content, title, 18, Ui.TEXT, Typeface.BOLD);
        LinearLayout.LayoutParams headingParams = new LinearLayout.LayoutParams(-1, -2);
        headingParams.setMargins(0, dp(8), 0, dp(12));
        content.addView(heading, headingParams);

        HorizontalScrollView scroller = new HorizontalScrollView(this);
        scroller.setHorizontalScrollBarEnabled(false);
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        scroller.addView(row);
        content.addView(scroller, new LinearLayout.LayoutParams(-1, dp(240)));

        TextView loading = Ui.text(row, "Loading...", 13, Ui.MUTED, Typeface.BOLD);
        row.addView(loading);

        executor.execute(() -> {
            try {
                List<Movie> movies = tmdb.list(endpoint);
                runOnUiThread(() -> fillRow(row, movies));
            } catch (Exception e) {
                runOnUiThread(() -> {
                    row.removeAllViews();
                    row.addView(Ui.text(row, "Bu bolum yuklenemedi.", 13, Ui.MUTED, Typeface.BOLD));
                });
            }
        });
    }

    private void fillRow(LinearLayout row, List<Movie> movies) {
        row.removeAllViews();
        for (Movie movie : movies) row.addView(card(movie));
    }

    private View card(Movie movie) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(0, 0, dp(12), 0);
        card.setOnClickListener(v -> {
            Intent intent = new Intent(this, DetailActivity.class);
            movie.putInto(intent);
            startActivity(intent);
        });

        ImageView poster = new ImageView(this);
        poster.setScaleType(ImageView.ScaleType.CENTER_CROP);
        poster.setBackground(Ui.rounded(Ui.SURFACE_2, 10, card));
        card.addView(poster, new LinearLayout.LayoutParams(dp(128), dp(190)));
        images.load(TmdbClient.IMAGE_W500 + movie.posterPath, poster);

        TextView title = Ui.text(card, movie.title, 12, Ui.TEXT, Typeface.BOLD);
        title.setMaxLines(2);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(dp(128), -2);
        titleParams.setMargins(0, dp(8), 0, 0);
        card.addView(title, titleParams);
        return card;
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
