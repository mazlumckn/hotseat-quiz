package com.mazlu.cinematicnative;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.List;

public class MyListActivity extends Activity {
    private final ImageLoader images = new ImageLoader();
    private LinearLayout content;
    private TextView status;

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

        status = Ui.text(root, "", 12, Ui.MUTED, Typeface.BOLD);
        status.setPadding(dp(18), 0, dp(18), dp(8));
        root.addView(status);

        ScrollView scroll = new ScrollView(this);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(16), dp(4), dp(16), dp(18));
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        root.addView(BottomNav.create(this, "My List"));
    }

    @Override
    protected void onResume() {
        super.onResume();
        render();
    }

    private View header() {
        LinearLayout bar = new LinearLayout(this);
        bar.setPadding(dp(18), dp(18), dp(18), dp(10));
        bar.setGravity(Gravity.CENTER_VERTICAL);

        TextView title = Ui.text(bar, "My List", 22, Ui.TEXT, Typeface.BOLD);
        bar.addView(title, new LinearLayout.LayoutParams(0, -2, 1));

        TextView clear = Ui.text(bar, "Temizle", 12, Ui.BG, Typeface.BOLD);
        clear.setGravity(Gravity.CENTER);
        clear.setPadding(dp(12), dp(8), dp(12), dp(8));
        clear.setBackground(Ui.rounded(Ui.CYAN, 8, bar));
        clear.setOnClickListener(v -> {
            WatchlistStore.clear(this);
            render();
        });
        bar.addView(clear);
        return bar;
    }

    private void render() {
        List<Movie> items = WatchlistStore.all(this);
        content.removeAllViews();
        status.setText(items.size() + " icerik kayitli");
        if (items.isEmpty()) {
            emptyState();
            return;
        }
        for (Movie movie : items) content.addView(row(movie));
    }

    private void emptyState() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18), dp(20), dp(18), dp(20));
        box.setBackground(Ui.rounded(Ui.SURFACE_2, 12, box));

        TextView title = Ui.text(box, "Listende icerik yok", 16, Ui.TEXT, Typeface.BOLD);
        box.addView(title);

        TextView note = Ui.text(box, "Detay ekraninda \"My List\" butonuyla kaydedebilirsin.", 13, Ui.MUTED, Typeface.NORMAL);
        note.setPadding(0, dp(8), 0, dp(12));
        box.addView(note);

        TextView openMovies = Ui.text(box, "Movies Sekmesine Git", 12, Ui.BG, Typeface.BOLD);
        openMovies.setGravity(Gravity.CENTER);
        openMovies.setPadding(dp(12), dp(10), dp(12), dp(10));
        openMovies.setBackground(Ui.rounded(Ui.CYAN, 8, box));
        openMovies.setOnClickListener(v -> startActivity(new Intent(this, MovieListActivity.class)));
        box.addView(openMovies, new LinearLayout.LayoutParams(-1, -2));

        content.addView(box, new LinearLayout.LayoutParams(-1, -2));
    }

    private View row(Movie movie) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(12), dp(12), dp(12), dp(12));
        card.setBackground(Ui.rounded(Ui.SURFACE_2, 12, card));
        card.setOnClickListener(v -> {
            Intent intent = new Intent(this, DetailActivity.class);
            movie.putInto(intent);
            startActivity(intent);
        });

        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(-1, -2);
        cardParams.setMargins(0, 0, 0, dp(10));
        card.setLayoutParams(cardParams);

        ImageView poster = new ImageView(this);
        poster.setScaleType(ImageView.ScaleType.CENTER_CROP);
        poster.setBackground(Ui.rounded(Ui.SURFACE, 8, card));
        card.addView(poster, new LinearLayout.LayoutParams(dp(56), dp(84)));
        images.load(TmdbClient.IMAGE_W500 + movie.posterPath, poster);

        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        textCol.setPadding(dp(12), 0, dp(8), 0);

        TextView title = Ui.text(textCol, movie.title, 14, Ui.TEXT, Typeface.BOLD);
        title.setMaxLines(2);
        textCol.addView(title);

        String meta = value(movie.mediaType).toUpperCase() + " | " + value(movie.releaseDate);
        TextView info = Ui.text(textCol, meta, 11, Ui.MUTED, Typeface.BOLD);
        info.setPadding(0, dp(6), 0, 0);
        textCol.addView(info);

        card.addView(textCol, new LinearLayout.LayoutParams(0, -2, 1));

        TextView remove = Ui.text(card, "Sil", 12, Ui.BG, Typeface.BOLD);
        remove.setGravity(Gravity.CENTER);
        remove.setPadding(dp(12), dp(8), dp(12), dp(8));
        remove.setBackground(Ui.rounded(Ui.CYAN, 8, card));
        remove.setOnClickListener(v -> {
            WatchlistStore.toggle(this, movie);
            render();
        });
        card.addView(remove);
        return card;
    }

    private String value(String text) {
        return text == null || text.trim().isEmpty() ? "Unknown" : text;
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }
}
