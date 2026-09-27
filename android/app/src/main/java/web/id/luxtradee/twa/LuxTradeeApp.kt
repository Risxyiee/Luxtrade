package web.id.luxtradee.twa

import android.app.Application
import android.webkit.WebView
import web.id.luxtradee.twa.push.NotificationHelper

class LuxTradeeApp : Application() {
    override fun onCreate() {
        super.onCreate()
        NotificationHelper.createNotificationChannels(this)
        // Enable WebView debugging in development
        WebView.setWebContentsDebuggingEnabled(false)
    }
}
