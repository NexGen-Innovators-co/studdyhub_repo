# Keep enum constants — fixes "No enum constant" crashes from R8 obfuscation
-keepclassmembers enum * {
    **[] $VALUES;
    public *;
}

# Moshi JsonClass / JsonAdapter
-keep @com.squareup.moshi.JsonClass class * { *; }
-keep class **JsonAdapter { *; }

# Preserve line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
