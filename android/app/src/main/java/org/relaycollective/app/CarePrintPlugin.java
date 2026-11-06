package org.relaycollective.app;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CarePrint")
public class CarePrintPlugin extends Plugin {
    @PluginMethod()
    public void print(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            PrintManager printManager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
            if (printManager == null) {
                call.reject("Printing is not available on this device.");
                return;
            }
            WebView webView = getBridge().getWebView();
            printManager.print(
                "Relay Collective ride slip",
                webView.createPrintDocumentAdapter("Relay Collective ride slip"),
                new PrintAttributes.Builder().build()
            );
            call.resolve();
        });
    }
}
