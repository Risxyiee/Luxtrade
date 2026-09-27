package web.id.luxtradee.twa.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.os.Build
import androidx.core.app.NotificationCompat
import web.id.luxtradee.twa.MainActivity
import web.id.luxtradee.twa.R

/**
 * Helper for creating and managing notification channels and notifications.
 * Ensures notifications actually appear on the user's phone with proper
 * channel setup, sound, vibration, and HIGH importance.
 */
object NotificationHelper {

    const val CHANNEL_TRADES = "trades"
    const val CHANNEL_ALERTS = "price_alerts"
    const val CHANNEL_GENERAL = "general"
    const val CHANNEL_CHAT = "chat"

    private const val ID_TRADE = 1001
    private const val ID_ALERT = 1002
    private const val ID_GENERAL = 1003
    private const val ID_CHAT = 1004

    fun createNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val audioAttributes = AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .build()

        // Trades channel - HIGH importance (shows as heads-up notification)
        val tradesChannel = NotificationChannel(
            CHANNEL_TRADES, "Trade Notifications", NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Trade entries, exits, and P&L updates"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 200, 100, 200)
            enableLights(true)
            lightColor = 0xFFD700.toInt()
            setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, audioAttributes)
            setShowBadge(true)
        }

        // Price Alerts - HIGH importance (time-sensitive)
        val alertsChannel = NotificationChannel(
            CHANNEL_ALERTS, "Price Alerts", NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Price alert triggers and market movements"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 100, 50, 100, 50, 100)
            enableLights(true)
            lightColor = 0xFF4444.toInt()
            setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, audioAttributes)
            setShowBadge(true)
        }

        // General - DEFAULT importance
        val generalChannel = NotificationChannel(
            CHANNEL_GENERAL, "General", NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "General app notifications"
            enableVibration(true)
            setShowBadge(true)
        }

        // Chat - DEFAULT importance
        val chatChannel = NotificationChannel(
            CHANNEL_CHAT, "AI Chat", NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "AI assistant responses"
            enableVibration(true)
            setShowBadge(true)
        }

        manager.createNotificationChannels(listOf(tradesChannel, alertsChannel, generalChannel, chatChannel))
    }

    /**
     * Show a notification that ACTUALLY appears on the phone.
     * Uses HIGH priority for trade/alert types → heads-up notification.
     */
    fun showNotification(
        context: Context,
        title: String,
        body: String,
        channelId: String = CHANNEL_GENERAL,
        data: Map<String, String> = emptyMap()
    ) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            action = Intent.ACTION_VIEW
            data["url"]?.let { putExtra("deep_link", it) }
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationId = when (channelId) {
            CHANNEL_TRADES -> ID_TRADE
            CHANNEL_ALERTS -> ID_ALERT
            CHANNEL_CHAT -> ID_CHAT
            else -> ID_GENERAL
        }

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(
                when (channelId) {
                    CHANNEL_TRADES -> NotificationCompat.CATEGORY_STATUS
                    CHANNEL_ALERTS -> NotificationCompat.CATEGORY_ALARM
                    else -> NotificationCompat.CATEGORY_MESSAGE
                }
            )
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setShowWhen(true)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .build()

        // THIS makes the notification appear on the phone
        manager.notify(notificationId, notification)
    }
}
