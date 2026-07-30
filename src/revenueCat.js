let configuredUserId = '';

export const revenueCatConfig = {
  iosApiKey: import.meta.env.VITE_REVENUECAT_IOS_API_KEY || 'appl_YMfeRvFoCfgIxAuTsqJVayljlkv',
  entitlementId: import.meta.env.VITE_REVENUECAT_ENTITLEMENT_ID || 'The Complete Athlete Pro',
  premiumRequired: import.meta.env.VITE_PREMIUM_REQUIRED === 'true'
};

export function canUseNativePurchases() {
  return false;
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

  return {
    configured: true,
    native: false,
    active: false,
    package: {
      identifier: 'monthly',
      productIdentifier: 'the_complete_athlete_monthly',
      title: 'The Complete Athlete Premium',
      price: '$5.99',
      description: 'Full access to The Complete Athlete.'
    },
    message: 'Subscriptions are being connected before launch.'
  };
}

export async function purchaseRevenueCatSubscription() {
  throw new Error('Subscriptions are being connected before launch.');
}

export async function restoreRevenueCatSubscription() {
  throw new Error('Subscriptions are being connected before launch.');
}
