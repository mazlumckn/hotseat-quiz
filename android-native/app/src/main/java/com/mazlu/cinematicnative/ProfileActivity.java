package com.mazlu.cinematicnative;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.PackageInfo;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ProfileActivity extends Activity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private TextView apiText;
    private TextView bundledApiText;
    private TextView healthText;
    private TextView watchlistText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Ui.BG);
        getWindow().setNavigationBarColor(Ui.BG);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Ui.BG);
        setContentView(root);

        ScrollView scroll = new ScrollView(this);
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(18), dp(18), dp(18), dp(18));
        scroll.addView(body);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        root.addView(BottomNav.create(this, "Profile"));

        body.addView(titleBlock());
        body.addView(apiBlock());
        body.addView(systemBlock());
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshStats();
        pingHealth();
    }

    private View titleBlock() {
        LinearLayout block = new LinearLayout(this);
        block.setOrientation(LinearLayout.VERTICAL);
        block.setPadding(dp(16), dp(16), dp(16), dp(16));
        block.setBackground(Ui.rounded(Ui.SURFACE_2, 14, block));

        TextView title = Ui.text(block, "Profile", 22, Ui.TEXT, Typeface.BOLD);
        block.addView(title);

        TextView subtitle = Ui.text(block, "Native Android ayarlari ve baglanti durumu", 12, Ui.MUTED, Typeface.NORMAL);
        subtitle.setPadding(0, dp(8), 0, 0);
        block.addView(subtitle);

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, 0, 0, dp(14));
        block.setLayoutParams(params);
        return block;
    }

    private View apiBlock() {
        LinearLayout block = sectionCard("Backend API");
        apiText = Ui.text(block, "", 13, Ui.MUTED, Typeface.BOLD);
        block.addView(apiText);

        bundledApiText = Ui.text(block, "", 12, Ui.MUTED, Typeface.NORMAL);
        bundledApiText.setPadding(0, dp(6), 0, 0);
        block.addView(bundledApiText);

        TextView edit = actionButton("API Adresini Degistir", block);
        edit.setOnClickListener(v -> showApiDialog());
        LinearLayout.LayoutParams editLp = new LinearLayout.LayoutParams(-1, -2);
        editLp.setMargins(0, dp(12), 0, 0);
        block.addView(edit, editLp);

        TextView test = actionButton("Baglantiyi Test Et", block);
        test.setOnClickListener(v -> pingHealth());
        LinearLayout.LayoutParams testLp = new LinearLayout.LayoutParams(-1, -2);
        testLp.setMargins(0, dp(10), 0, 0);
        block.addView(test, testLp);

        healthText = Ui.text(block, "Health: kontrol ediliyor...", 12, Ui.MUTED, Typeface.BOLD);
        healthText.setPadding(0, dp(10), 0, 0);
        block.addView(healthText);
        return block;
    }

    private View systemBlock() {
        LinearLayout block = sectionCard("Uygulama");
        String version = "Unknown";
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            version = info.versionName;
        } catch (Exception ignored) {}

        TextView appId = Ui.text(block, "App ID: " + getPackageName(), 12, Ui.MUTED, Typeface.BOLD);
        block.addView(appId);

        TextView appVersion = Ui.text(block, "Version: " + version, 12, Ui.MUTED, Typeface.BOLD);
        appVersion.setPadding(0, dp(8), 0, 0);
        block.addView(appVersion);

        watchlistText = Ui.text(block, "My List: 0", 12, Ui.MUTED, Typeface.BOLD);
        watchlistText.setPadding(0, dp(8), 0, 0);
        block.addView(watchlistText);
        return block;
    }

    private LinearLayout sectionCard(String title) {
        LinearLayout block = new LinearLayout(this);
        block.setOrientation(LinearLayout.VERTICAL);
        block.setPadding(dp(16), dp(14), dp(16), dp(14));
        block.setBackground(Ui.rounded(Ui.SURFACE_2, 12, block));

        TextView heading = Ui.text(block, title, 16, Ui.TEXT, Typeface.BOLD);
        block.addView(heading);

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, 0, 0, dp(12));
        block.setLayoutParams(params);
        return block;
    }

    private TextView actionButton(String text, View ref) {
        TextView button = Ui.text(ref, text, 12, Ui.BG, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(12), dp(10), dp(12), dp(10));
        button.setBackground(Ui.rounded(Ui.CYAN, 8, ref));
        return button;
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
                    BackendConfig.setApiBase(this, input.getText().toString().trim());
                    refreshStats();
                    pingHealth();
                })
                .setNegativeButton("Iptal", null)
                .show();
    }

    private void refreshStats() {
        apiText.setText("API Base: " + BackendConfig.getApiBase(this));
        bundledApiText.setText("Varsayilan (APK): " + BackendConfig.getBundledApiBase());
        watchlistText.setText("My List: " + WatchlistStore.all(this).size());
    }

    private void pingHealth() {
        healthText.setText("Health: kontrol ediliyor...");
        executor.execute(() -> {
            try {
                String url = BackendConfig.buildUrl(this, "/health", null);
                JSONObject obj = NetJson.get(url);
                String info = obj.optString("status", "ok");
                runOnUiThread(() -> healthText.setText("Health: OK (" + info + ")"));
            } catch (Exception e) {
                runOnUiThread(() -> {
                    healthText.setText("Health: erisilemiyor");
                    Toast.makeText(this, "Backend baglantisi yok", Toast.LENGTH_SHORT).show();
                });
            }
        });
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
