package app.kerf.cortes;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private WebView web;
    private WebView printView; // se mantiene referenciado mientras se genera el documento

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#05060C"));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);      // guarda los proyectos (localStorage)
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);

        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient());
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    /** Puente JS -> Android: imprime un documento HTML con el diálogo del sistema (impresoras o «Guardar como PDF»). */
    private class Bridge {
        @JavascriptInterface
        public void printHtml(final String html, final String title) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    doPrint(html, title);
                }
            });
        }
    }

    private void doPrint(String html, final String title) {
        final WebView v = new WebView(this);
        final boolean[] launched = {false};
        v.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (launched[0]) return;
                launched[0] = true;
                PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(title);
                pm.print(title, adapter, new PrintAttributes.Builder().build());
            }
        });
        printView = v;
        v.loadDataWithBaseURL("file:///android_asset/", html, "text/html", "UTF-8", null);
    }

    @Override
    public void onBackPressed() {
        // Si la app tiene algo que cerrar (ventana o proyecto abierto) lo hace; si no, sale.
        web.evaluateJavascript(
                "(function(){return !!(window.onBack && window.onBack());})()",
                new android.webkit.ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (!"true".equals(value)) finish();
                    }
                });
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }
}
