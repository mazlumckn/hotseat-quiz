package com.mazlu.cinematicnative;

import android.content.Intent;

final class Movie {
    final int id;
    final String title;
    final String overview;
    final String posterPath;
    final String backdropPath;
    final String mediaType;
    final double rating;
    final String releaseDate;

    Movie(int id, String title, String overview, String posterPath, String backdropPath, String mediaType, double rating, String releaseDate) {
        this.id = id;
        this.title = title;
        this.overview = overview;
        this.posterPath = posterPath;
        this.backdropPath = backdropPath;
        this.mediaType = mediaType;
        this.rating = rating;
        this.releaseDate = releaseDate;
    }

    void putInto(Intent intent) {
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("overview", overview);
        intent.putExtra("posterPath", posterPath);
        intent.putExtra("backdropPath", backdropPath);
        intent.putExtra("mediaType", mediaType);
        intent.putExtra("rating", rating);
        intent.putExtra("releaseDate", releaseDate);
    }

    static Movie from(Intent intent) {
        return new Movie(
                intent.getIntExtra("id", 0),
                intent.getStringExtra("title"),
                intent.getStringExtra("overview"),
                intent.getStringExtra("posterPath"),
                intent.getStringExtra("backdropPath"),
                intent.getStringExtra("mediaType"),
                intent.getDoubleExtra("rating", 0),
                intent.getStringExtra("releaseDate")
        );
    }
}
