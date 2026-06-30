package com.im.project.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final String DEFAULT_API_BASE = "http://10.0.2.2:8000";
    private boolean initialized;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (initialized) return;
                initialized = true;
                String js = "if(!localStorage.getItem('im-api-base')){" +
                    "localStorage.setItem('im-api-base','" + DEFAULT_API_BASE + "');" +
                    "location.reload();" +
                    "}";
                view.evaluateJavascript(js, null);
            }
        });

        webView.loadUrl("file:///android_asset/web/index.html");
    }
}
