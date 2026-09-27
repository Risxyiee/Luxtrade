package web.id.luxtradee.twa

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.ProgressBar
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent

/**
 * Main Activity - Uses Custom Tabs (TWA) when available,
 * falls back to an optimized WebView for devices without Custom Tabs support.
 *
 * Dashboard-specific WebView optimizations for fast loading:
 * - Hardware acceleration with GPU compositing
 * - Aggressive caching (LOAD_DEFAULT)
 * - DNS prefetch and connection preconnect
 * - Safe browsing disabled for speed (trusted site)
 * - Optimized user agent
 */
class MainActivity : AppCompatActivity() {

    private var webView: WebView? = null
    private var progressBar: ProgressBar? = null
    private var isTwaAvailable = false
    private var currentUrl = DASHBOARD_URL

    companion object {
        private const val BASE_URL = "https://luxtradee.com"
        private const val DASHBOARD_URL = "$BASE_URL/dashboard"

        private val PRECONNECT_DOMAINS = listOf(
            "https://luxtradee.com",
            "https://supabase.co"
        )

        private val DNS_PREFETCH_DOMAINS = listOf(
            "luxtradee.com",
            "supabase.co",
            "googleapis.com"
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        progressBar = findViewById(R.id.progressBar)

        val intentUrl = handleDeepLink(intent)
        currentUrl = intentUrl ?: savedInstanceState?.getString("last_url") ?: DASHBOARD_URL

        isTwaAvailable = isCustomTabsAvailable()

        if (isTwaAvailable) {
            launchTwa(currentUrl)
            setupOptimizedWebView(currentUrl)
        } else {
            setupOptimizedWebView(currentUrl)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val url = handleDeepLink(intent)
        if (url != null) {
            currentUrl = url
            if (isTwaAvailable) {
                launchTwa(url)
            } else {
                webView?.loadUrl(url)
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString("last_url", currentUrl)
        webView?.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
        webView?.resumeTimers()
    }

    override fun onPause() {
        super.onPause()
        webView?.onPause()
        webView?.pauseTimers()
    }

    override fun onDestroy() {
        webView?.let {
            it.stopLoading()
            it.settings.javaScriptEnabled = false
            it.destroy()
        }
        webView = null
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        webView?.let {
            if (it.canGoBack()) it.goBack()
            else { @Suppress("DEPRECATION") super.onBackPressed() }
        } ?: run { @Suppress("DEPRECATION") super.onBackPressed() }
    }

    // ─── TWA / Custom Tabs ───────────────────────────────────────────────

    private fun launchTwa(url: String) {
        try {
            val builder = CustomTabsIntent.Builder()
                .setToolbarColor(Color.parseColor("#0f172a"))
                .setNavigationBarColor(Color.parseColor("#0f172a"))
                .setNavigationBarDividerColor(Color.parseColor("#1e293b"))
                .setShowTitle(false)

            val customTabsIntent = builder.build()
            customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            customTabsIntent.launchUrl(this, Uri.parse(url))
        } catch (e: Exception) {
            isTwaAvailable = false
            setupOptimizedWebView(url)
        }
    }

    private fun isCustomTabsAvailable(): Boolean {
        val serviceIntent = Intent("android.support.customtabs.action.CustomTabsService")
        val resolveInfos = packageManager.queryIntentServices(serviceIntent, 0)
        return resolveInfos.isNotEmpty()
    }

    // ─── Optimized WebView Setup for Dashboard ───────────────────────────

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupOptimizedWebView(url: String) {
        val container = findViewById<View>(R.id.webViewContainer)
        container.visibility = View.VISIBLE

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)

        webView?.let { wv ->
            val settings = wv.settings

            // ═══ CORE PERFORMANCE ═══
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true

            // ═══ CACHE: serve cached dashboard instantly, update in background ═══
            settings.cacheMode = WebSettings.LOAD_DEFAULT

            // ═══ RENDERING: hardware acceleration for smooth charts ═══
            wv.setLayerType(View.LAYER_TYPE_HARDWARE, null)

            // ═══ NETWORK ═══
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            settings.loadsImagesAutomatically = true
            settings.blockNetworkImage = false
            settings.allowFileAccess = true
            settings.allowContentAccess = true

            // ═══ VIEWPORT ═══
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.setSupportMultipleWindows(true)

            // ═══ SAFE BROWSING OFF FOR SPEED ═══
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                settings.safeBrowsingEnabled = false
            }

            // ═══ USER AGENT ═══
            val originalUa = settings.userAgentString
            settings.userAgentString = "$originalUa LuxTradeeTWA/1.1.0"

            // ═══ CLIENTS ═══
            wv.webViewClient = OptimizedWebViewClient(this, DNS_PREFETCH_DOMAINS, PRECONNECT_DOMAINS)
            wv.webChromeClient = DashboardChromeClient(this, progressBar)

            // ═══ LOAD DASHBOARD ═══
            wv.loadUrl(url)
        }
    }

    private fun handleDeepLink(intent: Intent): String? {
        val action = intent.action
        val data: Uri? = intent.data
        if (action == Intent.ACTION_VIEW && data != null) {
            return data.toString()
        }
        return null
    }
}
