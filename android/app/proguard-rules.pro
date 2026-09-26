# Add project specific ProGuard rules here.
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class * extends android.webkit.WebViewClient {
    public *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
}
-keepclassmembers class * extends android.app.Service {
    public void onStartCommand(android.content.Intent, int, int);
}
-keep class com.google.firebase.messaging.FirebaseMessagingService { *; }
-dontwarn kotlin.**
