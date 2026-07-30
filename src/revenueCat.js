let configuredUserId = '';

export const revenueCatConfig = {
  iosApiKey: import.meta.env.VITE_REVENUECAT_IOS_API_KEY || 'appl_YMfeRvFoCfgIxAuTsqJVayljlkv',
  entitlementId: import.meta.env.VITE_REVENUECAT_ENTITLEMENT_ID || 'The Complete Athlete Pro',
  premiumRequired: import.meta.env.VITE_PREMIUM_REQUIRED === 'true'
};

export function canUseNativePurchases() {
  return typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
}

function simplifyCustomerInfo(customerInfo, entitlementId = revenueCatConfig.entitlementId) {
  const activeEntitlements = customerInfo?.entitlements?.active ?? {};
  const entitlement =
    activeEntitlements[entitlementId] ??
    activeEntitlements.premium ??
    activeEntitlements['The Complete Athlete Pro'] ??
    Object.values(activeEntitlements)[0] ??
    null;
  return {
    active: Boolean(entitlement?.isActive),
    entitlement,
    expirationDate: entitlement?.expirationDate ?? customerInfo?.latestExpirationDate ?? '',
    managementURL: customerInfo?.managementURL ?? ''
  };
}

function selectPackage(offerings) {
  const current = offerings?.current;
  return current?.monthly ?? current?.availablePackages?.[0] ?? null;
}

function packageSummary(selectedPackage) {
  if (!selectedPackage) return null;
  const product = selectedPackage.product ?? {};
  return {
    identifier: selectedPackage.identifier,
    productIdentifier: product.identifier || '',
    title: product.title || 'The Complete Athlete Premium',
    price: product.priceString || '$5.99',
    description: product.description || 'Full access to The Complete Athlete.'
  };
}

export async function loadRevenueCatSubscription({ userId, email, name }) {
  if (!revenueCatConfig.iosApiKey) {
    return {
      configured: false,
      native: canUseNativePurchases(),
      active: false,
      package: null,
      message: 'RevenueCat key is not set yet.'
    };
  }

  if (!canUseNativePurchases()) {
    return {
      configured: true,
      native: false,
      active: false,
      package: null,
      message: 'Subscriptions are available inside the iPhone app.'
    };
  }

  const { Purchases } = await import('@revenuecat/purchases-capacitor');

  if (configuredUserId !== userId) {
    await Purchases.configure({
      apiKey: revenueCatConfig.iosApiKey,
      appUserID: userId
    });
    configuredUserId = userId;
  }

  if (email) await Purchases.setEmail({ email });
  if (name) await Purchases.setDisplayName({ displayName: name });

  const [{ customerInfo }, offerings] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getOfferings()
  ]);
  const subscription = simplifyCustomerInfo(customerInfo);

  return {
    configured: true,
    native: true,
    active: subscription.active,
    expirationDate: subscription.expirationDate,
    managementURL: subscription.managementURL,
    package: packageSummary(selectPackage(offerings)),
    message: subscription.active ? 'Premium access is active.' : 'Premium access is ready to start.'
  };
}

export async function purchaseRevenueCatSubscription() {
  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  const offerings = await Purchases.getOfferings();
  const selectedPackage = selectPackage(offerings);
  if (!selectedPackage) throw new Error('No subscription offering found in RevenueCat.');
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: selectedPackage });
  return simplifyCustomerInfo(customerInfo);
}

export async function restoreRevenueCatSubscription() {
  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  const { customerInfo } = await Purchases.restorePurchases();
  return simplifyCustomerInfo(customerInfo);
}
