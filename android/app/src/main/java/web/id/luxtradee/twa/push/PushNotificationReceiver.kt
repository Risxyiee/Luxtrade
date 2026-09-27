package web.id.luxtradee.twa.push

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Receiver for push notifications via BroadcastReceiver pattern.
 * This works without Firebase - the web app's service worker handles
 * push via Web Push API, and this receiver handles local notification
 * actions (dismiss, tap, etc).
 *
 * For FCM integration, add the google-services plugin and
 * firebase-messaging dependency to build.gradle, then replace this
 * with a FirebaseMessagingService implementation.
 */
class PushNotificationReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "PushNotifReceiver"
        const val ACTION_SHOW_NOTIFICATION = "web.id.luxtradee.twa.SHOW_NOTIFICATION"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
        const val EXTRA_TYPE = "type"
        const val EXTRA_URL = "url"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_SHOW_NOTIFICATION -> {
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "LuxTradee"
                val body = intent.getStringExtra(EXTRA_BODY) ?: ""
                val type = intent.getStringExtra(EXTRA_TYPE) ?: "general"
                val url = intent.getStringExtra(EXTRA_URL) ?: ""

                val channelId = when (type) {
                    "trade" -> NotificationHelper.CHANNEL_TRADES
                    "price-alert" -> NotificationHelper.CHANNEL_ALERTS
                    "chat" -> NotificationHelper.CHANNEL_CHAT
                    else -> NotificationHelper.CHANNEL_GENERAL
                }

                NotificationHelper.showNotification(
                    context = context,
                    title = title,
                    body = body,
                    channelId = channelId,
                    data = mapOf("url" to url, "type" to type)
                )

                Log.d(TAG, "Notification shown: $title")
            }
        }
    }
}
