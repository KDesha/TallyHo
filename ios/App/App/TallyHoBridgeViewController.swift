import Capacitor

@objc(TallyHoBridgeViewController)
class TallyHoBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginType(TallyHoBiometricPlugin.self)
    }
}
