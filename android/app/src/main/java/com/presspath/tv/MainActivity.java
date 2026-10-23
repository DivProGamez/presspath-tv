package com.presspath.tv;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Hosts the PressPath TV web app in a full-screen WebView.
 *
 * Assets are served from the APK under a private https origin that is intercepted in
 * {@link #shouldServe}; nothing is fetched from the network. Remote, keyboard and gamepad
 * input is translated here into the app's six actions (up, down, left, right, ok, back)
 * and handed to the single JavaScript input dispatcher, so guided tasks count exactly
 * the presses the viewer made.
 */
public class MainActivity extends Activity {
    private static final String TAG = "PressPathTV";
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";

    private WebView web;
    private final Handler main = new Handler(Looper.getMainLooper());
    private int stickX = 0;
    private int stickY = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        web = new WebView(this);
        web.setBackgroundColor(0xFF050914);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage keeps runs and preferences on this device
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);                    // the app has its own Large Text setting
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        web.setWebViewClient(new LocalAssetClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i(TAG, m.message());
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "PressPathNative");

        setContentView(web);
        web.requestFocus();
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(START_URL);
        }
    }

    /** Methods callable from JavaScript as window.PressPathNative. */
    private final class Bridge {
        @JavascriptInterface
        public void exitApp() {
            main.post(new Runnable() {
                @Override
                public void run() { finish(); }
            });
        }

        @JavascriptInterface
        public String platform() { return "android-tv"; }
    }

    // ---------------------------------------------------------------- input

    private static String actionFor(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP: return "up";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "down";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "left";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "right";
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
            case KeyEvent.KEYCODE_BUTTON_A:
                return "ok";
            case KeyEvent.KEYCODE_BACK:
            case KeyEvent.KEYCODE_ESCAPE:
            case KeyEvent.KEYCODE_BUTTON_B:
                return "back";
            default: return null;
        }
    }

    private static boolean isDirection(String a) {
        return "up".equals(a) || "down".equals(a) || "left".equals(a) || "right".equals(a);
    }

    private void send(String action) {
        if (web == null) return;
        web.evaluateJavascript("window.PressPath&&window.PressPath.input('" + action + "','remote')", null);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        String action = actionFor(event.getKeyCode());
        if (action == null) return super.dispatchKeyEvent(event);
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            // Held D-pad keys repeat like a remote; OK and Back fire once per press.
            if (event.getRepeatCount() == 0 || isDirection(action)) send(action);
        }
        return true;
    }

    /** Gamepad hat switch and left stick, edge-triggered so one push = one press. */
    @Override
    public boolean onGenericMotionEvent(MotionEvent ev) {
        if ((ev.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
                && ev.getAction() == MotionEvent.ACTION_MOVE) {
            float hx = ev.getAxisValue(MotionEvent.AXIS_HAT_X), hy = ev.getAxisValue(MotionEvent.AXIS_HAT_Y);
            float x = ev.getAxisValue(MotionEvent.AXIS_X), y = ev.getAxisValue(MotionEvent.AXIS_Y);
            int dx = (hx > 0.5f || x > 0.6f) ? 1 : (hx < -0.5f || x < -0.6f) ? -1 : 0;
            int dy = (hy > 0.5f || y > 0.6f) ? 1 : (hy < -0.5f || y < -0.6f) ? -1 : 0;
            if (dx != stickX) { if (dx != 0) send(dx > 0 ? "right" : "left"); stickX = dx; }
            if (dy != stickY) { if (dy != 0) send(dy > 0 ? "down" : "up"); stickY = dy; }
            return true;
        }
        return super.onGenericMotionEvent(ev);
    }

    // ---------------------------------------------------------------- local assets

    private WebResourceResponse shouldServe(Uri url) {
        if (url == null || !HOST.equals(url.getHost())) {
            return blocked();                       // no network access, ever
        }
        String path = url.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
        if (path.contains("..")) return blocked();
        try {
            InputStream in = getAssets().open("web" + path);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            return new WebResourceResponse(mimeFor(path), "utf-8", 200, "OK", headers, in);
        } catch (IOException e) {
            Log.w(TAG, "missing asset " + path);
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
        }
    }

    private static WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    private static String mimeFor(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private final class LocalAssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return shouldServe(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !HOST.equals(request.getUrl().getHost());
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return !HOST.equals(Uri.parse(url).getHost());
        }
    }

    // ---------------------------------------------------------------- lifecycle

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); web.requestFocus(); }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("PressPathNative");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
