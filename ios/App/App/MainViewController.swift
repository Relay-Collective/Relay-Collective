import UIKit
import WebKit
import Capacitor

// Registers the app's own plugins; Capacitor only auto-registers npm plugins.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(CarePrintPlugin())
    }
}

// iOS counterpart of android/.../CarePrintPlugin.java: opens the system print sheet for the current page.
@objc(CarePrintPlugin)
public class CarePrintPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CarePrintPlugin"
    public let jsName = "CarePrint"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise)
    ]

    @objc func print(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView else {
                call.reject("Printing is not available on this device.")
                return
            }
            let info = UIPrintInfo(dictionary: nil)
            info.jobName = "Relay Collective ride slip"
            info.outputType = .general
            let controller = UIPrintInteractionController.shared
            controller.printInfo = info
            controller.printFormatter = webView.viewPrintFormatter()
            controller.present(animated: true) { _, _, _ in call.resolve() }
        }
    }
}
