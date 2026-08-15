import Foundation
import Capacitor
import StoreKit

@objc(TallyHoStorePlugin)
public class TallyHoStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TallyHoStorePlugin"
    public let jsName = "TallyHoStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEntitlement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]

    private let monthlyProductID = "com.kayladeshasier.tallyho.premium.month"
    private let annualProductID = "com.kayladeshasier.tallyho.premium.annually"
    private let lifetimeProductID = "com.kayladeshasier.tallyho.premium.lifetime"

    private var subscriptionProductIDs: Set<String> {
        [monthlyProductID, annualProductID]
    }

    private var entitlementProductIDs: Set<String> {
        subscriptionProductIDs.union([lifetimeProductID])
    }

    private func productID(for plan: String) -> String? {
        switch plan.lowercased() {
        case "monthly", "month":
            return monthlyProductID
        case "yearly", "annual", "annually", "year":
            return annualProductID
        default:
            return nil
        }
    }

    private func plan(for productID: String) -> String {
        if productID == lifetimeProductID {
            return "lifetime"
        }
        return productID == annualProductID ? "yearly" : "monthly"
    }

    private func verified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value):
            return value
        case .unverified:
            throw StoreError.failedVerification
        }
    }

    private func resolve(_ call: CAPPluginCall, with result: JSObject) {
        DispatchQueue.main.async {
            call.resolve(result)
        }
    }

    private func reject(_ call: CAPPluginCall, message: String) {
        DispatchQueue.main.async {
            call.reject(message)
        }
    }

    private func entitlementSnapshot() async -> JSObject {
        var lifetimeTransaction: Transaction?
        var newestTransaction: Transaction?

        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  entitlementProductIDs.contains(transaction.productID),
                  transaction.revocationDate == nil else {
                continue
            }

            if let expirationDate = transaction.expirationDate,
               expirationDate <= Date() {
                continue
            }

            if transaction.productID == lifetimeProductID {
                lifetimeTransaction = transaction
            } else if newestTransaction == nil || transaction.purchaseDate > newestTransaction!.purchaseDate {
                newestTransaction = transaction
            }
        }

        guard let transaction = lifetimeTransaction ?? newestTransaction else {
            return ["active": false]
        }

        var snapshot: JSObject = [
            "active": true,
            "productIdentifier": transaction.productID,
            "plan": plan(for: transaction.productID)
        ]

        if let expirationDate = transaction.expirationDate {
            snapshot["expirationDate"] = ISO8601DateFormatter().string(from: expirationDate)
        }

        return snapshot
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        Task {
            do {
                // Lifetime Premium is intentionally redemption-only. It is verified here as an
                // entitlement but never returned to the web paywall or accepted by purchase().
                let products = try await Product.products(for: Array(subscriptionProductIDs))
                let orderedProducts = products.sorted {
                    let firstRank = plan(for: $0.id) == "monthly" ? 0 : 1
                    let secondRank = plan(for: $1.id) == "monthly" ? 0 : 1
                    return firstRank < secondRank
                }
                let items: [JSObject] = orderedProducts.map { product in
                    var item: JSObject = [
                        "productIdentifier": product.id,
                        "plan": plan(for: product.id),
                        "displayName": product.displayName,
                        "description": product.description,
                        "displayPrice": product.displayPrice,
                        "price": NSDecimalNumber(decimal: product.price).doubleValue
                    ]

                    if let period = product.subscription?.subscriptionPeriod {
                        item["periodValue"] = period.value
                        switch period.unit {
                        case .day:
                            item["periodUnit"] = "day"
                        case .week:
                            item["periodUnit"] = "week"
                        case .month:
                            item["periodUnit"] = "month"
                        case .year:
                            item["periodUnit"] = "year"
                        @unknown default:
                            item["periodUnit"] = "period"
                        }
                    }

                    return item
                }

                resolve(call, with: ["products": items])
            } catch {
                reject(call, message: "Apple could not load the subscription prices. Please try again.")
            }
        }
    }

    @objc func getEntitlement(_ call: CAPPluginCall) {
        Task {
            resolve(call, with: await entitlementSnapshot())
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let requestedPlan = call.getString("plan"),
              let requestedProductID = productID(for: requestedPlan) else {
            call.reject("Choose a valid TallyHo subscription.")
            return
        }

        Task {
            do {
                guard let product = try await Product.products(for: [requestedProductID]).first else {
                    throw StoreError.productUnavailable
                }

                switch try await product.purchase() {
                case .success(let verification):
                    let transaction = try verified(verification)
                    await transaction.finish()
                    var snapshot = await entitlementSnapshot()
                    snapshot["status"] = "purchased"
                    resolve(call, with: snapshot)
                case .pending:
                    resolve(call, with: ["active": false, "status": "pending"])
                case .userCancelled:
                    resolve(call, with: ["active": false, "status": "cancelled"])
                @unknown default:
                    resolve(call, with: ["active": false, "status": "unknown"])
                }
            } catch StoreError.failedVerification {
                reject(call, message: "The App Store could not verify this purchase.")
            } catch StoreError.productUnavailable {
                reject(call, message: "This subscription is not available in the current App Store account.")
            } catch {
                reject(call, message: error.localizedDescription)
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                resolve(call, with: await entitlementSnapshot())
            } catch {
                reject(call, message: "The App Store could not restore purchases. Please try again.")
            }
        }
    }
}

private enum StoreError: Error {
    case failedVerification
    case productUnavailable
}
