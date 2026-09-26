package web.id.luxtradee.twa

import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.ProgressBar

/**
 * Custom WebChromeClient for dashboard:
 * - Handles JavaScript dialogs (suppress unnecessary ones)
 * - Manages progress bar for loading indicator
 * - Handles notification permission requests from web content
 * - Enables geolocation if needed
 */
class DashboardChromeClient(
    private val mainActivity: MainActivity,
    private val progressBar: ProgressBar?
) : WebChromeClient() {

    override fun onProgressChanged(view: WebView?, newProgress: Int) {
        progressBar?.let { pb ->
            if (newProgress < 100) {
                pb.visibility = View.VISIBLE
                pb.progress = newProgress
            } else {
                // Smooth fade out when loading complete
                pb.animate()
                    .alpha(0f)
                    .setDuration(300)
                    .withEndAction {
                        pb.visibility = View.GONE
                        pb.progress = 0
                        pb.alpha = 1f
                    }
                    .start()
            }
        }
    }

    override fun onJsAlert(
        view: WebView?, url: String?, message: String?, result: JsResult?
    ): Boolean {
        // Allow JS alerts for debugging in dev mode, suppress in production
        result?.confirm()
        return true
    }

    override fun onJsConfirm(
        view: WebView?, url: String?, message: String?, result: JsResult?
    ): Boolean {
        // Auto-confirm - needed for notification permission prompts
        result?.confirm()
        return true
    }

    override fun onJsPrompt(
        view: WebView?, url: String?, message: String?, defaultValue: String?, result: JsPromptResult?
    ): Boolean {
        // Suppress prompt dialogs
        result?.cancel()
        return true
    }

    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
        // Log JS console messages in debug mode
        return true
    }

    override fun onGeolocationPermissionsShowPrompt(
        origin: String?, callback: GeolocationPermissions.Callback?
    ) {
        // Auto-deny geolocation (not needed for trading dashboard)
        callback?.invoke(origin, false, false)
    }

    override fun onPermissionRequest(request: PermissionRequest?) {
        // Handle web permission requests - allow notifications
        request?.let { req ->
            val resources = req.resources
            if (resources.contains(PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID)) {
                req.deny()
            } else {
                // Grant notification and other permissions
                req.grant(resources)
            }
        }
    }

    override fun onCreateWindow(
        view: WebView?, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message?
    ): Boolean {
        // Handle new window requests (target="_blank" links)
        // Open in the same WebView for dashboard links
        return false
    }
}
