import Foundation
import Capacitor
import LocalAuthentication

@objc(TallyHoBiometricPlugin)
public class TallyHoBiometricPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TallyHoBiometricPlugin"
    public let jsName = "TallyHoBiometric"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise)
    ]

    private func label(for type: LABiometryType) -> String {
        switch type {
        case .faceID:
            return "faceID"
        case .touchID:
            return "touchID"
        case .none:
            return "passcode"
        @unknown default:
            return "device"
        }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        call.resolve([
            "available": available,
            "biometryType": label(for: context.biometryType),
            "reason": error?.localizedDescription ?? ""
        ])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Unlock TallyHo"
        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            call.reject(error?.localizedDescription ?? "Device authentication is not available.")
            return
        }

        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, authError in
            DispatchQueue.main.async {
                if success {
                    call.resolve([
                        "success": true,
                        "biometryType": self.label(for: context.biometryType)
                    ])
                } else {
                    call.reject(authError?.localizedDescription ?? "Device authentication failed.")
                }
            }
        }
    }
}
