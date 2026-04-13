package com.mazlu.cinematicnative;

import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.widget.TextView;

final class Ui {
    static final int BG = Color.rgb(4, 6, 8);
    static final int SURFACE = Color.rgb(17, 23, 32);
    static final int SURFACE_2 = Color.rgb(26, 32, 48);
    static final int TEXT = Color.rgb(238, 242, 247);
    static final int MUTED = Color.rgb(143, 157, 171);
    static final int CYAN = Color.rgb(0, 212, 200);

    static int dp(View view, int value) {
        return (int) (value * view.getResources().getDisplayMetrics().density + 0.5f);
    }

    static GradientDrawable rounded(int color, int radiusDp, View view) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(view, radiusDp));
        return drawable;
    }

    static TextView text(View parent, String value, float sp, int color, int style) {
        TextView text = new TextView(parent.getContext());
        text.setText(value);
        text.setTextSize(sp);
        text.setTextColor(color);
        text.setTypeface(Typeface.DEFAULT, style);
        text.setIncludeFontPadding(false);
        return text;
    }
}
