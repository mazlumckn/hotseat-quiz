package com.mazlu.cinematicnative;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.TrackGroup;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.Tracks;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.ui.PlayerView;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

@UnstableApi
public class PlayerActivity extends Activity {
    private DefaultTrackSelector trackSelector;
    private ExoPlayer player;
    private PlayerView playerView;
    private String title;
    private String streamUrl;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Ui.BG);
        getWindow().setNavigationBarColor(Ui.BG);

        title = getIntent().getStringExtra("title");
        streamUrl = getIntent().getStringExtra("streamUrl");

        if (streamUrl == null || streamUrl.trim().isEmpty()) {
            Toast.makeText(this, "Stream URL bos", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Ui.BG);
        setContentView(root);

        root.addView(header());

        playerView = new PlayerView(this);
        playerView.setUseController(true);
        playerView.setKeepScreenOn(true);
        root.addView(playerView, new LinearLayout.LayoutParams(-1, 0, 1));

        root.addView(trackButtons());

        setupPlayer();
    }

    private LinearLayout header() {
        LinearLayout header = new LinearLayout(this);
        header.setPadding(dp(16), dp(14), dp(16), dp(12));
        header.setGravity(Gravity.CENTER_VERTICAL);

        TextView back = Ui.text(header, "<  Geri", 14, Ui.CYAN, Typeface.BOLD);
        back.setOnClickListener(v -> finish());
        header.addView(back);

        TextView titleView = Ui.text(header, value(title), 15, Ui.TEXT, Typeface.BOLD);
        titleView.setPadding(dp(12), 0, 0, 0);
        titleView.setSingleLine(true);
        titleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
        header.addView(titleView, new LinearLayout.LayoutParams(0, -2, 1));
        return header;
    }

    private LinearLayout trackButtons() {
        LinearLayout row = new LinearLayout(this);
        row.setPadding(dp(16), dp(10), dp(16), dp(16));
        row.setGravity(Gravity.CENTER);

        TextView audio = actionButton("Audio");
        audio.setOnClickListener(v -> showAudioDialog());
        row.addView(audio, new LinearLayout.LayoutParams(0, dp(44), 1));

        TextView subtitles = actionButton("Altyazi");
        subtitles.setOnClickListener(v -> showSubtitleDialog());
        LinearLayout.LayoutParams subtitlesLp = new LinearLayout.LayoutParams(0, dp(44), 1);
        subtitlesLp.setMargins(dp(10), 0, 0, 0);
        row.addView(subtitles, subtitlesLp);
        return row;
    }

    private TextView actionButton(String label) {
        TextView button = Ui.text(this.getWindow().getDecorView(), label, 13, Ui.BG, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setBackground(Ui.rounded(Ui.CYAN, 10, this.getWindow().getDecorView()));
        return button;
    }

    private void setupPlayer() {
        trackSelector = new DefaultTrackSelector(this);
        player = new ExoPlayer.Builder(this).setTrackSelector(trackSelector).build();
        playerView.setPlayer(player);
        player.setMediaItem(MediaItem.fromUri(streamUrl));
        player.prepare();
        player.play();
    }

    private void showAudioDialog() {
        List<TrackOption> options = collectOptions(C.TRACK_TYPE_AUDIO);
        if (options.isEmpty()) {
            Toast.makeText(this, "Audio track bulunamadi", Toast.LENGTH_SHORT).show();
            return;
        }
        String[] labels = new String[options.size()];
        int selected = 0;
        for (int i = 0; i < options.size(); i++) {
            labels[i] = options.get(i).label;
            if (options.get(i).selected) selected = i;
        }
        new AlertDialog.Builder(this)
                .setTitle("Audio Secimi")
                .setSingleChoiceItems(labels, selected, (d, which) -> {
                    TrackOption option = options.get(which);
                    applyTrackSelection(C.TRACK_TYPE_AUDIO, option.group, option.trackIndex, false);
                    d.dismiss();
                })
                .setNegativeButton("Iptal", null)
                .show();
    }

    private void showSubtitleDialog() {
        List<TrackOption> options = collectOptions(C.TRACK_TYPE_TEXT);
        List<String> labels = new ArrayList<>();
        labels.add("Kapali");
        int selected = 0;
        for (int i = 0; i < options.size(); i++) {
            TrackOption option = options.get(i);
            labels.add(option.label);
            if (option.selected) selected = i + 1;
        }
        new AlertDialog.Builder(this)
                .setTitle("Altyazi Secimi")
                .setSingleChoiceItems(labels.toArray(new String[0]), selected, (d, which) -> {
                    if (which == 0) {
                        applyTrackSelection(C.TRACK_TYPE_TEXT, null, -1, true);
                    } else {
                        TrackOption option = options.get(which - 1);
                        applyTrackSelection(C.TRACK_TYPE_TEXT, option.group, option.trackIndex, false);
                    }
                    d.dismiss();
                })
                .setNegativeButton("Iptal", null)
                .show();
    }

    private List<TrackOption> collectOptions(int type) {
        List<TrackOption> options = new ArrayList<>();
        if (player == null) return options;
        Tracks tracks = player.getCurrentTracks();
        for (Tracks.Group group : tracks.getGroups()) {
            if (group.getType() != type) continue;
            TrackGroup mediaGroup = group.getMediaTrackGroup();
            for (int i = 0; i < group.length; i++) {
                if (!group.isTrackSupported(i)) continue;
                Format format = group.getTrackFormat(i);
                String label = labelFor(format, type, options.size() + 1);
                options.add(new TrackOption(mediaGroup, i, label, group.isTrackSelected(i)));
            }
        }
        return options;
    }

    private String labelFor(Format format, int type, int order) {
        String language = format.language;
        if (language == null || language.trim().isEmpty() || "und".equalsIgnoreCase(language)) {
            language = type == C.TRACK_TYPE_AUDIO ? "Audio" : "Subtitle";
        } else {
            language = language.toUpperCase(Locale.US);
        }
        String details;
        if (type == C.TRACK_TYPE_AUDIO && format.channelCount > 0) {
            details = " (" + format.channelCount + "ch)";
        } else if (type == C.TRACK_TYPE_TEXT) {
            String role = format.label == null ? "" : format.label.trim();
            details = role.isEmpty() ? "" : " - " + role;
        } else {
            details = "";
        }
        return order + ". " + language + details;
    }

    private void applyTrackSelection(int trackType, TrackGroup group, int trackIndex, boolean disable) {
        DefaultTrackSelector.Parameters.Builder builder = trackSelector.buildUponParameters();
        builder.clearOverridesOfType(trackType);
        builder.setTrackTypeDisabled(trackType, disable);
        if (!disable && group != null && trackIndex >= 0) {
            builder.addOverride(new TrackSelectionOverride(group, Collections.singletonList(trackIndex)));
        }
        trackSelector.setParameters(builder);
    }

    private String value(String text) {
        return text == null || text.trim().isEmpty() ? "Cinematic Player" : text;
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (player != null) player.play();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) player.pause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (playerView != null) playerView.setPlayer(null);
        if (player != null) {
            player.release();
            player = null;
        }
    }

    private static final class TrackOption {
        final TrackGroup group;
        final int trackIndex;
        final String label;
        final boolean selected;

        TrackOption(TrackGroup group, int trackIndex, String label, boolean selected) {
            this.group = group;
            this.trackIndex = trackIndex;
            this.label = label;
            this.selected = selected;
        }
    }
}
