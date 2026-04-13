package com.mazlu.cinematicnative;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class LiveTvActivity extends Activity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final LiveTvClient client = new LiveTvClient();
    private final ImageLoader images = new ImageLoader();
    private LinearLayout list;
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
        status = Ui.text(root, "Yukleniyor...", 12, Ui.MUTED, Typeface.BOLD);
        status.setPadding(dp(18), 0, dp(18), dp(8));
        root.addView(status);

        ScrollView scroll = new ScrollView(this);
        list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setPadding(dp(16), dp(4), dp(16), dp(22));
        scroll.addView(list);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        root.addView(BottomNav.create(this, "TV"));

        loadChannels();
    }

    private View header() {
        LinearLayout bar = new LinearLayout(this);
        bar.setPadding(dp(16), dp(14), dp(16), dp(10));
        bar.setGravity(Gravity.CENTER_VERTICAL);

        TextView back = Ui.text(bar, "<  Geri", 14, Ui.CYAN, Typeface.BOLD);
        back.setOnClickListener(v -> finish());
        bar.addView(back);

        TextView title = Ui.text(bar, "Canli TV", 18, Ui.TEXT, Typeface.BOLD);
        title.setPadding(dp(14), 0, 0, 0);
        bar.addView(title, new LinearLayout.LayoutParams(0, -2, 1));

        TextView settings = Ui.text(bar, "API", 12, Ui.BG, Typeface.BOLD);
        settings.setGravity(Gravity.CENTER);
        settings.setBackground(Ui.rounded(Ui.CYAN, 8, bar));
        settings.setPadding(dp(12), dp(8), dp(12), dp(8));
        settings.setOnClickListener(v -> showApiDialog());
        bar.addView(settings);
        return bar;
    }

    private void showApiDialog() {
        EditText input = new EditText(this);
        input.setText(BackendConfig.getApiBase(this));
        input.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        input.setSingleLine(true);
        input.setPadding(dp(12), dp(10), dp(12), dp(10));

        new AlertDialog.Builder(this)
                .setTitle("Backend API")
                .setMessage("Ornek: https://api.senin-domainin.com")
                .setView(input)
                .setPositiveButton("Kaydet", (d, which) -> {
                    String value = input.getText().toString().trim();
                    BackendConfig.setApiBase(this, value);
                    loadChannels();
                })
                .setNegativeButton("Iptal", null)
                .show();
    }

    private void loadChannels() {
        list.removeAllViews();
        list.addView(Ui.text(list, "Kanal listesi getiriliyor...", 13, Ui.MUTED, Typeface.BOLD));
        status.setText("Baglaniyor: " + BackendConfig.getApiBase(this));

        executor.execute(() -> {
            try {
                List<LiveChannel> channels = client.fetch(this);
                runOnUiThread(() -> render(channels));
            } catch (Exception e) {
                runOnUiThread(() -> {
                    list.removeAllViews();
                    list.addView(Ui.text(list, "Kanal listesi alinamadi.", 14, Ui.MUTED, Typeface.BOLD));
                    Toast.makeText(this, e.getMessage(), Toast.LENGTH_LONG).show();
                    status.setText("Baglanti hatasi");
                });
            }
        });
    }

    private void render(List<LiveChannel> channels) {
        list.removeAllViews();
        status.setText(channels.size() + " kanal bulundu");
        if (channels.isEmpty()) {
            list.addView(Ui.text(list, "Kanal bulunamadi.", 14, Ui.MUTED, Typeface.BOLD));
            return;
        }
        for (LiveChannel channel : channels) {
            list.addView(channelCard(channel));
        }
    }

    private View channelCard(LiveChannel channel) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(12), dp(12), dp(12), dp(12));
        card.setBackground(Ui.rounded(Ui.SURFACE_2, 12, card));

        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(-1, -2);
        cardParams.setMargins(0, 0, 0, dp(10));
        card.setLayoutParams(cardParams);
        card.setOnClickListener(v -> play(channel));

        ImageView logo = new ImageView(this);
        logo.setScaleType(ImageView.ScaleType.CENTER_CROP);
        logo.setBackground(Ui.rounded(Ui.SURFACE, 8, card));
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(46), dp(46));
        card.addView(logo, logoParams);
        images.load(channel.logo, logo);

        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        textCol.setPadding(dp(12), 0, 0, 0);
        TextView name = Ui.text(textCol, channel.name, 14, Ui.TEXT, Typeface.BOLD);
        TextView group = Ui.text(textCol, channel.group, 11, Ui.MUTED, Typeface.BOLD);
        textCol.addView(name);
        textCol.addView(group);
        card.addView(textCol, new LinearLayout.LayoutParams(0, -2, 1));

        TextView play = Ui.text(card, "Izle", 12, Ui.BG, Typeface.BOLD);
        play.setGravity(Gravity.CENTER);
        play.setBackground(Ui.rounded(Ui.CYAN, 8, card));
        play.setPadding(dp(12), dp(8), dp(12), dp(8));
        card.addView(play);
        return card;
    }

    private void play(LiveChannel channel) {
        if (channel.url == null || channel.url.isEmpty()) {
            Toast.makeText(this, "Kanal URL bos", Toast.LENGTH_SHORT).show();
            return;
        }
        String stream = buildProxyUrl(channel.url, channel.backupUrls);
        Intent intent = new Intent(this, PlayerActivity.class);
        intent.putExtra("title", channel.name);
        intent.putExtra("streamUrl", stream);
        startActivity(intent);
    }

    private String buildProxyUrl(String url, List<String> backupUrls) {
        Map<String, String> params = new HashMap<>();
        params.put("url", url);
        params.put("track", "1");
        String base = BackendConfig.buildUrl(this, "/api/proxy-stream", params);

        List<String> backups = backupUrls == null ? Collections.emptyList() : backupUrls;
        if (backups.isEmpty()) return base;
        JSONArray arr = new JSONArray();
        for (String item : backups) arr.put(item);
        String json = arr.toString();
        String enc = URLEncoder.encode(json, StandardCharsets.UTF_8);
        return base + "&fallback=" + enc;
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
