import Capacitor

@objc(TallyHoBridgeViewController)
class TallyHoBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(TallyHoBiometricPlugin())
        bridge?.registerPluginInstance(TallyHoStorePlugin())
        print("⚡️ TallyHo native plugins registered")
    }
}
