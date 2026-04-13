package com.mazlu.cinematicnative;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

final class BottomNav {
    private BottomNav() {}

    static View create(Activity activity, String current) {
        LinearLayout wrapper = new LinearLayout(activity);
        wrapper.setOrientation(LinearLayout.VERTICAL);
        wrapper.setPadding(dp(activity, 16), dp(activity, 4), dp(activity, 16), dp(activity, 12));
        wrapper.setBackgroundColor(Ui.BG);

        LinearLayout bar = new LinearLayout(activity);
        bar.setGravity(Gravity.CENTER);
        bar.setPadding(dp(activity, 8), dp(activity, 8), dp(activity, 8), dp(activity, 8));

        GradientDrawable bg = Ui.rounded(Color.argb(225, 20, 28, 40), 24, bar);
        bg.setStroke(dp(activity, 1), Color.argb(70, 255, 255, 255));
        bar.setBackground(bg);

        String[] items = {"Home", "Movies", "My List", "TV", "Profile"};
        for (String item : items) {
            boolean selected = item.equals(current);
            TextView label = Ui.text(bar, item, 12, selected ? Ui.BG : Ui.MUTED, Typeface.BOLD);
            label.setGravity(Gravity.CENTER);
            label.setPadding(dp(activity, 10), dp(activity, 8), dp(activity, 10), dp(activity, 8));
            label.setBackground(Ui.rounded(selected ? Ui.CYAN : Color.TRANSPARENT, 14, bar));
            label.setOnClickListener(v -> open(activity, current, item));

            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
            bar.addView(label, lp);
        }

        wrapper.addView(bar, new LinearLayout.LayoutParams(-1, -2));
        return wrapper;
    }

    private static void open(Activity activity, String current, String item) {
        if (item.equals(current)) return;
        Class<? extends Activity> target;
        if ("Home".equals(item)) {
            target = MainActivity.class;
        } else if ("Movies".equals(item)) {
            target = MovieListActivity.class;
        } else if ("My List".equals(item)) {
            target = MyListActivity.class;
        } else if ("TV".equals(item)) {
            target = LiveTvActivity.class;
        } else {
            target = ProfileActivity.class;
        }

        Intent intent = new Intent(activity, target);
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        activity.startActivity(intent);
    }

    private static int dp(Activity activity, int value) {
        return (int) (value * activity.getResources().getDisplayMetrics().density + 0.5f);
    }
}
