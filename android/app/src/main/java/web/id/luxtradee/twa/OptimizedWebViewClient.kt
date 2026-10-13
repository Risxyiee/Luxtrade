package web.id.luxtradee.twa

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Optimized WebViewClient with aggressive caching, DNS prefetch,
 * preconnect, and offline fallback for fast dashboard loading.
 */
class OptimizedWebViewClient(
    private val context: Context,
    private val dnsPrefetchDomains: List<String> = emptyList(),
    private val preconnectDomains: List<String> = emptyList()
) : WebViewClient() {

    private var isPageLoaded = false
    private var hasInjectedPrefetch = false

    companion object {
        private const val OFFLINE_URL = "file:///android_asset/offline.html"
        private const val DASHBOARD_PERF_SCRIPT = "(function(){" +
            "window.__LUXTWAA=true;" +
            "window.__TWAPLATFORM='android';" +
            "if(document.querySelector('[data-dashboard]')){" +
            "document.documentElement.style.setProperty('--animation-duration','0.15s');" +
            "document.documentElement.style.setProperty('--transition-duration','0.1s');" +
            "}" +
            "requestAnimationFrame(function(){" +
            "requestAnimationFrame(function(){" +
            "window.dispatchEvent(new CustomEvent('twa-ready'));" +
            "});" +
            "});" +
            "if(window.performance&&window.performance.timing){" +
            "var t=window.performance.timing;" +
            "var lt=t.loadEventEnd-t.navigationStart;" +
            "if(lt>0&&navigator.sendBeacon){" +
            "navigator.sendBeacon('/api/twa-perf',JSON.stringify({" +
            "loadTime:lt," +
            "domReady:t.domContentLoadedEventEnd-t.navigationStart," +
            "ttfb:t.responseStart-t.requestStart," +
            "platform:'android_twa'" +
            "}));" +
            "}" +
            "}" +
            "})();"
    }

    override fun shouldInterceptRequest(
        view: WebView?,
        request: WebResourceRequest?
    ): WebResourceResponse? {
        return super.shouldInterceptRequest(view, request)
    }

    override fun shouldOverrideUrlLoading(
        view: WebView?,
        request: WebResourceRequest?
    ): Boolean {
        val url = request?.url?.toString() ?: return false

        // Internal navigation - stay in WebView
        if (url.startsWith("https://luxtradee.com") || url.startsWith("http://luxtradee.com")) {
            return false
        }

        // External links - open in browser
        if (url.startsWith("http://") || url.startsWith("https://")) {
            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse(url))
            context.startActivity(intent)
            return true
        }

        return false
    }

    @SuppressLint("RequiresFeature")
    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        isPageLoaded = false

        if (!hasInjectedPrefetch && view != null) {
            injectPrefetchScript(view)
            hasInjectedPrefetch = true
        }
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        isPageLoaded = true

        view?.let { wv ->
            wv.evaluateJavascript(DASHBOARD_PERF_SCRIPT, null)
            wv.evaluateJavascript(
                "if(window.navigator.serviceWorker&&window.navigator.serviceWorker.controller){" +
                "window.navigator.serviceWorker.controller.postMessage({type:'TWA_ACTIVE',platform:'android'});" +
                "}",
                null
            )
        }
    }

    override fun onRenderProcessGone(view: WebView?, detail: android.webkit.RenderProcessGoneDetail?): Boolean {
        if (detail?.didCrash() == true) {
            view?.let {
                it.loadUrl("about:blank")
                it.clearCache(true)
                it.clearHistory()
                it.postDelayed({
                    it.loadUrl("https://luxtradee.com/dashboard")
                }, 1000)
            }
            return true
        }
        return false
    }

    override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: WebResourceError?
    ) {
        super.onReceivedError(view, request, error)
        if (request?.isForMainFrame == true && !isNetworkAvailable()) {
            view?.loadUrl(OFFLINE_URL)
        }
    }

    override fun onReceivedHttpError(
        view: WebView?,
        request: WebResourceRequest?,
        errorResponse: WebResourceResponse?
    ) {
        super.onReceivedHttpError(view, request, errorResponse)
    }

    @Suppress("DEPRECATION")
    private fun isNetworkAvailable(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(network) ?: return false
            return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            val info = cm.activeNetworkInfo
            return info?.isConnected == true
        }
    }

    private fun injectPrefetchScript(view: WebView) {
        val script = buildString {
            append("(function(){")
            append("var h=document.getElementsByTagName('head')[0];")
            append("if(!h)return;")
            for (domain in dnsPrefetchDomains) {
                append("var d=document.createElement('link');")
                append("d.rel='dns-prefetch';d.href='//$domain';")
                append("h.appendChild(d);")
            }
            for (domain in preconnectDomains) {
                append("var p=document.createElement('link');")
                append("p.rel='preconnect';p.href='$domain';p.crossOrigin='anonymous';")
                append("h.appendChild(p);")
            }
            append("})();")
        }
        view.evaluateJavascript(script, null)
    }
}
